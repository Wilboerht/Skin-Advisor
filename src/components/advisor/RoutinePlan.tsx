"use client";

import { Info, Moon, Sparkles, Sun } from "lucide-react";
import type { ConsultantIssue } from "@/lib/advisor-utils";
import type { RoutinePlan as RoutinePlanData, RoutineStep } from "@/lib/routine-plan";

interface RoutinePlanProps {
    plan: RoutinePlanData | null;
    /** AI 本次个性化调整（v2 起不再丢弃） */
    routineNote?: string;
    /** 无派系骨架时的兜底：按问题护理方案展示 */
    issues?: ConsultantIssue[];
}

function StepList({ steps, tone }: { steps: RoutineStep[]; tone: "morning" | "night" }) {
    if (steps.length === 0) {
        return <p className="text-[12px] text-[var(--color-brand-taupe)]">暂无步骤</p>;
    }
    return (
        <ol className="space-y-2.5">
            {steps.map((step, index) => (
                <li key={`${tone}-${index}-${step.text}`} className="flex gap-2.5">
                    <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                            tone === "morning" ? "bg-[#C9A86C]/15 text-[#8B6914]" : "bg-[#22364B]/10 text-[#22364B]/70"
                        }`}
                    >
                        {index + 1}
                    </span>
                    <div className="min-w-0">
                        <p className="text-[13px] leading-[1.7] text-[var(--color-brand-espresso)]">{step.text}</p>
                        {step.productName && (
                            <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-[var(--color-brand-cocoa)]">
                                <Sparkles className="h-2.5 w-2.5 shrink-0 text-[#C9A86C]" strokeWidth={2} />
                                <span className="truncate">{step.productName}</span>
                            </p>
                        )}
                        {step.howToUse && (
                            <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-brand-taupe)] line-clamp-2">
                                {step.howToUse}
                            </p>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
}

/**
 * 单一事实源的 AM/PM 行动表：派系骨架 + 推荐产品 + AI routineNote。
 * 取代原先“问题卡方案 / 派系早晚文案 / 产品推荐”三套互不对应的方案。
 */
export function RoutinePlan({ plan, routineNote, issues }: RoutinePlanProps) {
    const fallbackPlans = (issues ?? []).filter((issue) => issue.skincarePlan?.trim());

    if (!plan && fallbackPlans.length === 0) return null;

    return (
        <section aria-label="每日护理方案">
            <h4 className="mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                你的每日方案 <span className="text-xs lg:text-base">（Daily Routine）</span>
            </h4>
            <p className="mb-3 -mt-1 text-[11px] leading-relaxed text-[var(--color-brand-taupe)]">
                按派系骨架与推荐产品生成；问题卡中的护理方案是针对性说明，实际执行顺序以本表为准。
            </p>

            {plan ? (
                <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-brand-charcoal/[0.08] bg-white/80 p-4 lg:p-5">
                        <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-brand-charcoal/60">
                            <Sun className="h-3.5 w-3.5" strokeWidth={1.8} />
                            晨间
                        </p>
                        <StepList steps={plan.morning} tone="morning" />
                    </div>
                    <div className="rounded-xl border border-brand-charcoal/[0.08] bg-white/80 p-4 lg:p-5">
                        <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-brand-charcoal/60">
                            <Moon className="h-3.5 w-3.5" strokeWidth={1.8} />
                            夜间
                        </p>
                        <StepList steps={plan.night} tone="night" />
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    {fallbackPlans.map((issue, index) => (
                        <div key={`${issue.title}-${index}`} className="rounded-xl border border-brand-charcoal/[0.08] bg-white/80 p-4">
                            <p className="text-[12px] font-medium text-[var(--color-brand-espresso)]">{issue.title}</p>
                            <p className="mt-1 text-[12px] leading-[1.75] text-[var(--color-brand-cocoa)]">{issue.skincarePlan}</p>
                        </div>
                    ))}
                </div>
            )}

            {routineNote && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#C9A86C]/35 bg-[#FBF8F3] px-4 py-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8B6914]" strokeWidth={1.8} />
                    <p className="text-[12px] leading-[1.75] text-[var(--color-brand-cocoa)]">
                        <span className="font-medium text-[var(--color-brand-espresso)]">本次为你微调：</span>
                        {routineNote}
                    </p>
                </div>
            )}

            {(plan?.note || plan?.onlyOneSet || plan?.formulaCore) && (
                <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-[var(--color-brand-taupe)]">
                    {plan?.formulaCore && <p>护肤公式：{plan.formulaCore}</p>}
                    {plan?.note && <p>注意：{plan.note}</p>}
                    {plan?.onlyOneSet && <p>极简组合：{plan.onlyOneSet}</p>}
                </div>
            )}
        </section>
    );
}
