"use client";

import { ArrowRight, Sparkles, Target } from "lucide-react";
import type { ComprehensiveResult } from "@/lib/analysis-result";
import type { ConsultantIssue } from "@/lib/advisor-utils";

interface ReportSummaryProps {
    result: ComprehensiveResult;
}

const SEVERITY_LABELS: Record<ConsultantIssue["severity"], string> = {
    mild: "轻度",
    moderate: "中度",
    severe: "重度",
};

function firstSentence(text?: string): string {
    if (!text) return "";
    const trimmed = text.trim();
    const match = trimmed.match(/^[^。！？!?]{4,80}[。！？!?]?/);
    return (match?.[0] ?? trimmed).slice(0, 90);
}

/**
 * 报告顶部结论卡：整体底子 / 最需关注 / 先做这一步。
 * 让用户在第一屏就知道“我怎么样、先管什么、今天做什么”，而不是先读雷达图。
 */
export function ReportSummary({ result }: ReportSummaryProps) {
    const report = result.consultantReport;
    const topIssue = report?.issues?.[0];
    const overview = report?.overview || result.analysis.summary || "本次报告已生成，请查看下方详细分析。";
    const nextStep = (topIssue?.skincarePlan ? firstSentence(topIssue.skincarePlan) : "")
        || "先按下方每日方案完成基础清洁、保湿与防晒，4 周后复测对比。";

    return (
        <section className="rounded-2xl border border-[var(--color-brand-espresso)]/12 bg-gradient-to-br from-[#FBF8F3] to-[#F5F0E7] p-5 lg:p-6" aria-label="报告结论摘要">
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-[var(--color-brand-taupe)]">
                        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
                        整体底子
                    </p>
                    <p className="text-[13px] lg:text-sm leading-[1.8] text-[var(--color-brand-espresso)]">
                        {overview}
                    </p>
                </div>

                <div className="flex flex-col gap-1.5 lg:border-l lg:border-dashed lg:border-[var(--color-brand-espresso)]/15 lg:pl-4">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-[var(--color-brand-taupe)]">
                        <Target className="h-3.5 w-3.5" strokeWidth={1.8} />
                        最需关注
                    </p>
                    {topIssue ? (
                        <>
                            <p className="text-[13px] lg:text-sm font-medium leading-[1.7] text-[var(--color-brand-espresso)]">
                                {topIssue.title}
                                <span className="ml-1.5 rounded-full bg-[#b06a3b]/10 px-1.5 py-0.5 text-[10px] font-normal text-[#b06a3b]">
                                    {SEVERITY_LABELS[topIssue.severity]}
                                </span>
                            </p>
                            <p className="text-[12px] leading-[1.7] text-[var(--color-brand-cocoa)] line-clamp-2">
                                {firstSentence(topIssue.observation)}
                            </p>
                        </>
                    ) : (
                        <p className="text-[13px] leading-[1.7] text-[var(--color-brand-cocoa)]">
                            本次未发现需要重点关注的问题，保持基础护理即可。
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-1.5 lg:border-l lg:border-dashed lg:border-[var(--color-brand-espresso)]/15 lg:pl-4">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-[var(--color-brand-taupe)]">
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                        接下来先做
                    </p>
                    <p className="text-[13px] lg:text-sm leading-[1.8] text-[var(--color-brand-espresso)] line-clamp-4">
                        {nextStep}
                    </p>
                </div>
            </div>
        </section>
    );
}
