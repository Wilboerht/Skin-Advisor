import prisma from "@/lib/prisma";

export const ADMIN_REPORT_FEEDBACK_DAYS = 30;
const ADMIN_REPORT_FEEDBACK_RECENT_LIMIT = 20;
const ADMIN_REPORT_FEEDBACK_TOP_LIMIT = 10;

export interface AdminReportFeedbackVerdictCount {
    verdict: string;
    count: number;
}

export interface AdminReportFeedbackTargetCount {
    targetType: string;
    targetKey: string;
    count: number;
}

export interface AdminReportFeedbackTrendPoint {
    date: string;
    accurate: number;
    inaccurate: number;
    unsure: number;
}

export interface AdminReportFeedbackRecentItem {
    id: string;
    sessionId: string;
    targetType: string;
    targetKey: string;
    verdict: string;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface AdminReportFeedbackQualityBreakdown {
    source: string;
    total: number;
    accurate: number;
    inaccurate: number;
    accuracyRate: number;
}

export interface AdminReportFeedbackModelBreakdown {
    model: string;
    total: number;
    accurate: number;
    inaccurate: number;
    accuracyRate: number;
}

export interface AdminReportFeedbackPromptBreakdown {
    promptVersion: string;
    total: number;
    accurate: number;
    inaccurate: number;
    accuracyRate: number;
}

export interface AdminReportFeedbackSummary {
    days: number;
    total: number;
    accurate: number;
    inaccurate: number;
    unsure: number;
    accuracyRate: number;
    reporterCount: number;
    byVerdict: AdminReportFeedbackVerdictCount[];
    topInaccurateTargets: AdminReportFeedbackTargetCount[];
    byNarrativeSource: AdminReportFeedbackQualityBreakdown[];
    byModel: AdminReportFeedbackModelBreakdown[];
    byPromptVersion: AdminReportFeedbackPromptBreakdown[];
    recent: AdminReportFeedbackRecentItem[];
    trend: AdminReportFeedbackTrendPoint[];
}

const CACHE_TTL_MS = 30_000;
let cache: { value: AdminReportFeedbackSummary; expiresAt: number } | null = null;
let inflight: Promise<AdminReportFeedbackSummary> | null = null;

/** 测试/后台需要立即刷新时使用 */
export function invalidateAdminReportFeedbackCache(): void {
    cache = null;
}

export async function getAdminReportFeedbackSummary(): Promise<AdminReportFeedbackSummary> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    if (!inflight) {
        inflight = loadAdminReportFeedbackSummary()
            .then((value) => {
                cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
                return value;
            })
            .finally(() => {
                inflight = null;
            });
    }
    return inflight;
}

function accuracyPercent(accurate: number, inaccurate: number): number {
    const judged = accurate + inaccurate;
    return judged > 0 ? Math.round((accurate / judged) * 1000) / 10 : 0;
}

