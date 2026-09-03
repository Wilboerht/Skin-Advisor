import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { computeStreak, isDiaryDateInRange, parseClientDate } from "@/lib/diary-utils";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;
const MONTH_RE = /^\d{4}-\d{2}$/;

// GET: 获取当前用户日记列表。
// - 默认：按日期倒序 offset 分页（供时间线"加载更早"逐页拉取）
// - month=YYYY-MM：返回该月全部条目（日历热力图用，≤31 条）
// - summary=1：返回连续/累计打卡与测肤次数统计（里程碑胶囊用）
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

        const { searchParams } = new URL(request.url);
        const month = searchParams.get("month");
        const summaryOnly = searchParams.get("summary") === "1";

        const where: { userId: string; date?: { gte: Date; lt: Date } } = { userId: user.id };
        if (month && MONTH_RE.test(month)) {
            const start = new Date(`${month}-01T00:00:00.000Z`);
            const [y, m] = month.split("-").map(Number);
            const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
            where.date = { gte: start, lt: end };
        }

        if (summaryOnly) {
            const [rows, testCount] = await Promise.all([
                prisma.diaryEntry.findMany({ where, select: { date: true }, orderBy: { date: "desc" } }),
                prisma.advisorSession.count({
                    where: { userId: user.id, completedAt: { not: null }, archivedAt: null }
                })
            ]);
            const { current, longest } = computeStreak(rows.map((r) => r.date));
            return NextResponse.json(
                {
                    success: true,
                    data: [],
                    summary: { totalCheckins: rows.length, currentStreak: current, longestStreak: longest, testCount }
                },
                { headers: rateLimitHeaders }
            );
        }

        const pageSize = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
        );
        const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

        const [entries, total] = await Promise.all([
            prisma.diaryEntry.findMany({
                where,
                orderBy: { date: "desc" },
                skip: month ? undefined : offset,
                take: month ? undefined : pageSize,
                select: { id: true, date: true, skinState: true, tags: true, note: true, updatedAt: true }
            }),
            prisma.diaryEntry.count({ where })
        ]);

        return NextResponse.json(
            {
                success: true,
                data: entries,
                pagination: { total, offset, limit: pageSize, hasMore: offset + entries.length < total }
            },
            { headers: rateLimitHeaders }
        );
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

        // 日期仅允许写入窗口内（[today-90, tomorrow]，两端各放宽 1 天兼容时区）
        const date = typeof body.date === "string" ? parseClientDate(body.date) : null;
        if (!date) {
            return NextResponse.json({ error: "日期格式错误" }, { status: 400 });
        }
        if (!isDiaryDateInRange(date)) {
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

// DELETE: 删除指定日期（YYYY-MM-DD）的日记条目（含历史日期，不受写入窗口限制）
export async function DELETE(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const ip = getClientIP(request);
        const limit = await rateLimit(`diary-delete-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
        if (!limit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const { searchParams } = new URL(request.url);
        const date = searchParams.get("date") ? parseClientDate(searchParams.get("date")!) : null;
        if (!date) {
            return NextResponse.json({ error: "日期格式错误" }, { status: 400 });
        }

        const deleted = await prisma.diaryEntry.deleteMany({
            where: { userId: user.id, date }
        });

        return NextResponse.json({ success: true, deleted: deleted.count });
    } catch (error) {
        logger.error("Diary delete error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
