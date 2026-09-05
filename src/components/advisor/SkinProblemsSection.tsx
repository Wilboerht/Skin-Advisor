"use client";

import { Lock } from "lucide-react";
import type { ProblemCardData } from "@/lib/problem-solutions";
import { cn } from "@/lib/utils";

const GRADE_BADGES: Record<string, { label: string; className: string }> = {
    poor: { label: "重点关注", className: "bg-red-100 text-red-700" },
    fair: { label: "需要改善", className: "bg-amber-100 text-amber-700" },
    average: { label: "轻度关注", className: "bg-gray-100 text-gray-600" },
};

const SEVERITY_BADGES: Record<string, { label: string; className: string }> = {
    severe: { label: "重度", className: "bg-red-100 text-red-700" },
    moderate: { label: "中度", className: "bg-amber-100 text-amber-700" },
    mild: { label: "轻度", className: "bg-gray-100 text-gray-600" },
};

function resolveBadge(card: ProblemCardData) {
    if (card.severity) {
        return SEVERITY_BADGES[card.severity] ?? SEVERITY_BADGES.mild;
    }
    return GRADE_BADGES[card.grade ?? ""] ?? GRADE_BADGES.average;
}

function Badge({ card }: { card: ProblemCardData }) {
    const badge = resolveBadge(card);
    return (
        <span
            className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                badge.className
            )}
        >
            {badge.label}
        </span>
    );
}

interface SkinProblemsSectionProps {
    cards: ProblemCardData[];
    authInitialized: boolean;
    isLoggedIn: boolean;
    onUnlock: () => void;
}

export function SkinProblemsSection({
    cards,
    authInitialized,
    isLoggedIn,
    onUnlock,
}: SkinProblemsSectionProps) {
    if (!authInitialized) {
        return <div className="mb-8 min-h-[200px]" />;
    }

    return (
        <div className="mb-8 space-y-4">
            {cards.map((card) =>
                card.tier === "full" ? (
                    <FullCard key={card.key} card={card} isLoggedIn={isLoggedIn} onUnlock={onUnlock} />
                ) : (
                    <CompactCard key={card.key} card={card} isLoggedIn={isLoggedIn} onUnlock={onUnlock} />
                )
            )}
        </div>
    );
}

