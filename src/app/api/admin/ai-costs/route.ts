/**
 * Admin AI Cost Dashboard API
 * GET /api/admin/ai-costs - AI 调用成本统计
 * 提供周期内的成本、Token 消耗、成功率等关键指标
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

// 成本数据缓存 (30s TTL，减少 DB 压力)
const costCache = new Map<string, { data: unknown; at: number }>();
const COST_CACHE_TTL = 30_000;

export const GET = withAdminAuth(async (request: NextRequest) => {
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-ai-costs-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today";
    const provider = searchParams.get("provider");

    // 缓存命中检查
    const cacheKey = `${period}:${provider || "all"}`;
    const cached = costCache.get(cacheKey);
    if (cached && Date.now() - cached.at < COST_CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        // 计算时间范围
        const now = new Date();
        let dateFilter: Date;
        switch (period) {
            case "today":
                dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

        const whereClause: Record<string, unknown> = {
            createdAt: { gte: dateFilter },
        };
        if (provider) {
            whereClause.provider = provider;
        }

        // ===== 汇总统计 =====
        const [summary, byProvider, byModel, byType, recentFailures, dailyCosts] = await Promise.all([
            // 总体汇总
            prisma.aIUsageLog.aggregate({
                where: whereClause as any,
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

            // 按提供者分组
            prisma.aIUsageLog.groupBy({
                by: ["provider"],
                where: whereClause as any,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
            }),

            // 按模型分组
            prisma.aIUsageLog.groupBy({
                by: ["model"],
                where: whereClause as any,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
                orderBy: { _sum: { estimatedCost: "desc" } },
            }),

            // 按请求类型分组
            prisma.aIUsageLog.groupBy({
                by: ["requestType"],
                where: whereClause as any,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
            }),

            // 最近失败记录
            prisma.aIUsageLog.findMany({
                where: { ...whereClause as any, success: false },
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

            // 每日成本趋势（最近30天）
            prisma.$queryRaw<Array<{ date: string; cost: number; count: number }>>`
                SELECT 
                    DATE("createdAt") as date,
                    SUM("estimatedCost")::float as cost,
                    COUNT(*)::int as count
                FROM "AIUsageLog"
                WHERE "createdAt" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
                GROUP BY DATE("createdAt")
                ORDER BY date DESC
            `,
        ]);

        // 计算成功率
        const totalCalls = summary._count.id;
        const failedCalls = await prisma.aIUsageLog.count({
            where: { ...whereClause as any, success: false },
        });
        const successRate = totalCalls > 0
            ? ((totalCalls - failedCalls) / totalCalls * 100).toFixed(1)
            : "100.0";

        const resultData: Record<string, unknown> = {
            period,
            provider: provider || "all",
            summary: {
                totalCalls,
                failedCalls,
                successRate: `${successRate}%`,
                totalTokens: summary._sum.totalTokens || 0,
                totalCost: (summary._sum.estimatedCost || 0).toFixed(4),
                avgDurationMs: Math.round(summary._avg.durationMs || 0),
                avgTokensPerCall: Math.round(summary._avg.totalTokens || 0),
                promptTokens: summary._sum.promptTokens || 0,
                completionTokens: summary._sum.completionTokens || 0,
            },
            byProvider: byProvider.map((p: { provider: string; _count: { id: number }; _sum: { totalTokens: number | null; estimatedCost: number | null } }) => ({
                provider: p.provider,
                calls: p._count.id,
                totalTokens: p._sum.totalTokens || 0,
                cost: (p._sum.estimatedCost || 0).toFixed(4),
            })),
            byModel: byModel.map((m: { model: string; _count: { id: number }; _sum: { totalTokens: number | null; estimatedCost: number | null } }) => ({
                model: m.model,
                calls: m._count.id,
                totalTokens: m._sum.totalTokens || 0,
                cost: (m._sum.estimatedCost || 0).toFixed(4),
            })),
            byType: byType.map((t: { requestType: string; _count: { id: number }; _sum: { totalTokens: number | null; estimatedCost: number | null } }) => ({
                type: t.requestType,
                calls: t._count.id,
                totalTokens: t._sum.totalTokens || 0,
                cost: (t._sum.estimatedCost || 0).toFixed(4),
            })),
            recentFailures,
            dailyCosts: dailyCosts,
        };

        // Write cache
        costCache.set(cacheKey, { data: resultData, at: Date.now() });
        if (costCache.size > 20) {
            const oldest = [...costCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) costCache.delete(oldest[0]);
        }

        return NextResponse.json(resultData);
    } catch (error) {
        console.error("[Admin AI Costs] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch AI cost data" },
            { status: 500 }
        );
    }
});
