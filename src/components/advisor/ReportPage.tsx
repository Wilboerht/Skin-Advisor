"use client";

import { useState } from "react";
import { Activity, ChevronDown, ChevronRight, Lock } from "lucide-react";
import ResultCards from "./ResultCards";
import ComparisonCard from "./ComparisonCard";
import { ConsultantReport } from "./ConsultantReport";
import { FocusProblemsSection } from "./FocusProblemsSection";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import type { ComprehensiveResult, PreviousTestSummary } from "@/lib/analysis-result";
import type { FocusProblemData } from "@/lib/problem-solutions";
import { cn } from "@/lib/utils";

interface ReportPageProps {
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
    nickname: string;
    /** 上一次测肤摘要（趋势对比）；null/undefined 时（首测/游客无快照）不渲染 */
    previousSummary?: PreviousTestSummary | null;
    authInitialized: boolean;
    isLoggedIn: boolean;
    focusProblems: FocusProblemData[];
    /** 打开定制化分析数据详情弹窗（v1 报告） */
    onOpenLab: () => void;
    onUnlock: () => void;
}

export default function ReportPage({
    result,
    faceAnalysis,
    nickname,
    previousSummary,
    authInitialized,
    isLoggedIn,
    focusProblems,
    onOpenLab,
    onUnlock,
}: ReportPageProps) {
    // 板块 2 专家护肤建议：默认只显示前 3 条，其余折叠
    const [showAllRecommendations, setShowAllRecommendations] = useState(false);

    // 顾问叙事报告（v2）：consultantReport 存在时启用新渲染，旧报告/fallback 报告走原有板块
    const isV2Report = result.reportVersion === 2 && !!result.consultantReport;

    return (
        <>
            {/* 趋势对比：与上次测肤的派系/评分/肌肤年龄变化（有上一次数据时展示） */}
            {previousSummary && (
                <ComparisonCard
                    prev={previousSummary}
                    score={faceAnalysis?.overallScore ?? undefined}
                    skinAge={result?.skinProfile?.skinAge}
                    persona={result?.persona}
                    at={result?.analyzedAt}
                />
            )}

        <ResultCards
            score={faceAnalysis?.overallScore ?? undefined}
            skinAge={result?.skinProfile?.skinAge}
            dimensions={faceAnalysis?.dimensions || {}}
            nickname={nickname}
            comprehensiveReport={
                <>
                    {/* 顾问叙事报告（v2）：诊断卡推理链取代旧板块 1/2/4 与 Lab 伪数据 */}
                    {isV2Report && result.consultantReport && (
                        <div className="mt-6 mb-6 lg:mt-8 lg:mb-8">
                            <ConsultantReport
                                report={result.consultantReport}
                                dimensions={faceAnalysis?.dimensions as Record<string, { score?: number; grade?: string; details?: string } | undefined> | undefined}
                                personaRoute={result.persona}
                            />
                        </div>
                    )}

                    {/* 1、详细诊断报告（v1；历史旧数据回退渲染） */}
                    {!isV2Report && (
                        <div className="mt-6 mb-6 lg:mt-8 lg:mb-8">
                            <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                1、详细诊断报告 <span className="text-xs lg:text-base">(Detailed Diagnosis)</span>
                            </h4>

                            {result.analysis?.details && result.analysis.details.length > 0 ? (
                                <>
                                    {result.analysis.details[0] && (
                                        <p className="text-sm lg:text-[15px] leading-relaxed text-[var(--color-brand-espresso)] mb-4">
                                            {result.analysis.details[0]}
                                        </p>
                                    )}
                                    {result.analysis.details.length > 1 && (
                                        <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                            {result.analysis.details.slice(1).map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            ) : (
                                <p className="text-[14px] leading-relaxed text-[var(--color-brand-cocoa)]">
                                    {faceAnalysis?.summary || result.analysis?.summary || "暂无详细诊断报告"}
                                </p>
                            )}
                        </div>
                    )}

                    {/* 2、专家护肤建议（v1） */}
                    {!isV2Report && (
                        <div className="mb-6 lg:mb-8">
                            <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                2、专家护肤建议 <span className="text-xs lg:text-base">(Expert Recommendations)</span>
                            </h4>

                            <p className="text-sm text-[var(--color-brand-taupe)] mb-3">根据您的肌肤数据，以下是针对性的护理和生活方式建议：</p>

                            {(faceAnalysis?.recommendations && faceAnalysis.recommendations.length > 0) ? (
                                <>
                                    <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                        {faceAnalysis.recommendations
                                            .slice(0, showAllRecommendations ? undefined : 3)
                                            .map((rec, idx) => (
                                                <li key={idx}>{rec}</li>
                                            ))}
                                    </ul>
                                    {faceAnalysis.recommendations.length > 3 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllRecommendations(v => !v)}
                                            className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-brand-cocoa)]/70 hover:text-[var(--color-brand-cocoa)] transition-colors"
                                        >
                                            {showAllRecommendations
                                                ? "收起"
                                                : `查看全部（共 ${faceAnalysis.recommendations.length} 条）`}
                                            <ChevronDown
                                                className={cn(
                                                    "w-3.5 h-3.5 transition-transform duration-200",
                                                    showAllRecommendations && "rotate-180"
                                                )}
                                            />
                                        </button>
                                    )}
                                </>
                            ) : (
                                <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                    <li>每日早晚温和清洁，避免过度去脂。</li>
                                    <li>严格做好防晒，减少紫外线损伤。</li>
                                    <li>根据季节调整保湿产品，保持水油平衡。</li>
                                </ul>
                            )}

                            {/* 🌿 生活建议（嵌套在专家护肤建议内） */}
                            {result.analysis?.lifestyleTips && result.analysis.lifestyleTips.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-dashed border-[var(--color-brand-espresso)]/10">
                                    <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                        {result.analysis.lifestyleTips.map((tip, idx) => (
                                            <li key={idx}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. Zone Analysis Grid - always present when data exists, avoids CLS */}
                    {faceAnalysis?.zoneAnalysis && (
                        <>
                            {!authInitialized ? (
                                <div className="mb-6 lg:mb-8 min-h-[200px]" />
                            ) : isLoggedIn ? (
                                <div className="mb-6 lg:mb-8">
                                    <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-4 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                        {isV2Report ? "区域皮肤地图" : "3、区域重点关注"} <span className="text-xs lg:text-base">(Area Focus)</span>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries({
                                            forehead: "额头区域",
                                            tZone: "T字区域",
                                            leftCheek: "左脸颊",
                                            rightCheek: "右脸颊",
                                            eyeArea: "眼周",
                                            jawline: "下颌线"
                                        } as Record<string, string>).map(([key, label]) => {
                                            const zoneData = faceAnalysis.zoneAnalysis![key as keyof typeof faceAnalysis.zoneAnalysis];
                                            if (!zoneData) return null;
                                            return (
                                                <div key={key} className="bg-[var(--color-brand-espresso)]/5 border text-left border-[var(--color-brand-espresso)]/15 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="font-semibold text-[var(--color-brand-espresso)] text-sm">{label}</div>
                                                    </div>
                                                    <p className="text-sm text-[var(--color-brand-cocoa)] mb-2 leading-snug lg:line-clamp-2">
                                                        {zoneData.condition}
                                                    </p>
                                                    <div className="mt-2 pt-2 border-t border-dashed border-[var(--color-brand-espresso)]/10">
                                                        <p className="text-xs text-[var(--color-brand-charcoal)] leading-snug">
                                                            <span className="font-medium text-[var(--color-brand-cocoa)] mr-1">建议:</span>
                                                            {zoneData.advice}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-6 lg:mb-8">
                                    <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-4 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                        {isV2Report ? "区域皮肤地图" : "3、区域重点关注"} <span className="text-xs lg:text-base">(Area Focus)</span>
                                    </h4>
                                    <div className="rounded-xl border border-dashed border-[#C9A86C]/40 bg-gradient-to-br from-[#FBF8F3] to-[var(--color-brand-cream)] p-6 text-center">
                                        <Lock className="w-8 h-8 text-[#C9A86C] mx-auto mb-3" />
                                        <p className="text-sm text-[var(--color-brand-cocoa)] mb-3 leading-relaxed">
                                            登录后可解锁区域重点分析，查看额头、T区、脸颊等六大区域的详细诊断与专属建议
                                        </p>
                                        <button
                                            onClick={onUnlock}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-brand-cocoa)] text-white text-xs font-medium hover:bg-[#4a3a2c] transition-colors"
                                        >
                                            立即登录解锁
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* 4、重点问题关注（v1；v2 由诊断卡取代） */}
                    {!isV2Report && faceAnalysis && (
                        <div className="mb-6 lg:mb-8">
                            <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                4、重点问题关注 <span className="text-xs lg:text-base">(Key Concerns)</span>
                            </h4>
                            <FocusProblemsSection
                                problems={focusProblems}
                                authInitialized={authInitialized}
                                isLoggedIn={isLoggedIn}
                                onUnlock={onUnlock}
                            />
                        </div>
                    )}

                    {/* Lab-Grade Analysis Metrics（v1；v2 移除伪仪器值入口） */}
                    {!isV2Report && result?.dataSource !== "questionnaire" && faceAnalysis && (
                        <button
                            type="button"
                            onClick={onOpenLab}
                            className="w-full text-left rounded-xl border border-[var(--color-brand-espresso)]/15 bg-[var(--color-brand-espresso)]/5 shadow-sm overflow-hidden font-sans cursor-pointer hover:bg-[var(--color-brand-espresso)]/[0.07] transition-colors"
                        >
                            <div className="px-5 py-3 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-[var(--color-brand-taupe)]" />
                                    <span className="text-sm font-medium text-[var(--color-brand-espresso)]">定制化专业分析数据详情</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-[var(--color-brand-taupe)] font-normal hidden sm:inline-block">
                                        MySkin.Today™ Gold Standard
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-[var(--color-brand-taupe)]" />
                                </div>
                            </div>
                            <div className="px-5 pb-3 pt-0">
                                <p className="text-xs text-[var(--color-brand-taupe)]/80 leading-relaxed pl-6">
                                    联系您的专属护肤顾问，或咨询门店顾问获取专业分析解读
                                </p>
                            </div>
                        </button>
                    )}
                </>
            }
        />
        </>
    );
}
