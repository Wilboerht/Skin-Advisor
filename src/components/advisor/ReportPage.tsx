"use client";

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import ResultCards from "./ResultCards";
import ComparisonCard from "./ComparisonCard";
import { ConsultantReport } from "./ConsultantReport";
import { DimensionRadarChart } from "./DimensionRadarChart";
import { ReportMeta } from "./ReportMeta";
import { ReportSummary } from "./ReportSummary";
import { RoutinePlan } from "./RoutinePlan";
import { SafetyPanel } from "./SafetyPanel";
import { ReportFeedback } from "./ReportFeedback";
import { LegacyReportDetails } from "./LegacyReportDetails";
import type { FaceAnalysisResult, SkinCondition, ZoneData } from "@/lib/advisor-utils";
import type { ComprehensiveResult, PreviousTestSummary } from "@/lib/analysis-result";
import { isMakeupState } from "@/lib/skin-state";
import { getScoreBand, isAttentionScore } from "@/lib/score-bands";
import { DIMENSION_LABELS, getConcernLabel } from "@/lib/advisor-labels";
import { buildRoutinePlan } from "@/lib/routine-plan";
import { buildRetestReminderIcs } from "@/lib/retest-reminder";

const ZONE_LABELS = {
    forehead: "额头区域",
    tZone: "T字区域",
    leftCheek: "左脸颊",
    rightCheek: "右脸颊",
    eyeArea: "眼周",
    jawline: "下颌线",
} as const;

const ZONE_SCORE_KEYS = ["oil", "texture", "wrinkles", "spots", "redness", "darkCircles", "firmness", "contour"] as const;

const ZONE_SCORE_LABELS: Record<(typeof ZONE_SCORE_KEYS)[number], string> = {
    oil: "水油",
    texture: "细腻度",
    wrinkles: "无纹度",
    spots: "无斑度",
    redness: "无泛红",
    darkCircles: "眼周",
    firmness: "紧致度",
    contour: "轮廓",
};

const CONDITION_SEVERITY: Record<SkinCondition["severity"], { label: string; className: string }> = {
    mild: { label: "轻度", className: "bg-[#F1ECE3] text-[#8c7a6b]" },
    moderate: { label: "中度", className: "bg-amber-100 text-amber-700" },
    severe: { label: "重度", className: "bg-red-100 text-red-700" },
};

const REPORT_NAV = [
    { href: "#report-conclusion", label: "结论与评分" },
    { href: "#report-evidence", label: "检测数据" },
    { href: "#report-diagnosis", label: "问题诊断" },
    { href: "#report-routine", label: "每日方案" },
    { href: "#report-safety", label: "安全与复测" },
] as const;

/** 区域是否有实质问题：任一数值指标低于统一关注阈值；无数值数据时按 condition 兜底 */
function zoneNeedsAttention(zone: ZoneData): boolean {
    const scores = ZONE_SCORE_KEYS.map((k) => zone[k]).filter((v): v is number => typeof v === "number");
    if (scores.length === 0) return !!zone.condition?.trim();
    return scores.some((s) => isAttentionScore(s));
}

function zonesAreSimilar(left: ZoneData | undefined, right: ZoneData | undefined): boolean {
    if (!left || !right) return false;
    const keys = ZONE_SCORE_KEYS.filter((key) => typeof left[key] === "number" && typeof right[key] === "number");
    if (keys.length < 3) return false;
    return keys.every((key) => Math.abs((left[key] as number) - (right[key] as number)) <= 5);
}

interface ReportPageProps {
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
    nickname: string;
    /** 上一次测肤摘要（趋势对比）；null/undefined 时（首测/游客无快照）不渲染 */
    previousSummary?: PreviousTestSummary | null;
    /** 报告会话 ID：用于复测日历提醒 UID */
    sessionId?: string;
    /** 护肤档案入口（趋势对比卡内）：打开「我的」账户弹层的档案 tab */
    onOpenDiary?: () => void;
}

