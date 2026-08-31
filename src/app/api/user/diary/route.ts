import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

// GET: 获取当前用户日记列表（近 90 天，倒序）
export async function GET(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const ip = getClientIP(request);
        const limit = await rateLimit(`diary-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
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

        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 90);

        const entries = await prisma.diaryEntry.findMany({
            where: { userId: user.id, date: { gte: since } },
            orderBy: { date: "desc" },
            select: { id: true, date: true, skinState: true, tags: true, note: true, updatedAt: true }
        });

        return NextResponse.json({ success: true, data: entries }, { headers: rateLimitHeaders });
    } catch (error) {
        logger.error("Diary fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
