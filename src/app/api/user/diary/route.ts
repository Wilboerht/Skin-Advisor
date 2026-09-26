import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import {
    DiaryValidationError,
    deleteDiaryEntry,
    getDiaryArchive,
    getDiaryList,
    getDiarySummary,
    upsertDiaryEntry,
} from "@/lib/diary-service";
import { grantCheckinPoints, backfillRecentCheckinPoints } from "@/lib/diary-points";

// GET: 获取当前用户日记列表。
// - 默认：按日期倒序分页（供时间线"加载更早"逐页拉取）；
//   before=YYYY-MM-DD：游标分页（只取该日期之前的条目），数据变动时不会像 offset 那样漂移
// - month=YYYY-MM：返回该月全部条目（日历热力图用，≤31 条）
// - summary=1：返回连续/累计打卡与测肤次数统计（里程碑胶囊用）
// - bootstrap=1：弹层打开时的聚合首屏（首屏条目 + 分页信息 + 里程碑统计一次返回），
//   避免打开弹层扇出多个请求触发限流
// 业务逻辑统一在 src/lib/diary-service.ts（与内部接口共用口径）。
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
        const bootstrap = searchParams.get("bootstrap") === "1";
        const before = searchParams.get("before");
        const limitRaw = searchParams.get("limit");
        const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

        if (summaryOnly) {
            const summary = await getDiarySummary(user.id, { month, before });
            return NextResponse.json(
                { success: true, data: [], summary },
                { headers: rateLimitHeaders }
            );
        }

        if (bootstrap) {
            const archive = await getDiaryArchive(user.id, limitRaw);
            return NextResponse.json(
                {
                    success: true,
                    data: archive.entries,
                    pagination: archive.pagination,
                    summary: archive.summary,
                },
                { headers: rateLimitHeaders }
            );
        }

        const list = await getDiaryList(user.id, { month, before, offset, limit: limitRaw });
        return NextResponse.json(
            { success: true, data: list.entries, pagination: list.pagination },
            { headers: rateLimitHeaders }
        );
    } catch (error) {
        logger.error("Diary fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: 打卡/更新某日日记（userId+date 唯一，upsert）。date 为客户端本地日历日（YYYY-MM-DD），存 UTC 零点。
// 首次手动打卡按连续天数发放积分（子站 → 官网账本），发放失败不阻断打卡。
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

        let result;
        try {
            result = await upsertDiaryEntry(user.id, body);
        } catch (error) {
            if (error instanceof DiaryValidationError) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            throw error;
        }

        const dateStr = result.entry.date.toISOString().slice(0, 10);

        // 打卡积分：连续第 1/2/3+ 天 +1/+2/+3 分（断开重新从 1 算起）。
        // 官网不可达/超时不阻断打卡，仅不返回 points（前端 toast 不提示积分）
        let points: { granted: number; streak: number } | undefined;
        if (result.isFirstManualCheckin && result.streak && result.points) {
            const granted = await grantCheckinPoints({
                userId: user.id,
                dateStr,
                streak: result.streak,
                points: result.points,
            });
            if (granted && granted.granted > 0) {
                points = { granted: granted.granted, streak: result.streak };
            }
        }

        // 漏发自愈（fire-and-forget）：最近窗口内手动打卡日的积分补发——
        // 官网瞬断导致某日漏发后，用户后续任意一次打卡/编辑都会自动补偿；
        // 账本 userId+reference 幂等，重复发放无副作用，不阻断响应
        void backfillRecentCheckinPoints(user.id, dateStr).catch((err) =>
            logger.warn("[DiaryPoints] 补发补偿失败", { userId: user.id, error: String(err) })
        );

        return NextResponse.json({ success: true, data: result.entry, ...(points ? { points } : {}) });
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

        let deleted: number;
        try {
            deleted = await deleteDiaryEntry(user.id, searchParams.get("date"));
        } catch (error) {
            if (error instanceof DiaryValidationError) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            throw error;
        }

        return NextResponse.json({ success: true, deleted });
    } catch (error) {
        logger.error("Diary delete error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
