/**
 * 内部接口入站守卫（主站官网 → 子站）
 *
 * 统一：HMAC 签名鉴权（优先，兼容旧版 Bearer 回退）→ 限流 → userId 提取校验。
 * 限流按"接口作用域 + userId"：官方 BFF 是单一出口 IP，按 IP 限流会被全站
 * 用户共享放大；另加一个宽松的 IP 上限，防密钥泄漏后批量遍历 userId。
 *
 * userId 语义：主站 SSO sub，与子站 User.id 相同。
 * 所有内部接口统一从 query 读取 userId（签名只覆盖 pathname，不受影响）。
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export type InternalUserGuardResult =
    | { error: NextResponse; userId?: undefined }
    | { error?: undefined; userId: string };

export async function guardInternalUserRequest(
    request: NextRequest,
    options: { scope: string; maxRequests?: number; rawBody?: string }
): Promise<InternalUserGuardResult> {
    // 签名覆盖请求体哈希：POST 等带 body 的调用方必须先读原始文本并传入 rawBody，
    // 否则验签必然失败（官方出站签名包含 bodySha256）
    const auth = await authorizeInternalRequest(request, {
        legacy: "bearer-advisor-secret",
        rawBody: options.rawBody ?? "",
    });
    if (!auth.ok) {
        const message = auth.reason === "advisor_secret_not_configured"
            ? "ADVISOR_INTERNAL_SECRET not configured"
            : "Unauthorized";
        return { error: NextResponse.json({ error: message }, { status: auth.status ?? 401 }) };
    }

    const ip = getClientIP(request);
    const ipLimit = await rateLimit(`internal-${options.scope}-ip-${ip}`, "default", {
        maxRequests: 600,
        windowMs: 60 * 1000,
    });
    if (!ipLimit.success) {
        return { error: NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 }) };
    }

    const userId = request.nextUrl.searchParams.get("userId") || "";
    if (!userId || userId.length > 128) {
        return { error: NextResponse.json({ error: "Invalid userId" }, { status: 400 }) };
    }

    const limit = await rateLimit(`internal-${options.scope}-user-${userId}`, "default", {
        maxRequests: options.maxRequests ?? 60,
        windowMs: 60 * 1000,
    });
    if (!limit.success) {
        return { error: NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 }) };
    }

    return { userId };
}
