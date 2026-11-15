import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { syncProductsFromMain } from "@/lib/product-sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SESSION_TTL_MS = 60 * 60 * 1000;

const v2Schema = z.object({
  schemaVersion: z.literal(2),
  syncId: z.string().trim().min(1).max(128),
  generatedAt: z.string().datetime(),
  batchIndex: z.number().int().min(0).max(10_000),
  batchCount: z.number().int().min(1).max(10_000),
  totalProducts: z.number().int().min(0).max(100_000),
  products: z.array(z.unknown()).max(500),
  options: z
    .object({
      trigger: z.string().max(50).optional(),
      bindByName: z.boolean().optional(),
      force: z.boolean().optional(),
      dryRun: z.boolean().optional(),
    })
    .optional(),
});

type V2Payload = z.infer<typeof v2Schema>;

async function syncV2(payload: V2Payload) {
  const now = new Date();
  await prisma.productSyncSession.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  let session = await prisma.productSyncSession.findUnique({
    where: { syncId: payload.syncId },
  });
  if (session?.status === "COMPLETED") {
    return { ok: true as const, data: { duplicated: true, syncId: payload.syncId } };
  }
  if (!session) {
    session = await prisma.productSyncSession.create({
      data: {
        syncId: payload.syncId,
        batchCount: payload.batchCount,
        totalProducts: payload.totalProducts,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
  } else if (
    session.batchCount !== payload.batchCount ||
    session.totalProducts !== payload.totalProducts
  ) {
    return {
      ok: false as const,
      status: 409,
      code: "SYNC_SESSION_CONFLICT",
      message: "同一同步任务的批次参数不一致",
    };
  }

  if (payload.batchIndex >= payload.batchCount) {
    return {
      ok: false as const,
      status: 400,
      code: "INVALID_BATCH",
      message: "batchIndex 超出 batchCount",
    };
  }

  await prisma.productSyncBatch.upsert({
    where: {
      syncId_batchIndex: {
        syncId: payload.syncId,
        batchIndex: payload.batchIndex,
      },
    },
    create: {
      syncId: payload.syncId,
      batchIndex: payload.batchIndex,
      products: payload.products as Prisma.InputJsonValue,
    },
    update: {
      products: payload.products as Prisma.InputJsonValue,
    },
  });

  const batchCount = await prisma.productSyncBatch.count({
    where: { syncId: payload.syncId },
  });
  if (batchCount < payload.batchCount) {
    return {
      ok: true as const,
      data: {
        pending: true,
        syncId: payload.syncId,
        receivedBatches: batchCount,
        batchCount: payload.batchCount,
      },
    };
  }

  const batches = await prisma.productSyncBatch.findMany({
    where: { syncId: payload.syncId },
    orderBy: { batchIndex: "asc" },
    select: { batchIndex: true, products: true },
  });
  const products: unknown[] = [];
  for (let index = 0; index < batches.length; index += 1) {
    if (batches[index].batchIndex !== index) {
      return {
        ok: false as const,
        status: 409,
        code: "SYNC_BATCH_GAP",
        message: "同步批次不连续，请重新发起同步",
      };
    }
    const items = Array.isArray(batches[index].products) ? batches[index].products : [];
    products.push(...(items as unknown[]));
  }

  const outcome = await syncProductsFromMain({
    schemaVersion: 1,
    generatedAt: payload.generatedAt,
    products,
    options: payload.options,
  });
  if (!outcome.ok) {
    await prisma.productSyncSession.update({
      where: { syncId: payload.syncId },
      data: { status: "FAILED" },
    }).catch(() => {});
    return outcome;
  }
  await prisma.productSyncSession.update({
    where: { syncId: payload.syncId },
    data: { status: "COMPLETED" },
  }).catch(() => {});
  return { ok: true as const, data: outcome.data };
}

/**
 * 内部接口：主站产品快照同步（主站 → 子站）
 *
 * v1：单批完整快照，兼容旧主站。
 * v2：{ schemaVersion:2, syncId, batchIndex, batchCount, totalProducts, products }
 *     仅在所有批次收齐后调用原有 v1 合并逻辑，避免批次失败误停用产品。
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "请求体过大" } },
      { status: 413 }
    );
  }

  const auth = await authorizeInternalRequest(request, {
    rawBody,
    legacy: "bearer-advisor-secret",
  });
  if (!auth.ok) {
    const message =
      auth.reason === "advisor_secret_not_configured"
        ? "ADVISOR_INTERNAL_SECRET not configured"
        : "Unauthorized";
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message } },
      { status: auth.status ?? 401 }
    );
  }
  if (auth.mode !== "signed") {
    logger.warn("[ProductSync] rejected legacy bearer", {
      path: new URL(request.url).pathname,
    });
    return NextResponse.json(
      {
        success: false,
        error: { code: "SIGNED_REQUEST_REQUIRED", message: "该接口只接受签名请求" },
      },
      { status: 401 }
    );
  }

  const ip = getClientIP(request);
  const ipLimit = await rateLimit(`internal-admin-product-sync-ip-${ip}`, "default", {
    maxRequests: 60,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.success) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", message: "请求过于频繁" } },
      { status: 429 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_JSON", message: "请求体不是合法 JSON" } },
      { status: 400 }
    );
  }

  const v2 = v2Schema.safeParse(payload);
  if (v2.success) {
    try {
      const outcome = await syncV2(v2.data);
      if (!outcome.ok) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: outcome.code,
              message: outcome.message,
              details: "details" in outcome ? outcome.details : undefined,
            },
          },
          { status: outcome.status }
        );
      }
      return NextResponse.json({ success: true, data: outcome.data });
    } catch (error) {
      logger.error("[ProductSync] v2 failed", { error: String(error) });
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "产品同步失败" } },
        { status: 500 }
      );
    }
  }

  const outcome = await syncProductsFromMain(payload);
  if (!outcome.ok) {
    return NextResponse.json(
      {
        success: false,
        error: { code: outcome.code, message: outcome.message, details: outcome.details },
      },
      { status: outcome.status }
    );
  }

  return NextResponse.json({ success: true, data: outcome.data });
}

