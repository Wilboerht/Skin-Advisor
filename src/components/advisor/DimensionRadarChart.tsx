"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";
import { useMounted } from "@/hooks/use-mounted";
import type { SkinDimensions } from "@/lib/advisor-labels";
import { DIMENSION_DESCRIPTIONS, DIMENSION_LABELS, DIMENSION_ORDER, SCORE_DIRECTION_HINT } from "@/lib/advisor-labels";
import { ATTENTION_SCORE_THRESHOLD, getScoreBand, isAttentionScore } from "@/lib/score-bands";
import { ReportFeedbackButton } from "./ReportFeedbackButton";

interface DimensionRadarChartProps {
    dimensions: SkinDimensions;
    /** 报告会话 ID：维度判读纠错 */
    sessionId?: string;
}

function AlertTick(props: {
    x?: number;
    y?: number;
    payload?: { value?: string };
    textAnchor?: "start" | "middle" | "end";
    scoreMap: Record<string, number | undefined>;
}) {
    const label = props.payload?.value ?? "";
    const score = props.scoreMap[label];
    const alert = isAttentionScore(score);

    return (
        <text x={props.x} y={props.y} textAnchor={props.textAnchor} fill="#7a6552" fontSize={11} fontWeight={500}>
            <tspan>{label}</tspan>
            {alert && (
                <tspan fill="#b06a3b" fontSize={9} fontWeight={600} dx={2} dy={0.5}>
                    需关注
                </tspan>
            )}
        </text>
    );
}

/**
 * 十维评分雷达图：报告页数据总览。
 * - 不可见维度不参与雷达图；低置信维度在明细中标注；
 * - 统一“低于 70 需关注”阈值；
 * - 提供文字明细，可展开查看 AI 的视觉判读依据与 acne 子分。
 */
export function DimensionRadarChart({ dimensions, sessionId }: DimensionRadarChartProps) {
    const mounted = useMounted();
    const reduceMotion = useReducedMotion();

    const allRows = useMemo(
        () => DIMENSION_ORDER.map((key) => {
            const dim = dimensions[key];
            return {
                key,
                label: DIMENSION_LABELS[key],
                description: DIMENSION_DESCRIPTIONS[key],
                score: typeof dim?.score === "number" ? dim.score : undefined,
                confidence: typeof dim?.confidence === "number" ? dim.confidence : undefined,
                notVisible: dim?.notVisible === true,
                details: typeof dim?.details === "string" && dim.details.trim() ? dim.details.trim() : undefined,
                blackheads: typeof dim?.blackheads === "number" ? dim.blackheads : undefined,
                pimples: typeof dim?.pimples === "number" ? dim.pimples : undefined,
            };
        }),
        [dimensions]
    );

    const chartData = useMemo(
        () => allRows
            .filter((row) => typeof row.score === "number" && !row.notVisible)
            .map((row) => ({ key: row.key, label: row.label, score: row.score as number })),
        [allRows]
    );

    const scoreMap = useMemo(
        () => Object.fromEntries(chartData.map((row) => [row.label, row.score])),
        [chartData]
    );

    if (!mounted) {
        return <div className="w-full" style={{ height: 320 }} aria-hidden="true" />;
    }

    if (chartData.length < 3) {
        return (
            <div className="rounded-xl border border-dashed border-[var(--color-brand-espresso)]/20 bg-white/50 px-4 py-6 text-center">
                <p className="text-sm text-[var(--color-brand-cocoa)]">本次可判断的维度不足，暂不展示雷达图。</p>
                <p className="mt-1 text-xs text-[var(--color-brand-taupe)]">建议在自然光下素颜重拍，或直接查看下方文字明细。</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--color-brand-taupe)]">{SCORE_DIRECTION_HINT}；低于 {ATTENTION_SCORE_THRESHOLD} 分标为需关注。</p>
            </div>
            <div className="w-full" style={{ height: 320 }} role="img" aria-label="十维肌肤评分雷达图">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={chartData} outerRadius="72%" margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
                        <PolarGrid stroke="#5c4937" strokeOpacity={0.12} />
                        <PolarAngleAxis dataKey="label" tick={<AlertTick scoreMap={scoreMap} />} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                            dataKey="score"
                            stroke="#8B7355"
                            strokeWidth={2}
                            fill="#8B7355"
                            fillOpacity={0.22}
                            isAnimationActive={!reduceMotion}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* 文字明细：分数/档位 + 可展开的 AI 视觉判读与 acne 子分 */}
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="十维评分明细">
                {allRows.map((row) => {
                    const band = getScoreBand(row.score);
                    const lowConfidence = typeof row.confidence === "number" && row.confidence < 0.5;
                    const hasExtra = !row.notVisible && (
                        !!row.details
                        || (row.key === "acne" && (row.blackheads !== undefined || row.pimples !== undefined))
                    );

                    const summaryContent = (
                        <>
                            <span className="text-[12px] text-[var(--color-brand-espresso)]">{row.label}</span>
                            <span className="flex items-center gap-1.5 text-[11px]">
                                {row.notVisible ? (
                                    <span className="text-[var(--color-brand-taupe)]">图片不足以判断</span>
                                ) : (
                                    <>
                                        <span className="tabular-nums font-medium text-[var(--color-brand-espresso)]">
                                            {typeof row.score === "number" ? `${row.score} 分` : "—"}
                                        </span>
                                        {band && (
                                            <span
                                                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                                style={{ color: band.color, background: band.background }}
                                            >
                                                {band.label}
                                            </span>
                                        )}
                                        {lowConfidence && (
                                            <span className="rounded-full bg-[var(--color-brand-taupe)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-brand-taupe)]">
                                                置信度低
                                            </span>
                                        )}
                                    </>
                                )}
                            </span>
                        </>
                    );

                    return (
                        <li
                            key={row.key}
                            title={row.description}
                            className="rounded-lg border border-[var(--color-brand-espresso)]/10 bg-white/60"
                        >
                            {hasExtra ? (
                                <details className="group">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                                        {summaryContent}
                                        <ChevronDown
                                            className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-taupe)] transition-transform group-open:rotate-180"
                                            strokeWidth={1.8}
                                        />
                                    </summary>
                                    <div className="border-t border-dashed border-[var(--color-brand-espresso)]/10 px-3 py-2 text-[11px] leading-relaxed text-[var(--color-brand-cocoa)]">
                                        {row.details && <p>{row.details}</p>}
                                        {row.key === "acne" && (row.blackheads !== undefined || row.pimples !== undefined) && (
                                            <p className={row.details ? "mt-1.5" : undefined}>
                                                黑头/闭口 {row.blackheads ?? "—"} 分 · 炎性痘痘 {row.pimples ?? "—"} 分
                                            </p>
                                        )}
                                        <div className="mt-1.5 flex justify-end">
                                            <ReportFeedbackButton
                                                sessionId={sessionId}
                                                targetType="dimension"
                                                targetKey={row.key}
                                            />
                                        </div>
                                    </div>
                                </details>
                            ) : (
                                <div className="flex items-center justify-between gap-3 px-3 py-2">
                                    {summaryContent}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default DimensionRadarChart;
