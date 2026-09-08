"use client";

import type { ReactNode } from "react";
import { Eye, HelpCircle, Sparkles, Stethoscope, Sun, Moon, HeartHandshake } from "lucide-react";
import type { ConsultantReport, ConsultantIssue } from "@/lib/advisor-utils";
import { DIMENSION_LABELS } from "@/lib/advisor-utils";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { cn } from "@/lib/utils";

/**
 * ConsultantReport — 顾问叙事报告（Report v2）渲染组件
 *
 * 与 v1 板块陈列的区别：以"诊断卡"为单位组织内容，每张卡是一条完整推理链：
 * 我看到的（证据）→ 为什么（直接/间接诱因）→ 怎么办（护理/生活）→ 就医边界。
 * issues 由 AI 按证据动态生成，数量 0-4，不做预设问题框架。
 */

const SEVERITY_META: Record<ConsultantIssue["severity"], { label: string; badge: string; bar: string }> = {
    severe: { label: "需要重点关注", badge: "bg-red-100 text-red-700", bar: "bg-red-400" },
    moderate: { label: "需要改善", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
    mild: { label: "轻微关注", badge: "bg-gray-100 text-gray-600", bar: "bg-[var(--color-brand-cocoa)]" },
};

const GRADE_LABELS: Record<string, string> = {
    excellent: "优秀",
    good: "良好",
    average: "一般",
    fair: "需关注",
    poor: "较差",
};

interface DimensionLike {
    score?: number;
    grade?: string;
    details?: string;
}

interface ConsultantReportProps {
    report: ConsultantReport;
    /** 视觉分析的十维数据（证据 chips 取数） */
    dimensions?: Record<string, DimensionLike | undefined>;
    /** 派系 route key（result.persona），用于取派系早晚方案/护肤公式/优势解析 */
    personaRoute?: string;
}

function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
            {children}
        </h4>
    );
}

