/**
 * 护肤日记数据服务（服务端）
 *
 * 公共路由（/api/user/diary）与内部接口（/api/internal/diary*，供主站官网用户中心
 * 「护肤档案」调用）共用，保证 streak/自动日记接管/写窗口等口径只有一份实现。
 *
 * 职责边界：
 * - 读取：archive（首屏聚合）/ list（时间线分页或日历月）/ summary（里程碑）
 * - 写入：upsertDiaryEntry（校验 + upsert + 计算"应发积分"与连续天数）
 * - 删除：deleteDiaryEntry
 *
 * 积分发放不在本模块：
 * - 子站自己的打卡路径（/api/user/diary）拿到应发金额后调 diary-points 发放；
 * - 官网发起的打卡由官网积分账本直发（reference=checkin:{userId}:{date} 幂等），
 *   内部接口只返回应发金额，避免重复发放。
 */
import prisma from "@/lib/prisma";
import {
    cappedCheckinStreak,
    checkinPointsForStreak,
    computeStreak,
    isAutoDiaryEntry,
    isDiaryDateInRange,
    parseClientDate,
    streakEndingAt,
} from "@/lib/diary-utils";

export const DIARY_DEFAULT_PAGE_SIZE = 30;
export const DIARY_MAX_PAGE_SIZE = 50;

const MONTH_RE = /^\d{4}-\d{2}$/;
const SKIN_STATES = new Set(["great", "good", "normal", "bad", "terrible"]);

/** 请求校验失败（路由据此返回 400 + 中文文案） */
export class DiaryValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DiaryValidationError";
    }
}

export interface DiarySummary {
    totalCheckins: number;
    currentStreak: number;
    longestStreak: number;
    testCount: number;
}

export interface DiaryQueryFilter {
    /** YYYY-MM：返回该月全部条目（日历热力图） */
    month?: string | null;
    /** YYYY-MM-DD：游标分页（只取该日历日之前的条目） */
    before?: string | null;
}

const ENTRY_SELECT = {
    id: true,
    date: true,
    skinState: true,
    tags: true,
    note: true,
    sessionId: true,
    updatedAt: true,
} as const;

type DiaryDateWhere = { userId: string; date?: { gte?: Date; lt?: Date } };

/** 与旧实现一致：month 优先于 before；无效值视为不过滤 */
function buildDiaryWhere(userId: string, filter: DiaryQueryFilter): DiaryDateWhere {
    const where: DiaryDateWhere = { userId };
    if (filter.month && MONTH_RE.test(filter.month)) {
        const start = new Date(`${filter.month}-01T00:00:00.000Z`);
        const [y, m] = filter.month.split("-").map(Number);
        const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
        where.date = { gte: start, lt: end };
    } else if (filter.before) {
        const before = parseClientDate(filter.before);
        if (before) where.date = { lt: before };
    }
    return where;
}

export function normalizeDiaryPageSize(raw?: string | null): number {
    return Math.min(
        DIARY_MAX_PAGE_SIZE,
        Math.max(1, parseInt(raw || String(DIARY_DEFAULT_PAGE_SIZE), 10) || DIARY_DEFAULT_PAGE_SIZE)
    );
}

/** 里程碑统计（summary=1 或 archive 聚合内复用） */
export async function getDiarySummary(userId: string, filter: DiaryQueryFilter = {}): Promise<DiarySummary> {
    const where = buildDiaryWhere(userId, filter);
    const [rows, testCount] = await Promise.all([
        prisma.diaryEntry.findMany({ where, select: { date: true }, orderBy: { date: "desc" } }),
        prisma.advisorSession.count({
            where: { userId, completedAt: { not: null }, archivedAt: null },
        }),
    ]);
    const { current, longest } = computeStreak(rows.map((r) => r.date));
    return {
        totalCheckins: rows.length,
        currentStreak: current,
        longestStreak: longest,
        testCount,
    };
}

/** 首屏聚合（bootstrap）：首屏条目 + 分页信息 + 里程碑统计一次返回 */
export async function getDiaryArchive(
    userId: string,
    limitRaw?: string | null
): Promise<{
    entries: unknown[];
    pagination: { total: number; offset: number; limit: number; hasMore: boolean };
    summary: DiarySummary;
}> {
    const limit = normalizeDiaryPageSize(limitRaw);
    const where = { userId };
    const [entries, total, streakRows, testCount] = await Promise.all([
        prisma.diaryEntry.findMany({ where, orderBy: { date: "desc" }, take: limit, select: ENTRY_SELECT }),
        prisma.diaryEntry.count({ where }),
        prisma.diaryEntry.findMany({ where: { userId }, select: { date: true }, orderBy: { date: "desc" } }),
        prisma.advisorSession.count({
            where: { userId, completedAt: { not: null }, archivedAt: null },
        }),
    ]);
    const { current, longest } = computeStreak(streakRows.map((r) => r.date));
    return {
        entries,
        pagination: { total, offset: 0, limit, hasMore: entries.length < total },
        summary: {
            totalCheckins: streakRows.length,
            currentStreak: current,
            longestStreak: longest,
            testCount,
        },
    };
}

/**
 * 时间线分页 / 日历月列表（旧 GET 的 month / before / offset 三种口径）。
 * - month：该月全部条目（不分页）
 * - before：游标分页（before 之前的条目，取 limit 条）
 * - 默认：offset 分页
 */
