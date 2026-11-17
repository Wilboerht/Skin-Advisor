import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { startOfTodayShanghai } from "@/lib/time";

export interface AdminAICostSummary {
    totalCalls: number;
    failedCalls: number;
    successRate: string;
    totalTokens: number;
    totalCost: number;
    avgDurationMs: number;
    avgTokensPerCall: number;
    promptTokens: number;
    completionTokens: number;
}

export interface AdminAICostProviderItem {
    provider: string;
    calls: number;
    totalTokens: number;
    cost: number;
}

export interface AdminAICostModelItem {
    model: string;
    calls: number;
    totalTokens: number;
    cost: number;
}

export interface AdminAICostTypeItem {
    type: string;
    calls: number;
    totalTokens: number;
    cost: number;
}

export interface AdminAICostFailureItem {
    id: string;
    provider: string;
    model: string;
    requestType: string;
    errorCode: string | null;
    estimatedCost: number;
    createdAt: Date;
}

export interface AdminAICostDailyItem {
    date: string;
    cost: number;
    calls: number;
}

export interface AdminAICostData {
    period: string;
    provider: string;
    summary: AdminAICostSummary;
    byProvider: AdminAICostProviderItem[];
    byModel: AdminAICostModelItem[];
    byType: AdminAICostTypeItem[];
    recentFailures: AdminAICostFailureItem[];
    dailyCosts: AdminAICostDailyItem[];
}

export interface AdminAICostSummaryView {
    period: string;
    totalCost: number;
    totalCalls: number;
    failedCalls: number;
    successRate: number;
    avgDurationMs: number;
}

// 成本数据缓存 (30s TTL，减少 DB 压力)
const costCache = new Map<string, { data: AdminAICostData; at: number }>();
const COST_CACHE_TTL = 30_000;

/** 测试/后台需要立即刷新时使用 */
export function invalidateAdminAICostCache(): void {
    costCache.clear();
}

export async function getAdminAICostData(
    period: string,
    provider?: string
): Promise<AdminAICostData> {
    const cacheKey = `${period}:${provider || "all"}`;
    const cached = costCache.get(cacheKey);
    if (cached && Date.now() - cached.at < COST_CACHE_TTL) {
        return cached.data;
    }

    const now = new Date();
    let dateFilter: Date;
    switch (period) {
        case "today":
            // 今日口径固定北京时间零点，与趋势图的 Asia/Shanghai 分组保持一致
            dateFilter = startOfTodayShanghai(now);
            break;
        case "week":
            dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case "month":
            dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            dateFilter = new Date(0); // all time
    }

    const whereClause: Prisma.AIUsageLogWhereInput = {
        createdAt: { gte: dateFilter },
    };
    if (provider) {
        whereClause.provider = provider;
    }

    // ===== 汇总统计 =====
    const [summary, byProvider, byModel, byType, recentFailures, dailyCosts] =
        await Promise.all([
            prisma.aIUsageLog.aggregate({
                where: whereClause,
                _sum: {
                    promptTokens: true,
                    completionTokens: true,
                    totalTokens: true,
                    estimatedCost: true,
                    durationMs: true,
                },
                _count: { id: true },
                _avg: {
                    durationMs: true,
                    totalTokens: true,
                },
            }),

            prisma.aIUsageLog.groupBy({
                by: ["provider"],
                where: whereClause,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
            }),

            prisma.aIUsageLog.groupBy({
                by: ["model"],
                where: whereClause,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
                orderBy: { _sum: { estimatedCost: "desc" } },
            }),

            prisma.aIUsageLog.groupBy({
                by: ["requestType"],
                where: whereClause,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
            }),

            prisma.aIUsageLog.findMany({
                where: { ...whereClause, success: false },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                    id: true,
                    provider: true,
                    model: true,
                    requestType: true,
                    errorCode: true,
                    estimatedCost: true,
                    createdAt: true,
                },
            }),

            // 每日成本趋势（最近30天，按北京时间日期分组）
            // provider 过滤与其他统计口径保持一致，避免筛选后趋势图仍含全部 provider
            prisma.$queryRaw<Array<{ date: string; cost: number; count: number }>>`
                SELECT
                    TO_CHAR(
                        ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai',
                        'YYYY-MM-DD'
                    ) as date,
                    SUM("estimatedCost")::float as cost,
                    COUNT(*)::int as count
                FROM "AIUsageLog"
                WHERE "createdAt" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
                ${provider ? Prisma.sql`AND "provider" = ${provider}` : Prisma.empty}
                GROUP BY 1
                ORDER BY date DESC
            `,
        ]);

    const totalCalls = summary._count.id;
    const failedCalls = await prisma.aIUsageLog.count({
        where: { ...whereClause, success: false },
    });
    const successRate =
        totalCalls > 0
            ? (((totalCalls - failedCalls) / totalCalls) * 100).toFixed(1)
            : "100.0";

    const data: AdminAICostData = {
        period,
        provider: provider || "all",
        summary: {
            totalCalls,
            failedCalls,
            successRate: `${successRate}%`,
            totalTokens: summary._sum.totalTokens || 0,
            totalCost: summary._sum.estimatedCost || 0,
            avgDurationMs: Math.round(summary._avg.durationMs || 0),
            avgTokensPerCall: Math.round(summary._avg.totalTokens || 0),
            promptTokens: summary._sum.promptTokens || 0,
            completionTokens: summary._sum.completionTokens || 0,
        },
        byProvider: byProvider.map(
            (item: {
                provider: string;
                _count: { id: number };
                _sum: { totalTokens: number | null; estimatedCost: number | null };
            }) => ({
                provider: item.provider,
                calls: item._count.id,
                totalTokens: item._sum.totalTokens || 0,
                cost: item._sum.estimatedCost || 0,
            })
        ),
        byModel: byModel.map(
            (item: {
                model: string;
                _count: { id: number };
                _sum: { totalTokens: number | null; estimatedCost: number | null };
            }) => ({
                model: item.model,
                calls: item._count.id,
                totalTokens: item._sum.totalTokens || 0,
                cost: item._sum.estimatedCost || 0,
            })
        ),
        byType: byType.map(
            (item: {
                requestType: string;
                _count: { id: number };
                _sum: { totalTokens: number | null; estimatedCost: number | null };
            }) => ({
                type: item.requestType,
                calls: item._count.id,
                totalTokens: item._sum.totalTokens || 0,
                cost: item._sum.estimatedCost || 0,
            })
        ),
        recentFailures,
        dailyCosts: (
            dailyCosts as Array<{ date: string; cost: number; count: number }>
        ).map((item) => ({
            date: item.date,
            cost: item.cost,
            calls: item.count,
        })),
    };

    costCache.set(cacheKey, { data, at: Date.now() });
    if (costCache.size > 20) {
        const oldest = [...costCache.entries()].sort(
            (a, b) => a[1].at - b[1].at
        )[0];
        if (oldest) costCache.delete(oldest[0]);
    }

    return data;
}

export async function getAdminAICostSummary(
    period = "week"
): Promise<AdminAICostSummaryView> {
    const data = await getAdminAICostData(period);
    const successRate = Number.parseFloat(data.summary.successRate);

    return {
        period: data.period,
        totalCost: data.summary.totalCost,
        totalCalls: data.summary.totalCalls,
        failedCalls: data.summary.failedCalls,
        successRate: Number.isFinite(successRate) ? successRate : 0,
        avgDurationMs: data.summary.avgDurationMs,
    };
}