export default function ReportPage({
    result,
    faceAnalysis,
    nickname,
    previousSummary,
    sessionId,
    onOpenDiary,
}: ReportPageProps) {
    // v2-only：有实质内容的 consultantReport 即新版顾问叙事报告；
    // 历史 v1 报告不再只显示“已升级”，旧 details/tips 仍以只读方式保留。
    const isV2Report = !!result.consultantReport?.overview?.trim();
    const isMakeupCapture = isMakeupState(result.skinState);
    const routinePlan = buildRoutinePlan({ persona: result.persona, products: result.products });
    const concernsLabel = result.skinProfile.concerns
        .slice(0, 2)
        .map(getConcernLabel)
        .filter(Boolean)
        .join("、") || undefined;
    const skinConditions = faceAnalysis?.skinConditions ?? [];
    const reportNav = REPORT_NAV.filter((item) => item.href !== "#report-diagnosis" || isV2Report);

    // 复测重点：取本次分数最低的 2 个有效维度（不含不可见维度）
    const retestFocus = Object.entries(faceAnalysis?.dimensions ?? {})
        .filter(([, dim]) => typeof dim?.score === "number" && dim.notVisible !== true)
        .sort((a, b) => (a[1]!.score as number) - (b[1]!.score as number))
        .slice(0, 2)
        .map(([key]) => DIMENSION_LABELS[key] || key);

    const handleAddRetestReminder = () => {
        const ics = buildRetestReminderIcs({
            analyzedAt: result.analyzedAt,
            sessionId,
            focus: retestFocus,
            days: 28,
        });
        const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "肌智派复测提醒.ics";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // 区域皮肤地图：只保留有问题的区域；左右脸颊接近时合并为“两颊”，避免重复卡片。
    const zoneEntries = (() => {
        if (!faceAnalysis?.zoneAnalysis) return [];
        const zones = faceAnalysis.zoneAnalysis;
        const entries: Array<{ key: string; label: string; data: ZoneData }> = [];
        for (const [key, label] of Object.entries(ZONE_LABELS) as [keyof typeof ZONE_LABELS, string][]) {
            const data = zones[key];
            if (key === "rightCheek" && zonesAreSimilar(zones.leftCheek, zones.rightCheek)) continue;
            if (!data || !zoneNeedsAttention(data)) continue;
            entries.push({
                key,
                label: key === "leftCheek" && zonesAreSimilar(zones.leftCheek, zones.rightCheek) ? "两颊" : label,
                data,
            });
        }
        return entries;
    })();

    const hiddenZoneCount = faceAnalysis?.zoneAnalysis
        ? Object.keys(ZONE_LABELS).filter((key) => {
            const zoneKey = key as keyof typeof ZONE_LABELS;
            if (zoneKey === "rightCheek" && zonesAreSimilar(faceAnalysis.zoneAnalysis!.leftCheek, faceAnalysis.zoneAnalysis!.rightCheek)) {
                return false;
            }
            return !zoneEntries.some((entry) => entry.key === zoneKey);
        }).length
        : 0;

    return (
        <div className="flex flex-col gap-8 lg:gap-10">
            <nav aria-label="报告导航" className="flex flex-wrap gap-2">
                {reportNav.map((item) => (
                    <a
                        key={item.href}
                        href={item.href}
                        className="inline-flex h-8 items-center rounded-full border border-[var(--color-brand-espresso)]/12 bg-white/55 px-3 text-[11px] font-medium text-[var(--color-brand-cocoa)] transition-colors hover:border-[var(--color-brand-espresso)]/30 hover:bg-white active:scale-[0.98]"
                    >
                        {item.label}
                    </a>
                ))}
            </nav>

            {/* 1. 结论与评分：报告头、结论摘要、趋势对比、核心指标 */}
            <div id="report-conclusion" className="flex scroll-mt-24 flex-col gap-6 lg:gap-8">
                <ReportMeta result={result} faceAnalysis={faceAnalysis} />
                <ReportSummary result={result} />
                {previousSummary && (
                    <ComparisonCard
                        prev={previousSummary}
                        score={faceAnalysis?.overallScore ?? undefined}
                        skinAge={result?.skinProfile?.skinAge}
                        persona={result?.persona}
                        at={result?.analyzedAt}
                        onOpenDiary={onOpenDiary}
                    />
                )}
                <ResultCards
                    score={faceAnalysis?.overallScore ?? undefined}
                    skinAge={result?.skinProfile?.skinAge ?? faceAnalysis?.skinAge?.estimated}
                    skinAgeRange={faceAnalysis?.skinAge?.range}
                    skinAgeFactors={faceAnalysis?.skinAge?.factors}
                    skinTypeLabel={result.skinProfile.typeLabel}
                    concernsLabel={concernsLabel}
                    nickname={nickname}
                    dataSource={result.dataSource}
                />
            </div>

            {/* 2. 检测证据：十维总览、可见皮肤表现、区域皮肤地图集中展示 */}
            <section id="report-evidence" aria-label="检测证据" className="flex scroll-mt-24 flex-col gap-6 lg:gap-8">
                {faceAnalysis?.dimensions && (
                    <section aria-labelledby="dimension-overview-title">
                        <h4 id="dimension-overview-title" className="mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                            十维数据总览 <span className="text-xs lg:text-base">（Dimension Overview）</span>
                        </h4>
                        {isMakeupCapture && (
                            <p className="mb-3 -mt-1 text-[11px] lg:text-[12px] text-[var(--color-brand-taupe)] leading-relaxed">
                                带妆拍摄：色斑 / 肤色均衡度 / 屏障耐受度三个维度置信度降低，结论仅供参考
                            </p>
                        )}
                        <DimensionRadarChart dimensions={faceAnalysis.dimensions} sessionId={sessionId} />
                    </section>
                )}

                {skinConditions.length > 0 && (
                    <section aria-labelledby="skin-conditions-title">
                        <h4 id="skin-conditions-title" className="mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                            可见皮肤表现 <span className="text-xs lg:text-base">（Visible Findings）</span>
                        </h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {skinConditions.map((condition, index) => {
                                const severity = CONDITION_SEVERITY[condition.severity] ?? CONDITION_SEVERITY.mild;
                                return (
                                    <div
                                        key={`${condition.condition}-${index}`}
                                        className="rounded-xl border border-[var(--color-brand-espresso)]/10 bg-white/60 px-4 py-3"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[13px] font-medium text-[var(--color-brand-espresso)]">
                                                {condition.condition}
                                            </span>
                                            {condition.area && (
                                                <span className="text-[11px] text-[var(--color-brand-taupe)]">
                                                    {condition.area}
                                                </span>
                                            )}
                                            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${severity.className}`}>
                                                {severity.label}
                                            </span>
                                        </div>
                                        {condition.description && (
                                            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-brand-cocoa)]">
                                                {condition.description}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {faceAnalysis?.zoneAnalysis && zoneEntries.length > 0 && (
                    <section aria-labelledby="zone-map-title">
                        <h4 id="zone-map-title" className="mb-4 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                            区域皮肤地图 <span className="text-xs lg:text-base">（Area Focus）</span>
                        </h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {zoneEntries.map(({ key, label, data: zoneData }) => (
                                <div key={key} className="rounded-lg border border-[var(--color-brand-espresso)]/15 bg-[var(--color-brand-espresso)]/5 p-4 text-left shadow-sm transition-shadow hover:shadow-md">
                                    <div className="mb-2 font-semibold text-sm text-[var(--color-brand-espresso)]">{label}</div>
                                    <p className="mb-2 text-sm leading-snug text-[var(--color-brand-cocoa)] lg:line-clamp-2">
                                        {zoneData.condition}
                                    </p>
                                    <div className="mb-2 flex flex-wrap gap-1">
                                        {ZONE_SCORE_KEYS.map((scoreKey) => {
                                            const value = zoneData[scoreKey];
                                            if (typeof value !== "number") return null;
                                            const band = getScoreBand(value);
                                            return (
                                                <span
                                                    key={scoreKey}
                                                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                                    style={band ? { color: band.color, background: band.background } : undefined}
                                                    title={`${ZONE_SCORE_LABELS[scoreKey]}：${value} 分`}
                                                >
                                                    {ZONE_SCORE_LABELS[scoreKey]} {value}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2 border-t border-dashed border-[var(--color-brand-espresso)]/10 pt-2">
                                        <p className="text-xs leading-snug text-[var(--color-brand-charcoal)]">
                                            <span className="mr-1 font-medium text-[var(--color-brand-cocoa)]">建议:</span>
                                            {zoneData.advice}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {hiddenZoneCount > 0 && (
                            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-brand-taupe)]">
                                仅展示需要关注的区域，其余区域本次未标记问题。
                            </p>
                        )}
                    </section>
                )}
            </section>

            {/* 3. 逐问题诊断：完整的观察 → 诱因 → 方案 → 就医边界 */}
            {isV2Report && result.consultantReport && (
                <section id="report-diagnosis" aria-label="逐问题诊断" className="scroll-mt-24">
                    <ConsultantReport
                        report={result.consultantReport}
                        dimensions={faceAnalysis?.dimensions as Record<string, { score?: number; grade?: string; details?: string; confidence?: number; notVisible?: boolean } | undefined> | undefined}
                        personaRoute={result.persona}
                        sessionId={sessionId}
                    />
                </section>
            )}

            {/* 4. 每日方案：唯一的 AM/PM 行动表（派系骨架 + 产品落点 + AI 微调） */}
            <section id="report-routine" aria-label="每日方案" className="scroll-mt-24">
                <RoutinePlan
                    plan={routinePlan}
                    routineNote={result.consultantReport?.routineNote}
                    issues={result.consultantReport?.issues}
                />
            </section>

            {/* 5. 安全与复测 */}
            <section id="report-safety" aria-label="安全与复测" className="flex scroll-mt-24 flex-col gap-6 lg:gap-8">
                <SafetyPanel notes={result.safetyNotes} issues={result.consultantReport?.issues} />

                <ReportFeedback sessionId={sessionId} />

                <section aria-labelledby="retest-title">
                    <h4 id="retest-title" className="mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                        复测计划 <span className="text-xs lg:text-base">（Next Test）</span>
                    </h4>
                    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-brand-espresso)]/12 bg-[#FBF8F3] p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--color-brand-espresso)]">建议 4 周后复测</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-brand-cocoa)]">
                                {retestFocus.length > 0
                                    ? `复测时重点看：${retestFocus.join("、")}。同一光线、素颜拍摄，对比会更可靠。`
                                    : "同一光线、素颜拍摄，4 周后复测对比更可靠。"}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleAddRetestReminder}
                                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-brand-cocoa/25 bg-white px-4 text-[13px] font-medium text-brand-cocoa transition-colors hover:border-brand-cocoa/45 hover:bg-brand-cocoa/[0.06]"
                            >
                                <CalendarPlus className="h-4 w-4" strokeWidth={1.8} />
                                添加到日历
                            </button>
                            <Link
                                href="/questions?edit=true"
                                className="inline-flex h-10 items-center justify-center rounded-full border border-brand-cocoa/25 bg-white px-5 text-[13px] font-medium text-brand-cocoa transition-colors hover:border-brand-cocoa/45 hover:bg-brand-cocoa/[0.06]"
                            >
                                重新测肤
                            </Link>
                        </div>
                    </div>
                </section>
            </section>

            {/* 历史 v1 报告：保留旧 details/tips 只读内容 + 重新测肤引导 */}
            {!isV2Report && (
                <>
                    <LegacyReportDetails result={result} />
                    <section>
                        <h4 className="mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                            报告已升级 <span className="text-xs lg:text-base">（Report Upgraded）</span>
                        </h4>
                        <div className="rounded-xl border border-dashed border-[#C9A86C]/40 bg-gradient-to-br from-[#FBF8F3] to-[var(--color-brand-cream)] p-6 text-center">
                            <p className="mb-2 text-sm leading-relaxed text-[var(--color-brand-cocoa)]">
                                这份报告由旧版分析生成。重新测肤即可获得新版顾问报告：逐问题推理、每日护理方案与产品落点。
                            </p>
                            <Link
                                href="/questions?edit=true"
                                className="inline-flex h-10 items-center justify-center rounded-full border border-brand-cocoa/25 bg-brand-cocoa/[0.07] px-6 text-[13px] font-medium tracking-[0.08em] text-brand-cocoa transition-colors hover:border-brand-cocoa/40 hover:bg-brand-cocoa/[0.12]"
                            >
                                重新测肤
                            </Link>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
