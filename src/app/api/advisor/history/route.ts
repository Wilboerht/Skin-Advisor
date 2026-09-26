import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { lazyClaimGuestSessions } from "@/lib/guest-session-claim";
import { getTestHistory } from "@/lib/test-history";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 速率限制
    const ip = getClientIP(req);
    const rateLimitResult = await rateLimit(`history-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    const rateLimitHeaders = {
        "X-RateLimit-Limit": String(rateLimitResult.limit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "X-RateLimit-Reset": String(rateLimitResult.reset)
    };
    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "请求过于频繁，请稍后再试" },
            { status: 429, headers: rateLimitHeaders }
        );
    }

    await lazyClaimGuestSessions(user.id, ip);

    try {
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
        // lite=1：只回传时间线/列表所需字段（score + 肤质标签），裁剪掉产品推荐等大 JSON，节省带宽
        const lite = searchParams.get("lite") === "1";
        // before=<ISO 时间>：游标分页（只取该完成时间之前的记录），追加式"加载更早"专用
        const beforeRaw = searchParams.get("before");
        const before = beforeRaw ? new Date(beforeRaw) : null;

        const { history: payload, pagination } = await getTestHistory(user.id, {
            page,
            limit: pageSize,
            lite,
            before,
        });

        return NextResponse.json({ history: payload, pagination }, { headers: rateLimitHeaders });
    } catch (e) {
        logger.error("History fetch error:", e);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500, headers: rateLimitHeaders });
    }
}
