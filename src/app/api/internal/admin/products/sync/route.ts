import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { syncProductsFromMain } from "@/lib/product-sync";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * 内部接口：主站产品快照同步（主站 → 子站）
 *
 * POST /api/internal/admin/products/sync
 * Body: { schemaVersion: 1, generatedAt, products, options? }
 *
 * 鉴权：HMAC 签名（只接受签名模式，拒绝旧版 Bearer）。
 * 只写产品基础字段，不覆盖子站推荐属性；详细口径见 src/lib/product-sync.ts。
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
        maxRequests: 30,
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