async function loadAdminReportFeedbackSummary(): Promise<AdminReportFeedbackSummary> {
    const since = new Date(
        Date.now() - ADMIN_REPORT_FEEDBACK_DAYS * 24 * 60 * 60 * 1000
    );

    const [totalsRows, verdictGroups, topInaccurateGroups, recent, trendRows, sourceRows, modelRows, promptRows] =
        await Promise.all([
            prisma.$queryRaw<
                Array<{
                    total: number;
                    accurate: number;
                    inaccurate: number;
                    unsure: number;
                    reporters: number;
                }>
            >`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE "verdict" = 'accurate')::int AS accurate,
                    COUNT(*) FILTER (WHERE "verdict" = 'inaccurate')::int AS inaccurate,
                    COUNT(*) FILTER (WHERE "verdict" = 'unsure')::int AS unsure,
                    COUNT(DISTINCT "userId")::int AS reporters
                FROM "ReportFeedback"
                WHERE "createdAt" >= ${since}
            `,
            prisma.reportFeedback.groupBy({
                by: ["verdict"],
                where: { createdAt: { gte: since } },
                _count: { id: true },
            }),
            prisma.reportFeedback.groupBy({
                by: ["targetType", "targetKey"],
                where: { createdAt: { gte: since }, verdict: "inaccurate" },
                _count: { id: true },
                orderBy: { _count: { id: "desc" } },
                take: ADMIN_REPORT_FEEDBACK_TOP_LIMIT,
            }),
            prisma.reportFeedback.findMany({
                where: { createdAt: { gte: since } },
                orderBy: { updatedAt: "desc" },
                take: ADMIN_REPORT_FEEDBACK_RECENT_LIMIT,
                select: {
                    id: true,
                    sessionId: true,
                    targetType: true,
                    targetKey: true,
                    verdict: true,
                    note: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            // 按北京时间归日：createdAt 是 timestamp(3)（存储 UTC），需先标记 UTC 再转时区
            prisma.$queryRaw<
                Array<{
                    day: string;
                    accurate: number;
                    inaccurate: number;
                    unsure: number;
                }>
            >`
                SELECT
                    to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS day,
                    COUNT(*) FILTER (WHERE "verdict" = 'accurate')::int AS accurate,
                    COUNT(*) FILTER (WHERE "verdict" = 'inaccurate')::int AS inaccurate,
                    COUNT(*) FILTER (WHERE "verdict" = 'unsure')::int AS unsure
                FROM "ReportFeedback"
                WHERE "createdAt" >= ${since}
                GROUP BY 1
                ORDER BY 1
            `,
            // 与报告质量日志关联：判断「规则兜底 / 某模型」的报告是否更容易被标不准
            prisma.$queryRaw<
                Array<{
                    source: string;
                    total: number;
                    accurate: number;
                    inaccurate: number;
                }>
            >`
                SELECT
                    COALESCE(q."narrativeSource", 'unknown') AS source,
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE f."verdict" = 'accurate')::int AS accurate,
                    COUNT(*) FILTER (WHERE f."verdict" = 'inaccurate')::int AS inaccurate
                FROM "ReportFeedback" f
                LEFT JOIN "ReportQualityLog" q ON q."sessionId" = f."sessionId"
                WHERE f."createdAt" >= ${since}
                GROUP BY 1
                ORDER BY 2 DESC
            `,
            prisma.$queryRaw<
                Array<{
                    model: string;
                    total: number;
                    accurate: number;
                    inaccurate: number;
                }>
            >`
                SELECT
                    COALESCE(q."model", 'unknown') AS model,
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE f."verdict" = 'accurate')::int AS accurate,
                    COUNT(*) FILTER (WHERE f."verdict" = 'inaccurate')::int AS inaccurate
                FROM "ReportFeedback" f
                LEFT JOIN "ReportQualityLog" q ON q."sessionId" = f."sessionId"
                WHERE f."createdAt" >= ${since}
                GROUP BY 1
                ORDER BY 2 DESC
            `,
            prisma.$queryRaw<
                Array<{
                    promptVersion: string;
                    total: number;
                    accurate: number;
                    inaccurate: number;
                }>
            >`
                SELECT
                    COALESCE(q."promptVersion", 'unknown') AS "promptVersion",
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE f."verdict" = 'accurate')::int AS accurate,
                    COUNT(*) FILTER (WHERE f."verdict" = 'inaccurate')::int AS inaccurate
                FROM "ReportFeedback" f
                LEFT JOIN "ReportQualityLog" q ON q."sessionId" = f."sessionId"
                WHERE f."createdAt" >= ${since}
                GROUP BY 1
                ORDER BY 2 DESC
            `,
        ]);

    const totals = totalsRows[0];
    const total = totals?.total ?? 0;
    const accurate = totals?.accurate ?? 0;
    const inaccurate = totals?.inaccurate ?? 0;
    const unsure = totals?.unsure ?? 0;
    const accuracyRate = accuracyPercent(accurate, inaccurate);

    return {
        days: ADMIN_REPORT_FEEDBACK_DAYS,
        total,
        accurate,
        inaccurate,
        unsure,
        accuracyRate,
        reporterCount: totals?.reporters ?? 0,
        byVerdict: verdictGroups.map((item) => ({
            verdict: item.verdict,
            count: item._count.id,
        })),
        topInaccurateTargets: topInaccurateGroups.map((item) => ({
            targetType: item.targetType,
            targetKey: item.targetKey,
            count: item._count.id,
        })),
        byNarrativeSource: sourceRows.map((row) => ({
            source: row.source,
            total: row.total,
            accurate: row.accurate,
            inaccurate: row.inaccurate,
            accuracyRate: accuracyPercent(row.accurate, row.inaccurate),
        })),
        byModel: modelRows.map((row) => ({
            model: row.model,
            total: row.total,
            accurate: row.accurate,
            inaccurate: row.inaccurate,
            accuracyRate: accuracyPercent(row.accurate, row.inaccurate),
        })),
        byPromptVersion: promptRows.map((row) => ({
            promptVersion: row.promptVersion,
            total: row.total,
            accurate: row.accurate,
            inaccurate: row.inaccurate,
            accuracyRate: accuracyPercent(row.accurate, row.inaccurate),
        })),
        recent,
        trend: trendRows.map((row) => ({
            date: row.day,
            accurate: row.accurate,
            inaccurate: row.inaccurate,
            unsure: row.unsure,
        })),
    };
}
