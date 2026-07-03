/**
 * Admin AI Cost Dashboard API
 * GET /api/admin/ai-costs - AI 调用成本统计
 * 提供周期内的成本、Token 消耗、成功率等关键指标
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export const GET = withAdminAuth(async (request: NextRequest) => {
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-ai-costs-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today"; // today | week | month | all
    const provider = searchParams.get("provider"); // optional filter

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
            prisma.aiUsageLog.aggregate({
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
            prisma.aiUsageLog.groupBy({
                by: ["provider"],
                where: whereClause as any,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
            }),

            // 按模型分组
            prisma.aiUsageLog.groupBy({
                by: ["model"],
                where: whereClause as any,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
                orderBy: { _sum: { estimatedCost: "desc" } },
            }),

            // 按请求类型分组
            prisma.aiUsageLog.groupBy({
                by: ["requestType"],
                where: whereClause as any,
                _sum: { totalTokens: true, estimatedCost: true },
                _count: { id: true },
            }),

            // 最近失败记录
            prisma.aiUsageLog.findMany({
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
        const failedCalls = await prisma.aiUsageLog.count({
            where: { ...whereClause as any, success: false },
        });
        const successRate = totalCalls > 0
            ? ((totalCalls - failedCalls) / totalCalls * 100).toFixed(1)
            : "100.0";

        return NextResponse.json({
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
            byProvider: byProvider.map(p => ({
                provider: p.provider,
                calls: p._count.id,
                totalTokens: p._sum.totalTokens || 0,
                cost: (p._sum.estimatedCost || 0).toFixed(4),
            })),
            byModel: byModel.map(m => ({
                model: m.model,
                calls: m._count.id,
                totalTokens: m._sum.totalTokens || 0,
                cost: (m._sum.estimatedCost || 0).toFixed(4),
            })),
            byType: byType.map(t => ({
                type: t.requestType,
                calls: t._count.id,
                totalTokens: t._sum.totalTokens || 0,
                cost: (t._sum.estimatedCost || 0).toFixed(4),
            })),
            recentFailures,
            dailyCosts: (dailyCosts as Array<{ date: string; cost: number; count: number }>).map(d => ({
                date: d.date,
                cost: Number(d.cost).toFixed(4),
                calls: d.count,
            })),
        });
    } catch (error) {
        console.error("[Admin AI Costs] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch AI cost data" },
            { status: 500 }
        );
    }
});
