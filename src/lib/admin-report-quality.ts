import prisma from "@/lib/prisma";

export const ADMIN_REPORT_QUALITY_DAYS = 30;

export interface AdminReportQualitySourceCount {
    source: string;
    count: number;
}

export interface AdminReportQualitySummary {
    days: number;
    totalReports: number;
    aiNarrative: number;
    fallback: number;
    fallbackRate: number;
    avgDurationMs: number;
    avgQueueWaitMs: number;
    avgTextGenerationMs: number;
    avgProductSelectionMs: number;
    avgPersistMs: number;
    avgDiagnosisFindingCount: number;
    avgIssueCount: number;
    avgCoverageScored: number;
    bySource: AdminReportQualitySourceCount[];
}

const CACHE_TTL_MS = 30_000;
let cache: { value: AdminReportQualitySummary; expiresAt: number } | null = null;
let inflight: Promise<AdminReportQualitySummary> | null = null;

/** 测试/后台需要立即刷新时使用 */
export function invalidateAdminReportQualityCache(): void {
    cache = null;
}

export async function getAdminReportQualitySummary(): Promise<AdminReportQualitySummary> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    if (!inflight) {
        inflight = loadAdminReportQualitySummary()
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

async function loadAdminReportQualitySummary(): Promise<AdminReportQualitySummary> {
    const since = new Date(
        Date.now() - ADMIN_REPORT_QUALITY_DAYS * 24 * 60 * 60 * 1000
    );

    const [aggregate, sourceGroups] = await Promise.all([
        prisma.reportQualityLog.aggregate({
            where: { createdAt: { gte: since } },
            _count: { id: true },
            _avg: {
                durationMs: true,
                diagnosisFindingCount: true,
                issueCount: true,
                coverageScored: true,
                queueWaitMs: true,
                textGenerationMs: true,
                productSelectionMs: true,
                persistMs: true,
            },
        }),
        prisma.reportQualityLog.groupBy({
            by: ["narrativeSource"],
            where: { createdAt: { gte: since } },
            _count: { id: true },
        }),
    ]);

    const totalReports = aggregate._count.id;
    const fallback =
        sourceGroups.find((item) => item.narrativeSource === "fallback")?._count.id ?? 0;
    const fallbackRate =
        totalReports > 0
            ? Math.round((fallback / totalReports) * 1000) / 10
            : 0;

    return {
        days: ADMIN_REPORT_QUALITY_DAYS,
        totalReports,
        aiNarrative: Math.max(0, totalReports - fallback),
        fallback,
        fallbackRate,
        avgDurationMs: aggregate._avg.durationMs ?? 0,
        avgQueueWaitMs: aggregate._avg.queueWaitMs ?? 0,
        avgTextGenerationMs: aggregate._avg.textGenerationMs ?? 0,
        avgProductSelectionMs: aggregate._avg.productSelectionMs ?? 0,
        avgPersistMs: aggregate._avg.persistMs ?? 0,
        avgDiagnosisFindingCount: aggregate._avg.diagnosisFindingCount ?? 0,
        avgIssueCount: aggregate._avg.issueCount ?? 0,
        avgCoverageScored: aggregate._avg.coverageScored ?? 0,
        bySource: sourceGroups.map((item) => ({
            source: item.narrativeSource,
            count: item._count.id,
        })),
    };
}
