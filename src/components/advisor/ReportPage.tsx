"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import ResultCards from "./ResultCards";
import ComparisonCard from "./ComparisonCard";
import { ConsultantReport } from "./ConsultantReport";
import { DimensionRadarChart } from "./DimensionRadarChart";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import type { ComprehensiveResult, PreviousTestSummary } from "@/lib/analysis-result";
import { isMakeupState } from "@/lib/skin-state";

interface ReportPageProps {
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
    nickname: string;
    /** 上一次测肤摘要（趋势对比）；null/undefined 时（首测/游客无快照）不渲染 */
    previousSummary?: PreviousTestSummary | null;
    authInitialized: boolean;
    isLoggedIn: boolean;
    onUnlock: () => void;
    /** 护肤档案入口（趋势对比卡内）：打开「我的」账户弹层的档案 tab */
    onOpenDiary?: () => void;
}

export default function ReportPage({
    result,
    faceAnalysis,
    nickname,
    previousSummary,
    authInitialized,
    isLoggedIn,
    onUnlock,
    onOpenDiary,
}: ReportPageProps) {
    // v2-only：有实质内容的 consultantReport 即新版顾问叙事报告；
    // 历史 v1 报告 / 数据损坏（overview 为空）不再渲染旧板块，改展示重新测肤引导
    const isV2Report = !!result.consultantReport?.overview?.trim();
    // 带妆拍摄：色斑/肤色/敏感度维度置信度降低（提示用户，并供雷达图标注）
    const isMakeupCapture = isMakeupState(result.skinState);

    return (
        <div className="flex flex-col gap-6 lg:gap-8">
            {/* 趋势对比：与上次测肤的派系/评分/肌肤年龄变化（有上一次数据时展示） */}
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
            skinAge={result?.skinProfile?.skinAge}
            dimensions={faceAnalysis?.dimensions || {}}
            nickname={nickname}
            comprehensiveReport={
                <>
                    {/* 十维数据总览：雷达图直观呈现各维度强弱（有面部分析数据时展示） */}
                    {faceAnalysis?.dimensions && (
                        <div className="mt-6 mb-6 lg:mt-8 lg:mb-8">
                            <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                十维数据总览 <span className="text-xs lg:text-base">（Dimension Overview）</span>
                            </h4>
                            {isMakeupCapture && (
                                <p className="mb-3 -mt-1 text-[11px] lg:text-[12px] text-[var(--color-brand-taupe)] leading-relaxed">
                                    带妆拍摄：色斑 / 肤色均衡度 / 敏感度三个维度置信度降低，结论仅供参考
                                </p>
                            )}
                            <DimensionRadarChart dimensions={faceAnalysis.dimensions} />
                        </div>
                    )}

                    {/* 顾问叙事报告（v2）：诊断卡推理链取代旧板块 */}
                    {isV2Report && result.consultantReport && (
                        <div className="mt-6 mb-6 lg:mt-8 lg:mb-8">
                            <ConsultantReport
                                report={result.consultantReport}
                                dimensions={faceAnalysis?.dimensions as Record<string, { score?: number; grade?: string; details?: string } | undefined> | undefined}
                                personaRoute={result.persona}
                            />
                        </div>
                    )}

                    {/* 历史 v1 报告：不再提供旧版详细板块，引导重新测肤（数据/趋势仍保留展示） */}
                    {!isV2Report && (
                        <div className="mt-6 mb-6 lg:mt-8 lg:mb-8">
                            <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                报告已升级 <span className="text-xs lg:text-base">（Report Upgraded）</span>
                            </h4>
                            <div className="rounded-xl border border-dashed border-[#C9A86C]/40 bg-gradient-to-br from-[#FBF8F3] to-[var(--color-brand-cream)] p-6 text-center">
                                <p className="text-sm text-[var(--color-brand-cocoa)] mb-2 leading-relaxed">
                                    这份报告由旧版分析生成，详细诊断内容已不再提供。
                                </p>
                                <p className="text-xs text-[var(--color-brand-taupe)] mb-4 leading-relaxed">
                                    重新测肤即可获得新版顾问报告：逐问题推理、每日护理方案与产品落点。
                                </p>
                                <Link
                                    href="/questions?edit=true"
                                    className="inline-flex items-center justify-center px-6 h-10 rounded-full border border-brand-cocoa/25 bg-brand-cocoa/[0.07] text-brand-cocoa text-[13px] font-medium tracking-[0.08em] transition-colors hover:border-brand-cocoa/40 hover:bg-brand-cocoa/[0.12]"
                                >
                                    重新测肤
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* 区域皮肤地图：v2 报告的区域观察入口（登录解锁） */}
                    {faceAnalysis?.zoneAnalysis && (
                        <>
                            {!authInitialized ? (
                                <div className="mb-6 lg:mb-8 min-h-[200px]" />
                            ) : isLoggedIn ? (
                                <div className="mb-6 lg:mb-8">
                                    <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-4 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                        区域皮肤地图 <span className="text-xs lg:text-base">（Area Focus）</span>
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
                                        区域皮肤地图 <span className="text-xs lg:text-base">（Area Focus）</span>
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
                </>
            }
        />
        </div>
    );
}
