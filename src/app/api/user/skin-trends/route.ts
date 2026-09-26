
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { getSkinTrends } from "@/lib/skin-trends";
import { logger } from "@/lib/logger";

// GET: 返回最近测肤的评分趋势；有效样本不足 2 次时 data=null（前端走解锁引导）。
// 查询逻辑在 src/lib/skin-trends.ts（与内部接口共用口径）。
export async function GET(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 速率限制
        const ip = getClientIP(request);
        const limit = await rateLimit(`skin-trends-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
        const rateLimitHeaders = {
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.reset)
        };
        if (!limit.success) {
            return NextResponse.json(
                { error: "请求过于频繁，请稍后再试" },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        const trends = await getSkinTrends(user.id);
        if (!trends) {
            return NextResponse.json({
                success: true,
                data: null,
                message: "Not enough data for trend analysis"
            }, { headers: rateLimitHeaders });
        }

        return NextResponse.json({
            success: true,
            data: trends
        }, { headers: rateLimitHeaders });
    } catch (error) {
        logger.error("Trend fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
