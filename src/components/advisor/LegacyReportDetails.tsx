"use client";

import { BookOpen } from "lucide-react";
import type { ComprehensiveResult } from "@/lib/analysis-result";

interface LegacyReportDetailsProps {
    result: ComprehensiveResult;
}

/**
 * v1 报告只读详情：旧版 analysis.details / lifestyleTips 仍然有价值，
 * 不再只显示“报告已升级”而把用户已有内容藏起来。
 */
export function LegacyReportDetails({ result }: LegacyReportDetailsProps) {
    const details = Array.isArray(result.analysis?.details) ? result.analysis.details : [];
    const tips = Array.isArray(result.analysis?.lifestyleTips) ? result.analysis.lifestyleTips : [];
    if (details.length === 0 && tips.length === 0) return null;

    return (
        <section aria-label="旧版报告详情">
            <h4 className="mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                旧版报告详情 <span className="text-xs lg:text-base">（Legacy Report）</span>
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
                {details.length > 0 && (
                    <div className="rounded-xl border border-[var(--color-brand-espresso)]/10 bg-white/65 p-4">
                        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-brand-espresso)]">
                            <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
                            分析详情
                        </p>
                        <ul className="space-y-1.5">
                            {details.map((item, index) => (
                                <li key={`legacy-detail-${index}`} className="text-[12px] leading-[1.75] text-[var(--color-brand-cocoa)]">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {tips.length > 0 && (
                    <div className="rounded-xl border border-[var(--color-brand-espresso)]/10 bg-white/65 p-4">
                        <p className="mb-2 text-[12px] font-medium text-[var(--color-brand-espresso)]">生活建议</p>
                        <ul className="space-y-1.5">
                            {tips.map((item, index) => (
                                <li key={`legacy-tip-${index}`} className="text-[12px] leading-[1.75] text-[var(--color-brand-cocoa)]">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}
