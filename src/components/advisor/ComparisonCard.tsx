"use client";

import { motion } from "framer-motion";
import { CalendarDays, TrendingDown, TrendingUp } from "lucide-react";
import type { PreviousTestSummary } from "@/lib/analysis-result";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { cn } from "@/lib/utils";

interface ComparisonCardProps {
    prev: PreviousTestSummary;
    score?: number;
    skinAge?: number;
    persona?: string;
    /** 本次分析完成时间（ISO），用于与 prev.at 计算间隔 */
    at?: string;
}

function formatDate(iso?: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function daysBetween(end?: string | null, start?: string | null): number | null {
    if (!end || !start) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
    const days = Math.floor((e - s) / 86400000);
    return days > 0 ? days : null;
}

function DeltaBadge({ delta, goodWhenNegative = false }: { delta?: number; goodWhenNegative?: boolean }) {
    if (delta === undefined) return null;
    if (delta === 0) {
        return <span className="text-[11px] text-[var(--color-brand-cocoa)]/50">持平</span>;
    }
    const good = goodWhenNegative ? delta < 0 : delta > 0;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium",
                good ? "text-[#3d7a4d]" : "text-[#c45a4a]"
            )}
        >
            {good ? (
                <TrendingUp className="w-3 h-3" strokeWidth={2} />
            ) : (
                <TrendingDown className="w-3 h-3" strokeWidth={2} />
            )}
            {delta > 0 ? `+${delta}` : delta}
        </span>
    );
}

export default function ComparisonCard({ prev, score, skinAge, persona, at }: ComparisonCardProps) {
    const scoreDelta = score !== undefined && typeof prev.score === "number"
        ? score - prev.score
        : undefined;
    const skinAgeDelta = skinAge !== undefined && typeof prev.skinAge === "number"
        ? skinAge - prev.skinAge
        : undefined;
    const personaChanged = !!prev.persona && !!persona && prev.persona !== persona;

    const prevLabel = prev.persona ? getSkinTypeByIpKey(prev.persona)?.typeName || prev.persona : "—";
    const curLabel = persona ? getSkinTypeByIpKey(persona)?.typeName || persona : "—";
    const prevDate = formatDate(prev.at);
    const gapDays = daysBetween(at, prev.at);

    // 结论文案：派系变化 > 评分变化 > 肌肤年龄 > 稳定
    const conclusions: string[] = [];
    if (personaChanged) {
        conclusions.push(`你的派系已从「${prevLabel}」切换为「${curLabel}」`);
    }
    if (scoreDelta !== undefined && scoreDelta > 0) conclusions.push(`综合评分提升 ${scoreDelta} 分`);
    if (scoreDelta !== undefined && scoreDelta < 0) conclusions.push(`综合评分回落 ${Math.abs(scoreDelta)} 分`);
    if (skinAgeDelta !== undefined && skinAgeDelta < 0) conclusions.push(`肌肤年轻了 ${Math.abs(skinAgeDelta)} 岁`);
    if (skinAgeDelta !== undefined && skinAgeDelta > 0) conclusions.push(`肌肤年龄增加 ${skinAgeDelta} 岁，值得关注`);
    if (conclusions.length === 0) conclusions.push("整体肌肤状态保持稳定");
    const conclusion = conclusions.join("；");

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.45 }}
            className="relative rounded-[20px] lg:rounded-[24px] p-5 lg:p-7 border border-brand-espresso/8"
            style={{ background: "#F5F2ED" }}
            aria-label="与上次测肤对比"
        >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <span className="inline-flex h-[22px] px-2 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/15 text-[11px] font-bold text-[var(--color-brand-charcoal)]">
                        趋势对比
                    </span>
                    <span className="text-[13px] text-[var(--color-brand-cocoa)]">
                        {gapDays !== null && prevDate
                            ? `距上次测肤 ${gapDays} 天 · ${prevDate}`
                            : prevDate
                                ? `上次测肤 · ${prevDate}`
                                : "与上次测肤对比"}
                    </span>
                </div>
                <CalendarDays className="w-4 h-4 text-[var(--color-brand-taupe)]" strokeWidth={1.5} aria-hidden="true" />
            </div>

            {/* 3 列数据 */}
            <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-4">
                <div className="rounded-xl p-3 lg:p-4 bg-[#F0EDE8] border border-brand-espresso/5">
                    <p className="text-[11px] text-[#7a6552] font-medium mb-1.5">综合评分</p>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-xl lg:text-2xl font-bold text-[var(--color-brand-charcoal)] leading-none">
                            {score !== undefined ? score : "—"}
                        </span>
                        <DeltaBadge delta={scoreDelta} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#7a6552]/70 font-light">上次 {prev.score ?? "—"}</p>
                </div>

                <div className="rounded-xl p-3 lg:p-4 bg-[#EBE8E2] border border-brand-espresso/5">
                    <p className="text-[11px] text-[#7a6552] font-medium mb-1.5">肌肤年龄</p>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-xl lg:text-2xl font-bold text-[var(--color-brand-charcoal)] leading-none">
                            {skinAge !== undefined ? skinAge : "—"}
                        </span>
                        <span className="text-[11px] text-[#7a6552]/70">岁</span>
                        <DeltaBadge delta={skinAgeDelta} goodWhenNegative />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#7a6552]/70 font-light">上次 {prev.skinAge ?? "—"} 岁</p>
                </div>

                <div className="rounded-xl p-3 lg:p-4 bg-[#E6E2DA] border border-brand-espresso/5">
                    <p className="text-[11px] text-[#7a6552] font-medium mb-1.5">派系</p>
                    <p className="text-sm lg:text-base font-bold text-[var(--color-brand-charcoal)] leading-tight">
                        {curLabel}
                    </p>
                    <p className="mt-1.5 text-[10px] text-[#7a6552]/70 font-light">上次 {prevLabel}</p>
                </div>
            </div>

            {/* 一句话结论 */}
            <p className="text-[13px] leading-relaxed text-[var(--color-brand-cocoa)] border-t border-dashed border-[var(--color-brand-espresso)]/10 pt-3">
                {conclusion}
            </p>
        </motion.div>
    );
}