function EvidenceChips({ issue, dimensions }: { issue: ConsultantIssue; dimensions?: ConsultantReportProps["dimensions"] }) {
    if (!dimensions || issue.relatedDimensions.length === 0) return null;
    const chips = issue.relatedDimensions
        .map((key) => {
            const dim = dimensions[key];
            if (!dim || typeof dim.score !== "number") return null;
            return {
                key,
                label: DIMENSION_LABELS[key] || key,
                score: dim.score,
                grade: dim.grade ? GRADE_LABELS[dim.grade] || dim.grade : null,
            };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
    if (chips.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mt-2.5">
            {chips.map((chip) => (
                <span
                    key={chip.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/12 bg-white/70 px-2.5 py-1 text-[11px] text-brand-charcoal/70 font-light"
                >
                    {chip.label} {chip.score} 分{chip.grade ? ` · ${chip.grade}` : ""}
                </span>
            ))}
        </div>
    );
}

function IssueCard({ issue, dimensions }: { issue: ConsultantIssue; dimensions?: ConsultantReportProps["dimensions"] }) {
    const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.mild;

    return (
        <div className="relative rounded-xl border border-brand-charcoal/[0.08] bg-white/80 overflow-hidden">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", meta.bar)} />
            <div className="p-5 lg:p-6 pl-6 lg:pl-7 space-y-5">
                {/* 卡头：问题名 + 严重度 */}
                <div className="flex items-center justify-between gap-3">
                    <h5 className="text-[15px] font-medium text-[var(--color-brand-espresso)]">{issue.title}</h5>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", meta.badge)}>
                        {meta.label}
                    </span>
                </div>

                {/* 我看到的 */}
                <div>
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-brand-charcoal/50 tracking-wide mb-1.5">
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.8} />
                        我看到的
                    </p>
                    <p className="text-sm lg:text-[15px] leading-[1.9] text-[var(--color-brand-espresso)]">
                        {issue.observation}
                    </p>
                    <EvidenceChips issue={issue} dimensions={dimensions} />
                </div>

                {/* 为什么：直接诱因 / 间接诱因 */}
                <div>
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-brand-charcoal/50 tracking-wide mb-1.5">
                        <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
                        为什么会出现这个问题
                    </p>
                    <div className="space-y-2.5">
                        <div className="rounded-lg bg-brand-charcoal/[0.03] px-4 py-3">
                            <p className="text-[11px] text-brand-charcoal/45 mb-1">直接诱因 · 皮肤层面</p>
                            <p className="text-sm leading-[1.85] text-brand-charcoal/80">{issue.directCauses}</p>
                        </div>
                        <div className="rounded-lg bg-brand-charcoal/[0.03] px-4 py-3">
                            <p className="text-[11px] text-brand-charcoal/45 mb-1">间接诱因 · 生活习惯</p>
                            <p className="text-sm leading-[1.85] text-brand-charcoal/80">{issue.indirectCauses}</p>
                        </div>
                    </div>
                </div>

                {/* 怎么办：护理方案 / 生活方案 */}
                <div>
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-brand-charcoal/50 tracking-wide mb-1.5">
                        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
                        怎么办
                    </p>
                    <div className="space-y-2.5">
                        <div className="rounded-lg border border-brand-charcoal/[0.08] px-4 py-3">
                            <p className="text-[11px] text-brand-charcoal/45 mb-1">护理方案</p>
                            <p className="text-sm leading-[1.85] text-[var(--color-brand-espresso)]">{issue.skincarePlan}</p>
                        </div>
                        <div className="rounded-lg border border-brand-charcoal/[0.08] px-4 py-3">
                            <p className="text-[11px] text-brand-charcoal/45 mb-1">生活调整</p>
                            <p className="text-sm leading-[1.85] text-[var(--color-brand-espresso)]">{issue.lifestylePlan}</p>
                        </div>
                    </div>
                </div>

                {/* 就医边界 */}
                <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-brand-charcoal/45">
                    <Stethoscope className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.8} />
                    {issue.medicalBoundary}
                </p>
            </div>
        </div>
    );
}

export function ConsultantReport({ report, dimensions, personaRoute }: ConsultantReportProps) {
    const personaData = personaRoute ? getSkinTypeByIpKey(personaRoute) : undefined;
    const hasRoutine = personaData?.m4 && (personaData.m4.morning || personaData.m4.night);
    const hasFormula = personaData?.m7 && (personaData.m7.formulaCore || personaData.m7.suggestions?.length);
    const hasAdvantages = personaData?.m5?.advantages?.length;

    return (
        <div className="space-y-10 lg:space-y-12">
            {/* 开场总判断 */}
            <section>
                <SectionTitle>顾问总评</SectionTitle>
                <p className="text-sm lg:text-[15px] leading-[1.9] text-[var(--color-brand-espresso)]">
                    {report.overview}
                </p>
            </section>

            {/* 逐问题诊断卡 */}
            <section>
                <SectionTitle>逐问题诊断</SectionTitle>
                {report.issues.length > 0 ? (
                    <div className="space-y-5">
                        {report.issues.map((issue, idx) => (
                            <IssueCard key={`${issue.title}-${idx}`} issue={issue} dimensions={dimensions} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-[var(--color-brand-cocoa)] leading-relaxed">
                        本次检测未发现需要重点关注的问题，您的肌肤状态良好，请继续保持现有护理习惯。
                    </p>
                )}
            </section>

            {/* 每日方案：派系骨架 + AI 个性化微调 */}
            {(hasRoutine || hasFormula || report.routineNote) && (
                <section>
                    <SectionTitle>你的每日方案{personaData ? `（${personaData.typeName}）` : ""}</SectionTitle>
                    {report.routineNote && (
                        <p className="text-sm lg:text-[15px] leading-[1.9] text-[var(--color-brand-espresso)] mb-4">
                            {report.routineNote}
                        </p>
                    )}
                    {hasRoutine && (
                        <div className="grid gap-3 lg:grid-cols-2 mb-4">
                            {personaData!.m4.morning && (
                                <div className="rounded-xl border border-brand-charcoal/[0.08] bg-white/80 p-5">
                                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-brand-charcoal/50 mb-2">
                                        <Sun className="w-3.5 h-3.5" strokeWidth={1.8} />
                                        晨间
                                    </p>
                                    <p className="text-sm leading-[1.85] text-brand-charcoal/80">{personaData!.m4.morning}</p>
                                </div>
                            )}
                            {personaData!.m4.night && (
                                <div className="rounded-xl border border-brand-charcoal/[0.08] bg-white/80 p-5">
                                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-brand-charcoal/50 mb-2">
                                        <Moon className="w-3.5 h-3.5" strokeWidth={1.8} />
                                        夜间
                                    </p>
                                    <p className="text-sm leading-[1.85] text-brand-charcoal/80">{personaData!.m4.night}</p>
                                </div>
                            )}
                        </div>
                    )}
                    {hasFormula && (
                        <div className="rounded-xl border border-brand-charcoal/[0.08] bg-white/80 p-5">
                            {personaData!.m7.formulaCore && (
                                <p className="text-sm font-medium text-[var(--color-brand-espresso)] mb-3">
                                    护肤公式：{personaData!.m7.formulaCore}
                                </p>
                            )}
                            <ul className="space-y-2.5">
                                {personaData!.m7.suggestions?.map((s, i) => (
                                    <li key={i} className="text-sm leading-[1.85] text-brand-charcoal/80">
                                        <span className="font-medium text-[var(--color-brand-espresso)]">{s.title}：</span>
                                        {s.content}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            )}

            {/* 优势：AI 如实肯定 + 派系优势解析 */}
            {(report.strengths.length > 0 || hasAdvantages) && (
                <section>
                    <SectionTitle>你的优势</SectionTitle>
                    {report.strengths.length > 0 && (
                        <ul className="space-y-2 mb-4">
                            {report.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm lg:text-[15px] leading-[1.85] text-[var(--color-brand-espresso)]">
                                    <HeartHandshake className="w-4 h-4 shrink-0 mt-1 text-[#C9A86C]" strokeWidth={1.8} />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    )}
                    {hasAdvantages && (
                        <div className="rounded-xl bg-brand-charcoal/[0.03] p-5 space-y-3">
                            {personaData!.m5.advantages.map((adv, i) => (
                                <p key={i} className="text-sm leading-[1.85] text-brand-charcoal/75">
                                    <span className="font-medium text-[var(--color-brand-espresso)]">{adv.title}：</span>
                                    {adv.content}
                                </p>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
