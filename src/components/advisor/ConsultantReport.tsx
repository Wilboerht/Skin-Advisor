"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion as m, useReducedMotion } from "framer-motion";
import { ChevronDown, Eye, HelpCircle, Sparkles, Stethoscope, Sun, Moon, HeartHandshake } from "lucide-react";
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
    severe: { label: "重点", badge: "bg-red-100 text-red-700", bar: "bg-red-400" },
    moderate: { label: "改善", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
    mild: { label: "轻微", badge: "bg-gray-100 text-gray-600", bar: "bg-gray-300" },
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

function SectionTitle({ children, en }: { children: ReactNode; en?: string }) {
    return (
        <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
            {children}
            {en && <span className="text-xs lg:text-base">（{en}）</span>}
        </h4>
    );
}

// 分数语义色：与十维口径一致（<40 红 / <55 琥珀 / 其余中性），让用户一眼判断分数好坏
function scoreTone(score: number): string {
    if (score < 40) return "text-red-600";
    if (score < 55) return "text-amber-600";
    return "text-brand-charcoal/70";
}

function EvidenceChips({ issue, dimensions }: { issue: ConsultantIssue; dimensions?: ConsultantReportProps["dimensions"] }) {
    if (!dimensions || issue.relatedDimensions.length === 0) return null;
    const chips = issue.relatedDimensions
        .map((key) => {
            const dim = dimensions[key];
            const label = DIMENSION_LABELS[key];
            if (!dim || typeof dim.score !== "number" || !label) return null;
            return {
                key,
                label,
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
                    {chip.label}
                    <span className={cn("font-medium", scoreTone(chip.score))}>
                        {chip.score} 分{chip.grade ? ` · ${chip.grade}` : ""}
                    </span>
                </span>
            ))}
        </div>
    );
}

function IssueCard({ issue, dimensions, expanded, onToggle, bodyId }: {
    issue: ConsultantIssue;
    dimensions?: ConsultantReportProps["dimensions"];
    /** 是否展开（支持同时展开多张，由父组件控制） */
    expanded: boolean;
    onToggle: () => void;
    /** 卡体 id，供卡头按钮 aria-controls 关联 */
    bodyId: string;
}) {
    const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.mild;
    const isSevere = issue.severity === "severe";
    const reduceMotion = useReducedMotion();

    return (
        <article className={cn(
            "relative rounded-xl border overflow-hidden motion-safe:transition-all motion-safe:duration-200",
            // 重点问题整卡淡红 tint：扫读时严重程度一眼可辨，无需依赖细色条
            isSevere
                ? "border-red-200/50 bg-red-50/50"
                : "border-brand-charcoal/[0.08] bg-white/80",
            expanded ? "shadow-[0_8px_24px_rgba(61,47,37,0.06)]" : "hover:shadow-[0_4px_16px_rgba(61,47,37,0.04)] hover:border-brand-charcoal/[0.14]"
        )}>
            {/* 严重度色条 */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", meta.bar)} />

            {/* 卡头：整行可点击（折叠/展开切换） */}
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={bodyId}
                className="w-full flex items-center justify-between gap-3 py-4 lg:py-5 pr-4 lg:pr-5 pl-6 lg:pl-7 text-left cursor-pointer group"
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    {/* 标题允许换行：AI 生成标题较长，truncate 会在展开后仍截断且无处可看全文 */}
                    <h5 className="text-[15px] font-medium text-[var(--color-brand-espresso)]">
                        {issue.title}
                    </h5>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", meta.badge)}>
                        {meta.label}
                    </span>
                </div>
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-brand-charcoal/[0.04] group-hover:bg-brand-charcoal/[0.08] transition-colors">
                    <ChevronDown
                        className={cn(
                            "w-4 h-4 text-brand-charcoal/40 group-hover:text-brand-charcoal/60 motion-safe:transition-transform motion-safe:duration-200",
                            expanded && "rotate-180"
                        )}
                        strokeWidth={2}
                    />
                </span>
            </button>

            {/* 卡体：默认折叠，展开动画（高度 + 透明度；减弱动效偏好时瞬时切换） */}
            <AnimatePresence initial={false}>
                {expanded && (
                    <m.div
                        key="issue-body"
                        id={bodyId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className={cn(
                            "pl-6 pr-5 lg:pl-7 lg:pr-6 pb-5 lg:pb-6 pt-4 lg:pt-5 space-y-5 border-t",
                            isSevere ? "border-red-200/40" : "border-brand-charcoal/[0.05]"
                        )}>
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

                            {/* 怎么办：护理方案 / 生活调整。
                                用户读报告的落脚点是行动，用品牌暖色与"为什么"的中性灰拉开层级，成为全卡视觉重心 */}
                            <div>
                                <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-brand-cocoa)] tracking-wide mb-1.5">
                                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
                                    怎么办
                                </p>
                                <div className="space-y-2.5">
                                    <div className="rounded-lg border border-[#C9A86C]/25 bg-[#FBF8F3] px-4 py-3">
                                        <p className="text-[11px] font-medium text-[var(--color-brand-cocoa)] mb-1">护理方案</p>
                                        <p className="text-sm leading-[1.85] text-[var(--color-brand-espresso)]">{issue.skincarePlan}</p>
                                    </div>
                                    <div className="rounded-lg border border-[#C9A86C]/25 bg-[#FBF8F3] px-4 py-3">
                                        <p className="text-[11px] font-medium text-[var(--color-brand-cocoa)] mb-1">生活调整</p>
                                        <p className="text-sm leading-[1.85] text-[var(--color-brand-espresso)]">{issue.lifestylePlan}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 就医边界：重度问题升级为醒目提示框（安全信息不能被滑过去），其余保持低调 */}
                            {isSevere ? (
                                <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
                                    <Stethoscope className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.8} />
                                    {issue.medicalBoundary}
                                </p>
                            ) : (
                                <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-brand-charcoal/45">
                                    <Stethoscope className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.8} />
                                    {issue.medicalBoundary}
                                </p>
                            )}
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </article>
    );
}

