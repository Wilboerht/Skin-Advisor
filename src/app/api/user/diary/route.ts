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

const SKIN_STATES = new Set(["great", "good", "normal", "bad", "terrible"]);

// POST: 打卡/更新某日日记（userId+date 唯一，upsert）。date 为客户端本地日历日（YYYY-MM-DD），存 UTC 零点
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const ip = getClientIP(request);
        const limit = await rateLimit(`diary-post-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
        if (!limit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
        }

        const skinState = typeof body.skinState === "string" ? body.skinState : "";
        if (!SKIN_STATES.has(skinState)) {
            return NextResponse.json({ error: "肌肤状态不合法" }, { status: 400 });
        }

        // tags：最多 5 个，每个 ≤ 10 字符
        let tags: string[] = [];
        if (Array.isArray(body.tags)) {
            tags = body.tags
                .filter((t: unknown): t is string => typeof t === "string")
                .map((t: string) => t.trim().slice(0, 10))
                .filter(Boolean)
                .slice(0, 5);
        }

        // note：与 schema VarChar(200) 对齐
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;

        // 日期仅允许 90 天内到今天（客户端时区可能领先 UTC，放宽 1 天容差）
        let date: Date | null = null;
        if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
            date = new Date(`${body.date}T00:00:00.000Z`);
        }
        if (!date || isNaN(date.getTime())) {
            return NextResponse.json({ error: "日期格式错误" }, { status: 400 });
        }
        const now = new Date();
        const maxDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const minDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 89));
        if (date > maxDate || date < minDate) {
            return NextResponse.json({ error: "日期超出可记录范围" }, { status: 400 });
        }

        const entry = await prisma.diaryEntry.upsert({
            where: { userId_date: { userId: user.id, date } },
            update: { skinState, tags, note },
            create: { userId: user.id, date, skinState, tags, note },
            select: { id: true, date: true, skinState: true, tags: true, note: true },
        });

        return NextResponse.json({ success: true, data: entry });
    } catch (error) {
        logger.error("Diary save error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
