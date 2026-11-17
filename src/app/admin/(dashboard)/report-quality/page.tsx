import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import {
    ADMIN_REPORT_QUALITY_DAYS,
    getAdminReportQualitySummary,
} from "@/lib/admin-report-quality";

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
    const now = Date.now();
    const since = new Date(
        now - ADMIN_REPORT_QUALITY_DAYS * 24 * 60 * 60 * 1000
    );

    const [summary, fallbacks] = await Promise.all([
        getAdminReportQualitySummary(),
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

    const total = summary.totalReports;
    const fallback = summary.fallback;
    const avgDuration = Math.round(summary.avgDurationMs);
    const avgFindings = Math.round(summary.avgDiagnosisFindingCount * 10) / 10;
    const avgIssues = Math.round(summary.avgIssueCount * 10) / 10;
    const avgCoverage = Math.round(summary.avgCoverageScored * 10) / 10;
    const avgQueue = Math.round(summary.avgQueueWaitMs);
    const avgText = Math.round(summary.avgTextGenerationMs);
    const avgProduct = Math.round(summary.avgProductSelectionMs);
    const avgPersist = Math.round(summary.avgPersistMs);
    const bySource = summary.bySource;
    const recentFallbacks = fallbacks;

    const narrativeSourceLabel = (value: string) => {
        if (value === "ai") return "AI 文案";
        if (value === "fallback") return "规则兜底";
        return value;
    };

    const stats = [
        { label: "报告总数", value: total.toLocaleString("zh-CN") },
        { label: "AI 文案", value: pct(total - fallback, total) },
        { label: "规则兜底", value: pct(fallback, total) },
        { label: "平均耗时", value: avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : "—" },
        { label: "平均队列", value: avgQueue > 0 ? `${(avgQueue / 1000).toFixed(1)}s` : "—" },
        { label: "平均文本", value: avgText > 0 ? `${(avgText / 1000).toFixed(1)}s` : "—" },
        { label: "平均产品", value: avgProduct > 0 ? `${(avgProduct / 1000).toFixed(1)}s` : "—" },
        { label: "平均落库", value: avgPersist > 0 ? `${(avgPersist / 1000).toFixed(2)}s` : "—" },
        { label: "平均 findings", value: avgFindings > 0 ? String(avgFindings) : "—" },
        { label: "平均 issues", value: avgIssues > 0 ? String(avgIssues) : "—" },
        { label: "平均有效维度", value: avgCoverage > 0 ? String(avgCoverage) : "—" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-brand-charcoal">报告质量</h1>
                <p className="mt-1 text-sm text-brand-charcoal/60">
                    近 {ADMIN_REPORT_QUALITY_DAYS} 天 · 聚焦 AI 文案与规则兜底比例、报告篇幅与有效维度覆盖
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-brand-charcoal/10 bg-white p-4">
                        <p className="text-[11px] text-brand-charcoal/50">{stat.label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-brand-charcoal">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-brand-charcoal/10 bg-white p-4 sm:p-6">
                <h2 className="text-sm font-medium text-brand-charcoal">文案来源分布</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    {bySource.length > 0 ? bySource.map((item) => (
                        <span key={item.source} className="rounded-full border border-brand-charcoal/10 px-3 py-1 text-xs text-brand-charcoal/70">
                            {narrativeSourceLabel(item.source)} · {item.count}
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
