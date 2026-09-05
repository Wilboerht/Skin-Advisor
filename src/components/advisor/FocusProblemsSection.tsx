"use client";

import { ChevronDown, Lock } from "lucide-react";
import type { ConcernLevel, FocusProblemData } from "@/lib/problem-solutions";
import { cn } from "@/lib/utils";

const LEVEL_BADGES: Record<ConcernLevel, { label: string; className: string }> = {
    severe: { label: "重度", className: "bg-red-100 text-red-700" },
    moderate: { label: "中度", className: "bg-amber-100 text-amber-700" },
    mild: { label: "轻度", className: "bg-gray-100 text-gray-600" },
};

const LEVEL_BAR_COLORS: Record<ConcernLevel, string> = {
    severe: "bg-red-500",
    moderate: "bg-amber-500",
    mild: "bg-[var(--color-brand-cocoa)]",
};

interface FocusProblemsSectionProps {
    problems: FocusProblemData[];
    authInitialized: boolean;
    isLoggedIn: boolean;
    onUnlock: () => void;
}

export function FocusProblemsSection({
    problems,
    authInitialized,
    isLoggedIn,
    onUnlock,
}: FocusProblemsSectionProps) {
    if (!authInitialized) {
        return <div className="mb-8 min-h-[200px]" />;
    }

    if (problems.length === 0) {
        return (
            <p className="text-sm text-[var(--color-brand-cocoa)] mb-8 leading-relaxed">
                未检测到明显问题，您的肌肤状态良好，请继续保持现有护理习惯。
            </p>
        );
    }

    return (
        <div className="mb-8 space-y-4">
            {problems.map((problem) =>
                problem.level === "mild" ? (
                    <MildCard key={problem.key} problem={problem} isLoggedIn={isLoggedIn} onUnlock={onUnlock} />
                ) : (
                    <FullCard key={problem.key} problem={problem} isLoggedIn={isLoggedIn} onUnlock={onUnlock} />
                )
            )}
        </div>
    );
}

function CardHeader({ problem, chevron }: { problem: FocusProblemData; chevron?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h5 className="text-sm font-semibold text-[var(--color-brand-espresso)]">
                {problem.name}
                {problem.area && (
                    <span className="ml-2 text-xs font-normal text-[#8A8A8A]">· {problem.area}</span>
                )}
            </h5>
            <div className="flex items-center gap-2 shrink-0">
                {problem.score !== undefined && (
                    <span className="text-sm font-bold text-[var(--color-brand-charcoal)]">
                        {problem.score}
                        <span className="text-xs font-medium text-[#7a6552] ml-0.5">分</span>
                    </span>
                )}
                <span
                    className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        LEVEL_BADGES[problem.level].className
                    )}
                >
                    {LEVEL_BADGES[problem.level].label}
                </span>
                {chevron && (
                    <ChevronDown className="w-4 h-4 text-[#8A8A8A] transition-transform duration-200 group-open:rotate-180" />
                )}
            </div>
        </div>
    );
}

function CardBody({ problem, isLoggedIn, onUnlock }: { problem: FocusProblemData; isLoggedIn: boolean; onUnlock: () => void }) {
    return (
        <>
            {/* 程度量化进度条 */}
            {problem.score !== undefined && (
                <div className="mt-2 h-1.5 w-full rounded-full bg-[#E8E2D9] overflow-hidden">
                    <div
                        className={cn("h-full rounded-full", LEVEL_BAR_COLORS[problem.level])}
                        style={{ width: `${problem.score}%` }}
                    />
                </div>
            )}
            {problem.detected && (
                <p className="mt-1.5 text-[11px] text-[#8A8A8A]">AI 面部检测确认存在</p>
            )}

            {/* 问题描述 */}
            <p className="mt-2 text-sm text-[var(--color-brand-cocoa)] leading-relaxed">
                {problem.description}
            </p>

            {isLoggedIn ? (
                <>
                    {/* 成因科普 */}
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-[var(--color-brand-espresso)] tracking-wide">
                            成因
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg bg-[var(--color-brand-espresso)]/5 border border-[var(--color-brand-espresso)]/10 p-3">
                                <p className="text-[11px] font-medium text-[var(--color-brand-espresso)] mb-1.5">
                                    基础成因
                                </p>
                                <ul className="list-disc pl-4 space-y-1 text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                                    {problem.basicCauses.map((cause, i) => (
                                        <li key={i}>{cause}</li>
                                    ))}
                                </ul>
                            </div>
                            {problem.aggravatorGroups.length > 0 && (
                                <div className="rounded-lg bg-amber-50/60 border border-amber-200/50 p-3">
                                    <p className="text-[11px] font-medium text-amber-800 mb-1.5">
                                        不良因素影响加量
                                    </p>
                                    <ul className="space-y-1.5">
                                        {problem.aggravatorGroups.map((group) => (
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

                    {/* 解决方法：六类分组 */}
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-[var(--color-brand-espresso)] tracking-wide">
                            解决方法
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {problem.solutionGroups.map((group) => (
                                <div
                                    key={group.category}
                                    className={cn(
                                        "rounded-lg border p-3",
                                        group.category === "skincare"
                                            ? "border-[var(--color-brand-espresso)]/10 bg-[#FBF8F3] sm:col-span-2"
                                            : "border-[var(--color-brand-espresso)]/10 bg-white/60"
                                    )}
                                >
                                    <p className="text-[11px] font-medium text-[var(--color-brand-espresso)] mb-1.5">
                                        {group.label}
                                    </p>
                                    <ul className="list-disc pl-4 space-y-1 text-xs text-[var(--color-brand-cocoa)] leading-relaxed">
                                        {group.items.map((item, i) => (
                                            <li key={i}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                /* 游客锁：仅遮成因与解决方案，问题与程度可见 */
                <div className="mt-4 rounded-xl border border-dashed border-[#C9A86C]/40 bg-gradient-to-br from-[#FBF8F3] to-[var(--color-brand-cream)] p-5 text-center">
                    <Lock className="w-6 h-6 text-[#C9A86C] mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-brand-cocoa)] mb-3 leading-relaxed">
                        登录后可解锁成因科普与专属解决方案
                    </p>
                    <button
                        onClick={onUnlock}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-brand-cocoa)] text-white text-xs font-medium hover:bg-[#4a3a2c] transition-colors"
                    >
                        立即登录解锁
                    </button>
                </div>
            )}
        </>
    );
}

function FullCard({ problem, isLoggedIn, onUnlock }: { problem: FocusProblemData; isLoggedIn: boolean; onUnlock: () => void }) {
    return (
        <article className="rounded-xl border border-[var(--color-brand-espresso)]/15 bg-white/50 p-4 sm:p-5 shadow-sm">
            <CardHeader problem={problem} />
            <CardBody problem={problem} isLoggedIn={isLoggedIn} onUnlock={onUnlock} />
        </article>
    );
}

function MildCard({ problem, isLoggedIn, onUnlock }: { problem: FocusProblemData; isLoggedIn: boolean; onUnlock: () => void }) {
    return (
        <details className="group rounded-xl border border-[var(--color-brand-espresso)]/10 bg-white/40 p-4 shadow-sm">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <CardHeader problem={problem} chevron />
            </summary>
            <div className="mt-2">
                <CardBody problem={problem} isLoggedIn={isLoggedIn} onUnlock={onUnlock} />
            </div>
        </details>
    );
}

export default FocusProblemsSection;
