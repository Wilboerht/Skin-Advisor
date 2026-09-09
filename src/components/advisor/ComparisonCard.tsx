"use client";

import { motion } from "framer-motion";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import type { PreviousTestSummary } from "@/lib/analysis-result";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { useDiaryModal } from "@/components/website/DiaryModalContext";
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

// 变化量主视觉：当前绝对值由下方「专业版报告」卡承载，此卡只表达"较上次的变化"，
// 避免同屏重复展示当前分数/肌龄
function DeltaFigure({ delta, unit, goodWhenNegative = false }: { delta?: number; unit: string; goodWhenNegative?: boolean }) {
    if (delta === undefined) {
        return <span className="text-xl lg:text-2xl font-bold text-[var(--color-brand-charcoal)] leading-none">—</span>;
    }
    if (delta === 0) {
        return <span className="text-xl lg:text-2xl font-bold text-[var(--color-brand-charcoal)]/60 leading-none">持平</span>;
    }
    const good = goodWhenNegative ? delta < 0 : delta > 0;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-xl lg:text-2xl font-bold leading-none",
                good ? "text-[#3d7a4d]" : "text-[#c45a4a]"
            )}
        >
            {delta > 0 ? (
                <TrendingUp className="w-4 h-4" strokeWidth={2} />
            ) : (
                <TrendingDown className="w-4 h-4" strokeWidth={2} />
            )}
            {delta > 0 ? `+${delta}` : delta}
            <span className="text-[11px] font-normal text-[#7a6552]/70">{unit}</span>
        </span>
    );
}

export default function ComparisonCard({ prev, score, skinAge, persona, at }: ComparisonCardProps) {
    const { openDiaryModal } = useDiaryModal();
    const scoreDelta = score !== undefined && typeof prev.score === "number"
        ? Math.round(score - prev.score)
        : undefined;
    const skinAgeDelta = skinAge !== undefined && typeof prev.skinAge === "number"
        ? Math.round(skinAge - prev.skinAge)
        : undefined;
    const personaChanged = !!prev.persona && !!persona && prev.persona !== persona;

    const prevLabel = prev.persona ? getSkinTypeByIpKey(prev.persona)?.typeName ?? "未知肤质" : "—";
    const curLabel = persona ? getSkinTypeByIpKey(persona)?.typeName ?? "未知肤质" : "—";
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
                    <span className="relative z-10 inline-flex h-[24px] px-2 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/15 bg-transparent text-xs font-bold text-[var(--color-brand-charcoal)] lg:h-[26px] lg:px-2.5 lg:text-xs lg:tracking-wide lg:rounded-lg lg:border lg:border-[var(--color-brand-charcoal)]/30 whitespace-nowrap">
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
                {/* 护肤档案入口：历史测肤趋势的完整档案（未登录由弹层展示登录引导） */}
                <button
                    onClick={openDiaryModal}
                    className="inline-flex items-center gap-0.5 text-[12px] font-light tracking-[0.06em] text-[var(--color-brand-cocoa)]/70 hover:text-[var(--color-brand-cocoa)] transition-colors"
                    aria-label="打开护肤档案"
                >
                    护肤档案
                    <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
            </div>

            {/* 3 列数据：主数字为"较上次变化量"，当前绝对值见下方专业版报告卡，不重复展示 */}
            <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-4">
                <div className="rounded-xl p-3 lg:p-4 bg-[#F0EDE8] border border-brand-espresso/5">
                    <p className="text-[11px] text-[#7a6552] font-medium mb-1.5">综合评分</p>
                    <DeltaFigure delta={scoreDelta} unit="分" />
                    <p className="mt-1.5 text-[10px] text-[#7a6552]/70 font-light">
                        上次 {typeof prev.score === "number" ? Math.round(prev.score) : "—"} → 本次 {score !== undefined ? Math.round(score) : "—"}
                    </p>
                </div>

                <div className="rounded-xl p-3 lg:p-4 bg-[#EBE8E2] border border-brand-espresso/5">
                    <p className="text-[11px] text-[#7a6552] font-medium mb-1.5">肌肤年龄</p>
                    <DeltaFigure delta={skinAgeDelta} unit="岁" goodWhenNegative />
                    <p className="mt-1.5 text-[10px] text-[#7a6552]/70 font-light">
                        上次 {typeof prev.skinAge === "number" ? Math.round(prev.skinAge) : "—"} 岁 → 本次 {skinAge !== undefined ? Math.round(skinAge) : "—"} 岁
                    </p>
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