export async function getDiaryList(
    userId: string,
    params: { month?: string | null; before?: string | null; offset?: number; limit?: string | null }
): Promise<{
    entries: unknown[];
    pagination: { total: number; offset: number; limit: number; hasMore: boolean };
}> {
    const limit = normalizeDiaryPageSize(params.limit);
    const offset = Math.max(0, params.offset ?? 0);
    const where = buildDiaryWhere(userId, { month: params.month, before: params.before });
    const [entries, total] = await Promise.all([
        prisma.diaryEntry.findMany({
            where,
            orderBy: { date: "desc" },
            skip: params.month || params.before ? undefined : offset,
            take: params.month ? undefined : limit,
            select: ENTRY_SELECT,
        }),
        prisma.diaryEntry.count({ where }),
    ]);
    return {
        entries,
        pagination: { total, offset, limit, hasMore: offset + entries.length < total },
    };
}

export interface DiaryUpsertResult {
    entry: { id: string; date: Date; skinState: string; tags: unknown; note: string | null };
    isFirstManualCheckin: boolean;
    /** 仅 isFirstManualCheckin=true 时返回：截至打卡日的连续天数 */
    streak?: number;
    /** 仅 isFirstManualCheckin=true 时返回：应发积分（min(streak,3)） */
    points?: number;
}

/**
 * 打卡 / 更新某日日记（userId+date 唯一，upsert）。
 * 入参为请求体原文（路由已解析 done），校验失败抛 DiaryValidationError。
 */
export async function upsertDiaryEntry(
    userId: string,
    body: unknown
): Promise<DiaryUpsertResult> {
    if (!body || typeof body !== "object") {
        throw new DiaryValidationError("请求格式错误");
    }
    const payload = body as Record<string, unknown>;

    const skinState = typeof payload.skinState === "string" ? payload.skinState : "";
    if (!SKIN_STATES.has(skinState)) {
        throw new DiaryValidationError("肌肤状态不合法");
    }

    // tags：最多 5 个，每个 ≤ 10 字符
    let tags: string[] = [];
    if (Array.isArray(payload.tags)) {
        tags = payload.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().slice(0, 10))
            .filter(Boolean)
            .slice(0, 5);
    }

    // note：与 schema VarChar(200) 对齐
    const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 200) || null : null;

    // 日期仅允许写入窗口内（[today-90, tomorrow]，两端各放宽 1 天兼容时区）
    const date = typeof payload.date === "string" ? parseClientDate(payload.date) : null;
    if (!date) {
        throw new DiaryValidationError("日期格式错误");
    }
    if (!isDiaryDateInRange(date)) {
        throw new DiaryValidationError("日期超出可记录范围");
    }

    // 打卡积分判定：仅"当日首次手动打卡"发放——新建条目，或接管当日测肤自动条目
    //（自动条目无情境标签；与 src/lib/diary.ts 的手动接管语义一致）。
    // 编辑已有手动打卡不重复发放；积分账本按 checkin:{userId}:{date} 幂等兜底
    const existing = await prisma.diaryEntry.findUnique({
        where: { userId_date: { userId, date } },
        select: { note: true, tags: true },
    });
    const isFirstManualCheckin =
        !existing ||
        (isAutoDiaryEntry(existing) && ((existing.tags as unknown[] | null)?.length ?? 0) === 0);

    const entry = await prisma.diaryEntry.upsert({
        where: { userId_date: { userId, date } },
        update: { skinState, tags, note },
        create: { userId, date, skinState, tags, note },
        select: { id: true, date: true, skinState: true, tags: true, note: true },
    });

    if (!isFirstManualCheckin) {
        return { entry, isFirstManualCheckin: false };
    }

    // 连续天数口径与里程碑"连续打卡"一致（含测肤自动条目）。
    // 积分规则在 streak=3 封顶（checkinPointsForStreak = min(streak,3)），
    // 先回查昨天/前天两个点得出封顶内天数，多数打卡免去全量历史扫描；
    // 仅当两天都有（streak ≥ 3）才补一次全量查询取精确连续天数——
    // 精确值要写进积分明细 note（"连续第 N 天"），不能用封顶值冒充。
    const prevDates = [1, 2].map((n) => new Date(date.getTime() - n * 86_400_000));
    const prevRows = await prisma.diaryEntry.findMany({
        where: { userId, date: { in: prevDates } },
        select: { date: true },
    });
    const prevSet = new Set(prevRows.map((r) => r.date.getTime()));
    let streak = cappedCheckinStreak(prevSet.has(prevDates[0].getTime()), prevSet.has(prevDates[1].getTime()));
    if (streak === 3) {
        const rows = await prisma.diaryEntry.findMany({
            where: { userId },
            select: { date: true },
        });
        streak = streakEndingAt(rows.map((r) => r.date), date);
    }

    return {
        entry,
        isFirstManualCheckin: true,
        streak,
        points: checkinPointsForStreak(streak),
    };
}

/** 删除指定日期（YYYY-MM-DD）的条目（含历史日期，不受写入窗口限制） */
export async function deleteDiaryEntry(userId: string, dateRaw: string | null): Promise<number> {
    const date = dateRaw ? parseClientDate(dateRaw) : null;
    if (!date) {
        throw new DiaryValidationError("日期格式错误");
    }
    const deleted = await prisma.diaryEntry.deleteMany({ where: { userId, date } });
    return deleted.count;
}
