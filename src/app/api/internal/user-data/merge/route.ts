import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { logAdminAction } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { __internal as userMergeInternals } from "@/lib/user-merge";
import { isDisabledUser } from "@/lib/permissions";
import { logger } from "@/lib/logger";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type MergeMode = "preflight" | "execute";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * POST /api/internal/user-data/merge?sourceUserId=&targetUserId=&operationId=&mode=
 * 主站管理员账户合并：先预检，再幂等执行测肤侧数据迁移。
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const auth = await authorizeInternalRequest(request, {
    legacy: "bearer-advisor-secret",
    rawBody,
  });
  if (!auth.ok) {
    return jsonError("UNAUTHORIZED", "内部鉴权失败", auth.status ?? 401);
  }
  if (auth.mode !== "signed") {
    return jsonError("SIGNED_REQUEST_REQUIRED", "该接口只接受签名请求", 401);
  }

  const ip = getClientIP(request);
  const limit = await rateLimit(`internal-user-merge-${ip}`, "default", {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!limit.success) return jsonError("RATE_LIMITED", "请求过于频繁", 429);

  const params = request.nextUrl.searchParams;
  const sourceUserId = params.get("sourceUserId") || "";
  const targetUserId = params.get("targetUserId") || "";
  const operationId = params.get("operationId") || "";
  const modeRaw = params.get("mode") || "";
  const mode: MergeMode | null =
    modeRaw === "preflight" || modeRaw === "execute" ? modeRaw : null;

  if (
    !sourceUserId ||
    !targetUserId ||
    !operationId ||
    sourceUserId.length > 128 ||
    targetUserId.length > 128 ||
    operationId.length > 128 ||
    !mode
  ) {
    return jsonError("INVALID_PARAMS", "合并参数无效", 400);
  }
  if (sourceUserId === targetUserId) {
    return jsonError("INVALID_PARAMS", "源账户与目标账户不能相同", 400);
  }

  try {
    const [source, target] = await Promise.all([
      prisma.user.findUnique({
        where: { id: sourceUserId },
        select: { id: true, role: true },
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      }),
    ]);

    if (mode === "preflight") {
      if (!source) {
        return NextResponse.json({
          success: true,
          canMerge: false,
          message: "测肤侧源账户不存在",
        });
      }
      if (isDisabledUser(source.role)) {
        return NextResponse.json({
          success: true,
          canMerge: false,
          message: "测肤侧源账户已被禁用，拒绝合并",
        });
      }
      return NextResponse.json({
        success: true,
        canMerge: true,
        message: target ? "测肤侧账户可合并" : "测肤侧目标账户将在执行时创建",
      });
    }

    const existing = await prisma.mergeOperation.findUnique({
      where: { operationId },
    });
    if (existing?.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        data: { operationId, merged: false, duplicated: true, result: existing.result },
      });
    }
    if (existing?.status === "RUNNING") {
      return jsonError("MERGE_IN_PROGRESS", "账户合并正在执行，请稍后重试", 409);
    }

    if (!source) {
      await prisma.mergeOperation.upsert({
        where: { operationId },
        create: {
          operationId,
          sourceUserId,
          targetUserId,
          status: "COMPLETED",
          result: { noop: true, reason: "source_missing" },
        },
        update: {
          status: "COMPLETED",
          result: { noop: true, reason: "source_missing" },
        },
      });
      return NextResponse.json({
        success: true,
        data: { operationId, merged: false, noop: true, reason: "source_missing" },
      });
    }
    if (isDisabledUser(source.role)) {
      return jsonError("SOURCE_DISABLED", "测肤侧源账户已被禁用，拒绝合并", 409);
    }

    await prisma.mergeOperation.upsert({
      where: { operationId },
      create: {
        operationId,
        sourceUserId,
        targetUserId,
        status: "RUNNING",
      },
      update: {
        status: "RUNNING",
        result: Prisma.DbNull,
      },
    });

    try {
      if (!target) {
        await prisma.user.create({
          data: { id: targetUserId, phoneNumber: null },
        });
      }
      await userMergeInternals.mergeUserData(sourceUserId, targetUserId);
      await prisma.mergeOperation.update({
        where: { operationId },
        data: {
          status: "COMPLETED",
          result: { merged: true },
        },
      });
      await logAdminAction({
        adminId: null,
        action: "account_merge",
        resource: "User",
        resourceId: targetUserId,
        details: { operationId, sourceUserId, targetUserId, source: "main" },
        ip: "internal",
        userAgent: "main-site-account-merge",
      });
      return NextResponse.json({
        success: true,
        data: { operationId, merged: true },
      });
    } catch (error) {
      await prisma.mergeOperation.update({
        where: { operationId },
        data: { status: "FAILED", result: { error: String(error) } },
      }).catch(() => {});
      throw error;
    }
  } catch (error) {
    logger.error("[internal/user-data/merge] failed", { error: String(error) });
    return jsonError("INTERNAL_ERROR", "账户合并失败", 500);
  }
}
