import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "报告质量",
    description: "ReportV3 生成质量与兜底比例（近 30 天）",
    robots: { index: false, follow: false },
};

function pct(value: number, total: number): string {
    if (total <= 0) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
}

export default async function ReportQualityPage() {
    // Server Component 每次请求生成；动态管理页允许使用当前时间
    // eslint-disable-next-line react-hooks/purity
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let total = 0;
    let fallback = 0;
    let avgDuration = 0;
    let avgFindings = 0;
    let avgIssues = 0;
    let avgCoverage = 0;
    let bySource: Array<{ narrativeSource: string; _count: { id: number } }> = [];
    let recentFallbacks: Array<{
        sessionId: string;
        model: string | null;
        fallbackReason: string | null;
        diagnosisFindingCount: number;
        issueCount: number;
        durationMs: number | null;
        createdAt: Date;
    }> = [];

    try {
        const [aggregate, sourceGroups, fallbacks] = await Promise.all([
            prisma.reportQualityLog.aggregate({
                where: { createdAt: { gte: since } },
                _count: { id: true },
                _avg: {
                    durationMs: true,
                    diagnosisFindingCount: true,
                    issueCount: true,
                    coverageScored: true,
                },
            }),
            prisma.reportQualityLog.groupBy({
                by: ["narrativeSource"],
                where: { createdAt: { gte: since } },
                _count: { id: true },
            }),
            prisma.reportQualityLog.findMany({
                where: { createdAt: { gte: since }, narrativeSource: "fallback" },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                    sessionId: true,
                    model: true,
                    fallbackReason: true,
                    diagnosisFindingCount: true,
                    issueCount: true,
                    durationMs: true,
                    createdAt: true,
                },
            }),
        ]);
        total = aggregate._count.id;
        fallback = sourceGroups.find((item) => item.narrativeSource === "fallback")?._count.id ?? 0;
        avgDuration = Math.round(aggregate._avg.durationMs ?? 0);
        avgFindings = Math.round((aggregate._avg.diagnosisFindingCount ?? 0) * 10) / 10;
        avgIssues = Math.round((aggregate._avg.issueCount ?? 0) * 10) / 10;
        avgCoverage = Math.round((aggregate._avg.coverageScored ?? 0) * 10) / 10;
        bySource = sourceGroups;
        recentFallbacks = fallbacks;
    } catch (error) {
        logger.error("[AdminReportQuality] aggregate failed", { error: String(error) });
    }

    const stats = [
        { label: "报告总数", value: total.toLocaleString("zh-CN") },
        { label: "AI 文案", value: pct(total - fallback, total) },
        { label: "规则兜底", value: pct(fallback, total) },
        { label: "平均耗时", value: avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : "—" },
        { label: "平均 findings", value: avgFindings > 0 ? String(avgFindings) : "—" },
        { label: "平均 issues", value: avgIssues > 0 ? String(avgIssues) : "—" },
        { label: "平均有效维度", value: avgCoverage > 0 ? String(avgCoverage) : "—" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-brand-charcoal">报告质量</h1>
                <p className="mt-1 text-sm text-brand-charcoal/60">
                    近 30 天 · 聚焦 AI 文案与规则兜底比例、报告篇幅与有效维度覆盖
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-brand-charcoal/10 bg-white p-4">
                        <p className="text-[11px] text-brand-charcoal/50">{stat.label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-brand-charcoal">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-brand-charcoal/10 bg-white p-4 sm:p-6">
                <h2 className="text-sm font-medium text-brand-charcoal">兜底原因分布</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    {bySource.length > 0 ? bySource.map((item) => (
                        <span key={item.narrativeSource} className="rounded-full border border-brand-charcoal/10 px-3 py-1 text-xs text-brand-charcoal/70">
                            {item.narrativeSource} · {item._count.id}
                        </span>
                    )) : <span className="text-sm text-brand-charcoal/45">暂无数据</span>}
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-brand-charcoal/10 bg-white">
                <div className="border-b border-brand-charcoal/10 px-4 py-3 sm:px-6">
                    <h2 className="text-sm font-medium text-brand-charcoal">最近规则兜底报告</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-brand-charcoal/[0.03] text-brand-charcoal/50">
                            <tr>
                                <th className="px-4 py-2 font-medium sm:px-6">时间</th>
                                <th className="px-4 py-2 font-medium">会话</th>
                                <th className="px-4 py-2 font-medium">模型</th>
                                <th className="px-4 py-2 font-medium">原因</th>
                                <th className="px-4 py-2 font-medium">findings</th>
                                <th className="px-4 py-2 font-medium">issues</th>
                                <th className="px-4 py-2 font-medium">耗时</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-charcoal/[0.06]">
                            {recentFallbacks.length > 0 ? recentFallbacks.map((row) => (
                                <tr key={row.sessionId}>
                                    <td className="px-4 py-2 text-brand-charcoal/60 sm:px-6">{row.createdAt.toLocaleString("zh-CN")}</td>
                                    <td className="max-w-[140px] truncate px-4 py-2 font-mono text-[11px] text-brand-charcoal/60">{row.sessionId}</td>
                                    <td className="px-4 py-2 text-brand-charcoal/60">{row.model || "—"}</td>
                                    <td className="max-w-[260px] truncate px-4 py-2 text-brand-charcoal/60" title={row.fallbackReason || ""}>{row.fallbackReason || "—"}</td>
                                    <td className="px-4 py-2 tabular-nums text-brand-charcoal/60">{row.diagnosisFindingCount}</td>
                                    <td className="px-4 py-2 tabular-nums text-brand-charcoal/60">{row.issueCount}</td>
                                    <td className="px-4 py-2 tabular-nums text-brand-charcoal/60">{row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : "—"}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-brand-charcoal/45">暂无规则兜底记录</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
