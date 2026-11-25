import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import {
    ADMIN_REPORT_QUALITY_DAYS,
    getAdminReportQualitySummary,
} from "@/lib/admin-report-quality";
import { getAdminReportFeedbackSummary } from "@/lib/admin-report-feedback";

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

    const [summary, feedback, fallbacks] = await Promise.all([
        getAdminReportQualitySummary(),
        getAdminReportFeedbackSummary(),
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

    const targetTypeLabel = (value: string) => {
        if (value === "dimension") return "维度";
        if (value === "finding") return "问题";
        if (value === "report") return "整份报告";
        return value;
    };

    const verdictLabel = (value: string) => {
        if (value === "accurate") return "准确";
        if (value === "inaccurate") return "不准确";
        if (value === "unsure") return "不确定";
        return value;
    };

    const verdictTone = (value: string) => {
        if (value === "accurate") return "text-emerald-700 bg-emerald-50 border-emerald-200/60";
        if (value === "inaccurate") return "text-rose-700 bg-rose-50 border-rose-200/60";
        return "text-muted-foreground bg-brand-charcoal/[0.04] border-border/80";
    };

    const feedbackStats = [
        { label: "反馈总数", value: feedback.total.toLocaleString("zh-CN") },
        { label: "准确率（不含不确定）", value: feedback.total > 0 ? `${feedback.accuracyRate}%` : "—" },
        { label: "不准确", value: feedback.inaccurate.toLocaleString("zh-CN") },
        { label: "反馈用户", value: feedback.reporterCount.toLocaleString("zh-CN") },
    ];

    // 补齐没有反馈的日期：SQL 只返回有数据的日期，直接画图会压缩时间轴
    const trendByDate = new Map(feedback.trend.map((day) => [day.date, day]));
    const recentTrend = Array.from({ length: 14 }, (_, index) => {
        const date = new Date(now - (13 - index) * 24 * 60 * 60 * 1000);
        const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
        return trendByDate.get(key) ?? { date: key, accurate: 0, inaccurate: 0, unsure: 0 };
    });
    const trendMax = Math.max(
        1,
        ...recentTrend.map((day) => day.accurate + day.inaccurate + day.unsure)
    );

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
                <h1 className="text-xl font-semibold text-foreground">报告质量</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    近 {ADMIN_REPORT_QUALITY_DAYS} 天 · 聚焦 AI 文案与规则兜底比例、报告篇幅与有效维度覆盖
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border/80 bg-card p-4">
                        <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-medium text-foreground">用户反馈</h2>
                    <span className="text-[11px] text-muted-foreground/80">
                        近 {feedback.days} 天 · 来自结果页报告反馈
                    </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {feedbackStats.map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-border/80 bg-brand-charcoal/[0.015] p-3">
                            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                        <h3 className="text-xs font-medium text-foreground/75">被标记「不准确」最多的位置</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {feedback.topInaccurateTargets.length > 0 ? feedback.topInaccurateTargets.map((target) => (
                                <span
                                    key={`${target.targetType}:${target.targetKey}`}
                                    className="rounded-full border border-rose-200/60 bg-rose-50 px-3 py-1 text-xs text-rose-700"
                                >
                                    {targetTypeLabel(target.targetType)} · {target.targetKey} · {target.count}
                                </span>
                            )) : <span className="text-sm text-muted-foreground/80">暂无反馈</span>}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-medium text-foreground/75">近 14 天趋势</h3>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />准确</span>
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-400" />不准确</span>
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand-charcoal/25" />不确定</span>
                            </div>
                        </div>
                        {feedback.total > 0 ? (
                            <div className="mt-3 flex h-20 items-end gap-1">
                                {recentTrend.map((day) => (
                                    <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${day.date} · 准确 ${day.accurate} / 不准确 ${day.inaccurate} / 不确定 ${day.unsure}`}>
                                        <div className="flex w-full flex-col justify-end overflow-hidden rounded-sm bg-brand-charcoal/[0.04]" style={{ height: "64px" }}>
                                            <div className="w-full bg-emerald-500" style={{ height: `${(day.accurate / trendMax) * 64}px` }} />
                                            <div className="w-full bg-brand-charcoal/25" style={{ height: `${(day.unsure / trendMax) * 64}px` }} />
                                            <div className="w-full bg-rose-400" style={{ height: `${(day.inaccurate / trendMax) * 64}px` }} />
                                        </div>
                                        <span className="text-[9px] tabular-nums text-muted-foreground/80">{day.date.slice(5)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-muted-foreground/80">暂无反馈</p>
                        )}
                    </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-brand-charcoal/[0.06] pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <h3 className="text-xs font-medium text-foreground/75">反馈准确率 · 按文案来源</h3>
                        <div className="mt-2 space-y-1.5">
                            {feedback.byNarrativeSource.length > 0 ? feedback.byNarrativeSource.map((item) => (
                                <div key={item.source} className="flex items-center justify-between rounded-lg bg-brand-charcoal/[0.02] px-3 py-1.5 text-xs">
                                    <span className="text-muted-foreground">
                                        {item.source === "unknown" ? "未记录" : narrativeSourceLabel(item.source)}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">
                                        {item.accuracyRate}% 准确 · {item.total} 条
                                    </span>
                                </div>
                            )) : <span className="text-sm text-muted-foreground/80">暂无数据</span>}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-medium text-foreground/75">反馈准确率 · 按模型</h3>
                        <div className="mt-2 space-y-1.5">
                            {feedback.byModel.length > 0 ? feedback.byModel.map((item) => (
                                <div key={item.model} className="flex items-center justify-between rounded-lg bg-brand-charcoal/[0.02] px-3 py-1.5 text-xs">
                                    <span className="truncate text-muted-foreground">
                                        {item.model === "unknown" ? "未记录" : item.model}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {item.accuracyRate}% 准确 · {item.total} 条
                                    </span>
                                </div>
                            )) : <span className="text-sm text-muted-foreground/80">暂无数据</span>}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-medium text-foreground/75">反馈准确率 · 按 prompt 版本</h3>
                        <div className="mt-2 space-y-1.5">
                            {feedback.byPromptVersion.length > 0 ? feedback.byPromptVersion.map((item) => (
                                <div key={item.promptVersion} className="flex items-center justify-between rounded-lg bg-brand-charcoal/[0.02] px-3 py-1.5 text-xs">
                                    <span className="truncate text-muted-foreground">
                                        {item.promptVersion === "unknown" ? "未记录" : item.promptVersion}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {item.accuracyRate}% 准确 · {item.total} 条
                                    </span>
                                </div>
                            )) : <span className="text-sm text-muted-foreground/80">暂无数据</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
                <div className="border-b border-border/80 px-4 py-3 sm:px-6">
                    <h2 className="text-sm font-medium text-foreground">最近用户反馈</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-brand-charcoal/[0.03] text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 font-medium sm:px-6">时间</th>
                                <th className="px-4 py-2 font-medium">会话</th>
                                <th className="px-4 py-2 font-medium">位置</th>
                                <th className="px-4 py-2 font-medium">结论</th>
                                <th className="px-4 py-2 font-medium">备注</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70">
                            {feedback.recent.length > 0 ? feedback.recent.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-4 py-2 text-muted-foreground sm:px-6" title={`首次反馈：${row.createdAt.toLocaleString("zh-CN")}`}>
                                        {row.updatedAt.toLocaleString("zh-CN")}
                                    </td>
                                    <td className="max-w-[140px] truncate px-4 py-2 font-mono text-[11px] text-muted-foreground">{row.sessionId}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{targetTypeLabel(row.targetType)} · {row.targetKey}</td>
                                    <td className="px-4 py-2">
                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${verdictTone(row.verdict)}`}>
                                            {verdictLabel(row.verdict)}
                                        </span>
                                    </td>
                                    <td className="max-w-[240px] truncate px-4 py-2 text-muted-foreground" title={row.note || ""}>{row.note || "—"}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground/80">暂无用户反馈</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6">
                <h2 className="text-sm font-medium text-foreground">文案来源分布</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    {bySource.length > 0 ? bySource.map((item) => (
                        <span key={item.source} className="rounded-full border border-border/80 px-3 py-1 text-xs text-foreground/75">
                            {narrativeSourceLabel(item.source)} · {item.count}
                        </span>
                    )) : <span className="text-sm text-muted-foreground/80">暂无数据</span>}
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
                <div className="border-b border-border/80 px-4 py-3 sm:px-6">
                    <h2 className="text-sm font-medium text-foreground">最近规则兜底报告</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-brand-charcoal/[0.03] text-muted-foreground">
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
                        <tbody className="divide-y divide-border/70">
                            {recentFallbacks.length > 0 ? recentFallbacks.map((row) => (
                                <tr key={row.sessionId}>
                                    <td className="px-4 py-2 text-muted-foreground sm:px-6">{row.createdAt.toLocaleString("zh-CN")}</td>
                                    <td className="max-w-[140px] truncate px-4 py-2 font-mono text-[11px] text-muted-foreground">{row.sessionId}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{row.model || "—"}</td>
                                    <td className="max-w-[260px] truncate px-4 py-2 text-muted-foreground" title={row.fallbackReason || ""}>{row.fallbackReason || "—"}</td>
                                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.diagnosisFindingCount}</td>
                                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.issueCount}</td>
                                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : "—"}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground/80">暂无规则兜底记录</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
