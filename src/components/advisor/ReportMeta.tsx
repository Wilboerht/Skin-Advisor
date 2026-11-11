"use client";

import { CalendarDays, Camera, CircleAlert, Layers } from "lucide-react";
import type { ComprehensiveResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { SKIN_STATE_LABELS } from "@/lib/skin-state";

interface ReportMetaProps {
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
}

function formatDate(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/**
 * 报告头信息：测肤日期 / 数据来源 / 拍摄状态 / 有效维度 / 图片质量。
 * 这些信息决定报告可信度，不能只藏在文件内部。
 */
export function ReportMeta({ result, faceAnalysis }: ReportMetaProps) {
    const date = formatDate(result.analyzedAt);
    const dataSourceLabel = result.dataSource === "questionnaire"
        ? "仅问卷（历史报告）"
        : "面部影像 + 问卷";
    const skinStateLabel = result.skinState ? SKIN_STATE_LABELS[result.skinState] : null;
    const scoring = faceAnalysis?.scoring;
    const coverage = scoring
        ? `基于 ${scoring.scoredDimensions}/${scoring.totalDimensions} 个有效维度`
        : null;
    const lowConfidenceCount = scoring?.lowConfidenceDimensions.length ?? 0;
    const notVisibleCount = scoring?.notVisibleDimensions.length ?? 0;
    const validationMessage = faceAnalysis?.validation && faceAnalysis.validation.isValid === false
        ? faceAnalysis.validation.message
        : null;

    return (
        <section className="rounded-2xl border border-[var(--color-brand-espresso)]/10 bg-white/55 px-4 py-3 lg:px-5 lg:py-4" aria-label="报告信息">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] lg:text-[12px] text-[var(--color-brand-cocoa)]">
                {date && (
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-[var(--color-brand-taupe)]" strokeWidth={1.8} />
                        测肤日期 {date}
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-[var(--color-brand-taupe)]" strokeWidth={1.8} />
                    {dataSourceLabel}
                </span>
                {skinStateLabel && (
                    <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-[var(--color-brand-taupe)]" strokeWidth={1.8} />
                        拍摄状态：{skinStateLabel}
                    </span>
                )}
                {coverage && (
                    <span className="inline-flex items-center gap-1.5">
                        {coverage}
                        {lowConfidenceCount > 0 ? ` · ${lowConfidenceCount} 维低置信` : ""}
                        {notVisibleCount > 0 ? ` · ${notVisibleCount} 维不可见` : ""}
                    </span>
                )}
            </div>
            {validationMessage && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#b06a3b]">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                    {validationMessage}
                </p>
            )}
        </section>
    );
}
