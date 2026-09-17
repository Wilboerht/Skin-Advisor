import { NextRequest, NextResponse } from "next/server";
import { getSkinTestUsageSummary } from "@/lib/usage-limit";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

/**
 * 内部接口：查询指定用户的测肤用量与会员配额（供主站会员面板调用）
 *
 * 鉴权：优先 HMAC 签名（X-Internal-API-*）；过渡期兼容旧版
 * Authorization: Bearer <ADVISOR_INTERNAL_SECRET>。密钥未配置时生产返回 500，
 * 开发环境仅放行本机请求。
 *
 * GET /api/internal/skin-test-usage?userId=<主站 sub>
 *
 * 响应示例：
 *   { "level": "SILVER", "totalUsed": 23, "todayUsed": 2,
 *     "quota": { "lifetimeLimit": 50, "dailyLimit": 10, "unlimited": false },
 *     "remaining": 27 }
 * 用户不存在（从未用过子站）：200 + level: null + totalUsed/todayUsed: 0 + 按 REGULAR 档配额。
 */
export async function GET(request: NextRequest) {
    const auth = await authorizeInternalRequest(request, { legacy: "bearer-advisor-secret" });
    if (!auth.ok) {
        const message = auth.reason === "advisor_secret_not_configured"
            ? "ADVISOR_INTERNAL_SECRET not configured"
            : "Unauthorized";
        return NextResponse.json({ error: message }, { status: auth.status ?? 401 });
    }

    // IP 级限流（原实现无限流，密钥泄漏后可被批量遍历 userId）
    const ip = getClientIP(request);
    const ipLimit = await rateLimit(`internal-skin-usage-ip-${ip}`, "default", { maxRequests: 120, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const userId = request.nextUrl.searchParams.get("userId") || "";
    if (!userId || userId.length > 128) {
        return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    try {
        const summary = await getSkinTestUsageSummary(userId);
        return NextResponse.json(summary);
    } catch (error) {
        logger.error("[internal/skin-test-usage] failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
