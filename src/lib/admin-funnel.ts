import prisma from "@/lib/prisma";

export const ADMIN_FUNNEL_DAYS = 30;

export interface AdminFunnelCounts {
    total: number;
    questionnaireStarted: number;
    questionnaireCompleted: number;
    captureStarted: number;
    captureCompleted: number;
    faceAnalyzed: number;
    reportStarted: number;
    reportCompleted: number;
    resultViewed: number;
}

export interface AdminFunnelSummary {
    days: number;
    totalSessions: number;
    reportCompleted: number;
    resultViewed: number;
    reportCompletionRate: number;
}

const CACHE_TTL_MS = 30_000;
let cache: { value: AdminFunnelCounts; expiresAt: number } | null = null;
let inflight: Promise<AdminFunnelCounts> | null = null;

/** 测试/后台需要立即刷新时使用 */
export function invalidateAdminFunnelCache(): void {
    cache = null;
}

export async function getAdminFunnelCounts(): Promise<AdminFunnelCounts> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    if (!inflight) {
        inflight = loadAdminFunnelCounts()
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

export function toAdminFunnelSummary(counts: AdminFunnelCounts): AdminFunnelSummary {
    const reportCompletionRate =
        counts.total > 0
            ? Math.round((counts.reportCompleted / counts.total) * 1000) / 10
            : 0;

    return {
        days: ADMIN_FUNNEL_DAYS,
        totalSessions: counts.total,
        reportCompleted: counts.reportCompleted,
        resultViewed: counts.resultViewed,
        reportCompletionRate,
    };
}

export async function getAdminFunnelSummary(): Promise<AdminFunnelSummary> {
    return toAdminFunnelSummary(await getAdminFunnelCounts());
}

async function loadAdminFunnelCounts(): Promise<AdminFunnelCounts> {
    const since = new Date(
        Date.now() - ADMIN_FUNNEL_DAYS * 24 * 60 * 60 * 1000
    );

    // 单次 SQL 聚合计；不把 30 天的 interactions JSON 全量拉到 Node 层，
    // 避免管理端漏斗页在大流量下把内存/序列化 CPU 打满。
    const rows = await prisma.$queryRaw<Array<{
        total: number;
        questionnaire_started: number;
        questionnaire_completed: number;
        capture_started: number;
        capture_completed: number;
        face_analyzed: number;
        report_started: number;
        report_completed: number;
        result_viewed: number;
    }>>`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE "questionnaireStartedAt" IS NOT NULL
                OR "interactions" @> '[{"type":"questionnaire_start"}]'::jsonb)::int AS questionnaire_started,
            COUNT(*) FILTER (WHERE "questionnaireCompletedAt" IS NOT NULL
                OR "interactions" @> '[{"type":"questionnaire_complete"}]'::jsonb)::int AS questionnaire_completed,
            COUNT(*) FILTER (WHERE "faceScanStartedAt" IS NOT NULL
                OR "interactions" @> '[{"type":"face_scan_start"}]'::jsonb)::int AS capture_started,
            COUNT(*) FILTER (WHERE "interactions" @> '[{"type":"face_scan_complete"}]'::jsonb)::int AS capture_completed,
            COUNT(*) FILTER (WHERE "faceScanCompletedAt" IS NOT NULL)::int AS face_analyzed,
            COUNT(*) FILTER (WHERE "analysisStartedAt" IS NOT NULL
                OR "interactions" @> '[{"type":"analysis_start"}]'::jsonb)::int AS report_started,
            COUNT(*) FILTER (WHERE "completedAt" IS NOT NULL
                OR "interactions" @> '[{"type":"analysis_complete"}]'::jsonb)::int AS report_completed,
            COUNT(*) FILTER (WHERE "resultViewedAt" IS NOT NULL
                OR "interactions" @> '[{"type":"result_view"}]'::jsonb)::int AS result_viewed
        FROM "AdvisorSession"
        WHERE "createdAt" >= ${since}
    `;
    const row = rows[0];

    if (!row) {
        return {
            total: 0,
            questionnaireStarted: 0,
            questionnaireCompleted: 0,
            captureStarted: 0,
            captureCompleted: 0,
            faceAnalyzed: 0,
            reportStarted: 0,
            reportCompleted: 0,
            resultViewed: 0,
        };
    }

    return {
        total: row.total,
        questionnaireStarted: row.questionnaire_started,
        questionnaireCompleted: row.questionnaire_completed,
        captureStarted: row.capture_started,
        captureCompleted: row.capture_completed,
        faceAnalyzed: row.face_analyzed,
        reportStarted: row.report_started,
        reportCompleted: row.report_completed,
        resultViewed: row.result_viewed,
    };
}