export function ConsultantReport({ report, dimensions, personaRoute }: ConsultantReportProps) {
    const personaData = personaRoute ? getSkinTypeByIpKey(personaRoute) : undefined;
    const hasRoutine = personaData?.m4 && (personaData.m4.morning || personaData.m4.night);
    const hasFormula = personaData?.m7 && (personaData.m7.formulaCore || personaData.m7.suggestions?.length);
    const hasAdvantages = personaData?.m5?.advantages?.length;
    // 防御历史脏数据：normalizeAnalysisResult 已归一化，这里再兜底非数组场景
    const issues = Array.isArray(report.issues) ? report.issues : [];
    const strengths = Array.isArray(report.strengths) ? report.strengths : [];
    // 默认展开第一张重点卡（无重点则第一张）：「我看到的」证据是建立信任的第一屏内容，不全藏起。
    // 允许同时展开多张：问题之间往往相关（暗沉×色斑等），互斥手风琴会打断对比阅读
    const [expandedIssues, setExpandedIssues] = useState<number[]>(() => {
        const firstSevere = issues.findIndex((i) => i.severity === "severe");
        return [firstSevere >= 0 ? firstSevere : 0];
    });
    const toggleIssue = (idx: number) =>
        setExpandedIssues((prev) =>
            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
        );

    return (
        <div className="space-y-10 lg:space-y-12">
            {/* 开场总判断 */}
            <section>
                <SectionTitle en="Advisor Summary">顾问总评</SectionTitle>
                <p className="text-sm lg:text-[15px] leading-[1.9] text-[var(--color-brand-espresso)]">
                    {report.overview}
                </p>
            </section>

            {/* 逐问题诊断卡 */}
            <section>
                <SectionTitle en="Issue Diagnosis">逐问题诊断</SectionTitle>
                {issues.length > 0 ? (
                    <div className="space-y-3">
                        {issues.map((issue, idx) => (
                            <IssueCard
                                key={`${issue.title}-${idx}`}
                                issue={issue}
                                dimensions={dimensions}
                                expanded={expandedIssues.includes(idx)}
                                onToggle={() => toggleIssue(idx)}
                                bodyId={`issue-body-${idx}`}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-[var(--color-brand-cocoa)] leading-relaxed">
                        本次检测未发现需要重点关注的问题，您的肌肤状态良好，继续保持规律作息与基础防晒保湿即可。
                    </p>
                )}
            </section>

            {/* 每日方案：派系骨架 + AI 个性化微调 */}
            {(hasRoutine || hasFormula || report.routineNote) && (
                <section>
                    <SectionTitle en="Daily Routine">你的每日方案{personaData ? `：${personaData.typeName}` : ""}</SectionTitle>
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
            {(strengths.length > 0 || hasAdvantages) && (
                <section>
                    <SectionTitle en="Your Strengths">你的优势</SectionTitle>
                    {strengths.length > 0 && (
                        <ul className="space-y-2 mb-4">
                            {strengths.map((s, i) => (
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