function FullCard({
    card,
    isLoggedIn,
    onUnlock,
}: {
    card: ProblemCardData;
    isLoggedIn: boolean;
    onUnlock: () => void;
}) {
    return (
        <article className="rounded-xl border border-[var(--color-brand-espresso)]/15 bg-white/50 p-4 sm:p-5 shadow-sm">
            {/* 标题行：问题名 + 部位 + 分数/严重度徽章 */}
            <div className="flex items-center justify-between gap-3">
                <h5 className="text-sm font-semibold text-[var(--color-brand-espresso)]">
                    {card.label}
                    {card.area && (
                        <span className="ml-2 text-xs font-normal text-[#8A8A8A]">· {card.area}</span>
                    )}
                </h5>
                <div className="flex items-center gap-2 shrink-0">
                    {card.score !== undefined && (
                        <span className="text-sm font-bold text-[var(--color-brand-charcoal)]">
                            {card.score}
                            <span className="text-xs font-medium text-[#7a6552] ml-0.5">分</span>
                        </span>
                    )}
                    <Badge card={card} />
                </div>
            </div>

            {/* 问题描述：AI 个性化解读 */}
            <p className="mt-2 text-sm text-[var(--color-brand-cocoa)] leading-relaxed">
                {card.description}
            </p>

            {isLoggedIn ? (
                <>
                    {/* 成因 */}
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-[var(--color-brand-espresso)] tracking-wide">
                            可能成因
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg bg-[var(--color-brand-espresso)]/5 border border-[var(--color-brand-espresso)]/10 p-3">
                                <p className="text-[11px] font-medium text-[var(--color-brand-espresso)] mb-1.5">
                                    基础成因
                                </p>
                                <ul className="list-disc pl-4 space-y-1 text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                                    {card.basicCauses.map((cause, i) => (
                                        <li key={i}>{cause}</li>
                                    ))}
                                </ul>
                            </div>
                            {card.aggravatorGroups.length > 0 && (
                                <div className="rounded-lg bg-amber-50/60 border border-amber-200/50 p-3">
                                    <p className="text-[11px] font-medium text-amber-800 mb-1.5">
                                        这些习惯可能正在加重问题
                                    </p>
                                    <ul className="space-y-1.5">
                                        {card.aggravatorGroups.map((group) => (
                                            <li key={group.category} className="text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                                                <span className="inline-block rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium mr-1.5">
                                                    {group.label}
                                                </span>
                                                {group.items.join("；")}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 解决方案 */}
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-[var(--color-brand-espresso)] tracking-wide">
                            解决方案
                        </p>
                        <div className="mt-2 rounded-lg border border-[var(--color-brand-espresso)]/10 bg-[#FBF8F3] p-3">
                            <p className="text-[11px] font-medium text-[var(--color-brand-espresso)] mb-1.5">
                                护肤建议
                            </p>
                            <ol className="list-decimal pl-4 space-y-1 text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                                {card.skincareActions.map((action, i) => (
                                    <li key={i}>{action}</li>
                                ))}
                            </ol>
                        </div>
                        {card.lifestyleTipGroups.length > 0 && (
                            <ul className="mt-2 space-y-1.5">
                                {card.lifestyleTipGroups.map((group) => (
                                    <li key={group.category} className="text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                                        <span className="inline-block rounded bg-[var(--color-brand-cream)] border border-[var(--color-brand-espresso)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-brand-espresso)] mr-1.5">
                                            {group.label}
                                        </span>
                                        {group.items.join("；")}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : (
                /* 游客锁：仅遮成因与方案，分数和问题描述可见 */
                <div className="mt-4 rounded-xl border border-dashed border-[#C9A86C]/40 bg-gradient-to-br from-[#FBF8F3] to-[var(--color-brand-cream)] p-5 text-center">
                    <Lock className="w-6 h-6 text-[#C9A86C] mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-brand-cocoa)] mb-3 leading-relaxed">
                        登录后可解锁问题成因与专属解决方案
                    </p>
                    <button
                        onClick={onUnlock}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-brand-cocoa)] text-white text-xs font-medium hover:bg-[#4a3a2c] transition-colors"
                    >
                        立即登录解锁
                    </button>
                </div>
            )}
        </article>
    );
}

function CompactCard({
    card,
    isLoggedIn,
    onUnlock,
}: {
    card: ProblemCardData;
    isLoggedIn: boolean;
    onUnlock: () => void;
}) {
    return (
        <article className="rounded-xl border border-[var(--color-brand-espresso)]/10 bg-white/40 p-4 shadow-sm">
            {/* 标题行 */}
            <div className="flex items-center justify-between gap-3">
                <h5 className="text-sm font-medium text-[var(--color-brand-espresso)]">
                    {card.label}
                    {card.area && (
                        <span className="ml-2 text-xs font-normal text-[#8A8A8A]">· {card.area}</span>
                    )}
                </h5>
                <div className="flex items-center gap-2 shrink-0">
                    {card.score !== undefined && (
                        <span className="text-sm font-bold text-[var(--color-brand-charcoal)]">
                            {card.score}
                            <span className="text-xs font-medium text-[#7a6552] ml-0.5">分</span>
                        </span>
                    )}
                    <Badge card={card} />
                </div>
            </div>

            {/* 问题描述 */}
            <p className="mt-1.5 text-[13px] text-[var(--color-brand-cocoa)] leading-relaxed">
                {card.description}
            </p>

            {isLoggedIn ? (
                <div className="mt-3 border-t border-dashed border-[var(--color-brand-espresso)]/10 pt-2.5">
                    <p className="text-[11px] font-medium text-[var(--color-brand-espresso)] mb-1.5">
                        护理建议
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                        {card.skincareActions.map((action, i) => (
                            <li key={i}>{action}</li>
                        ))}
                    </ul>
                    {card.lifestyleTipGroups.length > 0 && (
                        <ul className="mt-2 space-y-1">
                            {card.lifestyleTipGroups.map((group) => (
                                <li key={group.category} className="text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                                    <span className="inline-block rounded bg-[var(--color-brand-cream)] border border-[var(--color-brand-espresso)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-brand-espresso)] mr-1.5">
                                        {group.label}
                                    </span>
                                    {group.items.join("；")}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                /* 游客锁（紧凑版） */
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#C9A86C]/40 bg-gradient-to-br from-[#FBF8F3] to-[var(--color-brand-cream)] px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-brand-cocoa)]">
                        <Lock className="w-3.5 h-3.5 text-[#C9A86C] shrink-0" />
                        登录解锁成因与专属方案
                    </span>
                    <button
                        onClick={onUnlock}
                        className="shrink-0 rounded-full bg-[var(--color-brand-cocoa)] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#4a3a2c] transition-colors"
                    >
                        登录解锁
                    </button>
                </div>
            )}
        </article>
    );
}

export default SkinProblemsSection;
