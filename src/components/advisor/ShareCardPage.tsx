"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2, Share2 } from "lucide-react";
import Image from "next/image";
import { getCharacterImage, getSkinTypeName, type IPMatchParams } from "@/lib/result-utils";

interface ShareCardPageProps {
    nickname: string;
    score?: number;
    skinType: string;
    budget?: string;
    skincareFrequency?: string;
    /** 性别未就绪时不渲染 IP 形象，避免男性用户首帧闪现女版角色 */
    gender?: string;
    summary?: string;
    rankPercentile?: number;
    onDownloadPoster: () => void;
    isPosterLoading?: boolean;
    /** 测肤日期（ISO），缺省不展示 */
    certDate?: string;
    /** 报告会话 ID（截取后 6 位作为证书编号），缺省不展示 */
    certId?: string;
    /** 翻到第二面（完整报告）的入口；缺省时仅展示保存证书按钮 */
    onOpenReport?: () => void;
    /** 重新测试入口（正常消耗测试次数）；缺省时不展示 */
    onReTest?: () => void;
}

function formatCertDate(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function formatCertId(sessionId?: string): string | null {
    if (!sessionId) return null;
    const last6 = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(-6);
    return last6.length >= 4 ? last6.toUpperCase() : null;
}

export default function ShareCardPage({
    nickname,
    score,
    skinType,
    budget,
    skincareFrequency,
    gender = "",
    summary,
    rankPercentile,
    onDownloadPoster,
    isPosterLoading = false,
    certDate,
    certId,
    onOpenReport,
    onReTest,
}: ShareCardPageProps) {
    const ipParams: IPMatchParams = { score: score ?? 0, skinType, budget, skincareFrequency };
    const characterReady = gender === "male" || gender === "female";
    const characterImage = getCharacterImage({ ...ipParams, gender });
    const skinTypeName = getSkinTypeName(ipParams);

    const [characterImgSrc, setCharacterImgSrc] = useState(characterImage);
    const [characterImgError, setCharacterImgError] = useState(false);

    useEffect(() => {
        setCharacterImgSrc(characterImage);
        setCharacterImgError(false);
    }, [characterImage]);

    const handleCharacterImageError = useCallback(() => {
        if (!characterImgError) {
            setCharacterImgSrc((prev) => prev.replace("_male", "_female"));
            setCharacterImgError(true);
        } else {
            // 最终兜底：守护派女版（与 matchCharacterIP 的兜底派系一致，文件确保存在）
            setCharacterImgSrc("/images/character/guardian/guardian_female.webp");
        }
    }, [characterImgError]);

    const dateText = formatCertDate(certDate);
    const idText = formatCertId(certId);

    return (
        <div className="w-full flex flex-col gap-0 lg:contents" aria-label={`${nickname || "用户"}的肌智派证书`}>
            {/* Mobile: Character IP Image (above Share Card) */}
            <div className="relative flex lg:hidden justify-center pointer-events-none mx-auto h-[270px] w-[270px]">
                {/* Mobile-only decorative background behind character */}
                <div className="absolute inset-0 z-0 translate-y-12">
                    <Image
                        src="/images/character-bg-mobile.webp"
                        alt=""
                        fill
                        className="object-contain brightness-125"
                        priority
                        aria-hidden="true"
                    />
                </div>
                {characterReady ? (
                    <Image
                        src={characterImgSrc}
                        alt={skinTypeName}
                        width={280}
                        height={280}
                        className="relative z-10 h-[270px] w-[270px] object-contain drop-shadow-[0_3px_8px_rgba(92,73,55,0.12)]"
                        priority
                        onError={handleCharacterImageError}
                    />
                ) : (
                    <div className="relative z-10 h-[270px] w-[270px]" aria-hidden="true" />
                )}
            </div>

            {/* Share Card (肌智派证书) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative rounded-[20px] lg:rounded-[24px] p-6 lg:p-10 border border-brand-espresso/8 overflow-visible"
                style={{ background: "#F5F2ED" }}
            >
                <div className="relative z-10 w-full pr-0 lg:pr-[330px]">
                    {/* Text Content */}
                    <div className="flex flex-col justify-center z-10">
                        {/* 分享版标签 */}
                        <div className="relative z-10 mb-4 lg:mb-6 inline-flex h-[24px] px-2 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/15 bg-transparent text-xs font-bold text-[var(--color-brand-charcoal)] lg:h-[26px] lg:px-2.5 lg:text-xs lg:tracking-wide lg:rounded-lg lg:border lg:border-[var(--color-brand-charcoal)]/30 whitespace-nowrap self-start">
                            肌智派证书
                        </div>

                        <h2 className="text-lg lg:text-[24px] font-bold text-brand-espresso leading-snug tracking-tight mb-1 lg:mb-2">
                            你的肌肤类型是「{skinTypeName}」
                        </h2>

                        {score === undefined ? (
                            <h3 className="text-lg lg:text-[24px] font-bold text-brand-espresso leading-snug tracking-tight mb-3 lg:mb-4">
                                基于问卷的肤质评估
                            </h3>
                        ) : rankPercentile !== undefined ? (
                            <h3 className="text-lg lg:text-[24px] font-bold text-brand-espresso leading-snug tracking-tight mb-3 lg:mb-4">
                                测肤评分超越了全国 <span className="text-lg lg:text-[24px] px-0.5 text-[var(--color-brand-charcoal)]">{rankPercentile}%</span> 的用户
                            </h3>
                        ) : (
                            <h3 className="text-lg lg:text-[24px] font-bold text-brand-espresso leading-snug tracking-tight mb-3 lg:mb-4">
                                测肤评估已完成
                            </h3>
                        )}

                        <p className="text-[14px] leading-relaxed text-[var(--color-brand-cocoa)] mb-5 lg:mb-6 max-w-full lg:max-w-[420px]">
                            {summary || "详细分析见下方报告。"}
                        </p>

                        {/* 证书操作：翻到报告（主）/ 保存证书（次） */}
                        <div className="flex flex-col items-start gap-2.5">
                            <div className="flex flex-row flex-wrap items-center gap-3">
                                {onOpenReport && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={onOpenReport}
                                        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] h-[44px] px-6 rounded-full bg-[var(--color-brand-cocoa)] text-white text-xs sm:text-[13px] font-medium transition-colors hover:bg-[#4a3a2c]"
                                    >
                                        查看完整报告
                                        <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
                                    </motion.button>
                                )}
                                <motion.button
                                    whileHover={isPosterLoading ? {} : { scale: 1.02 }}
                                    whileTap={isPosterLoading ? {} : { scale: 0.98 }}
                                    onClick={onDownloadPoster}
                                    disabled={isPosterLoading}
                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] h-[44px] px-4 sm:px-6 rounded-full border border-[var(--color-brand-taupe)]/40 bg-transparent text-[var(--color-brand-cocoa)] text-xs sm:text-[13px] font-medium transition-colors hover:bg-brand-espresso/5 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isPosterLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-brand-taupe)] stroke-[2] animate-spin" />
                                    ) : (
                                        <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-brand-taupe)] stroke-[2]" />
                                    )}
                                    {isPosterLoading ? "生成中..." : "保存测肤证书"}
                                </motion.button>
                            </div>
                            {onOpenReport && (
                                <p className="text-[11px] font-light tracking-[0.06em] text-[var(--color-brand-cocoa)]/50">
                                    点击「查看完整报告」，查看你的专属肌肤档案
                                </p>
                            )}
                            {(dateText || idText) && (
                                <p className="text-[11px] font-light tracking-[0.08em] text-[var(--color-brand-cocoa)]/60">
                                    {dateText || ""}
                                    {dateText && idText ? " · " : ""}
                                    {idText ? `No.${idText}` : ""}
                                </p>
                            )}
                            {onReTest && (
                                <div className="mt-1 flex flex-col items-start gap-0.5">
                                    <button
                                        type="button"
                                        onClick={onReTest}
                                        className="text-[12px] font-medium text-[var(--color-brand-cocoa)]/70 underline underline-offset-4 hover:text-[var(--color-brand-cocoa)] transition-colors tracking-[0.04em]"
                                    >
                                        认为派系判断不准确？重新测试
                                    </button>
                                    <p className="text-[11px] font-light tracking-[0.04em] text-[var(--color-brand-cocoa)]/40">
                                        本次重新测试将消耗 1 次测试额度
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop: Character IP Image (absolute right) */}
                    {characterReady && (
                        <div className="hidden lg:block absolute right-0 top-[40%] -translate-y-1/2 z-0 pointer-events-none">
                            <Image
                                src={characterImgSrc}
                                alt={skinTypeName}
                                width={320}
                                height={320}
                                className="w-[320px] h-[320px] object-contain object-right"
                                priority
                                onError={handleCharacterImageError}
                            />
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
