"use client";

import { useCallback, useEffect, useState } from "react";
import { motion as m, useReducedMotion } from "framer-motion";
import { Gift, Loader2, Share2 } from "lucide-react";
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
    /** 参与抽奖入口（肌智派送好礼）；缺省时不展示 */
    onGift?: () => void;
    /** 复测用户（存在历史报告）：标题不再称"首次" */
    isReturning?: boolean;
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
    onDownloadPoster,
    isPosterLoading = false,
    certDate,
    certId,
    onOpenReport,
    onReTest,
    onGift,
    isReturning = false,
}: ShareCardPageProps) {
    const reduceMotion = useReducedMotion();
    // 纯问卷场景无评分：传中性分 80 落入 71-89 档，让 matchCharacterIP 按 skinType 匹配派系而非兜底守护派
    const ipParams: IPMatchParams = { score: score ?? 80, skinType, budget, skincareFrequency };
    const characterReady = gender === "male" || gender === "female";
    const characterImage = getCharacterImage({ ...ipParams, gender });
    const skinTypeName = getSkinTypeName(ipParams);

    const [characterImgSrc, setCharacterImgSrc] = useState(characterImage);
    const [characterImgFailed, setCharacterImgFailed] = useState(false);

    useEffect(() => {
        setCharacterImgSrc(characterImage);
        setCharacterImgFailed(false);
    }, [characterImage]);

    // 兜底链：目标图加载失败 → 同性别守护派占位（8 派×2 性别图均存在）→ 仍失败则隐藏，避免跨性别回退与重复 set 相同 src
    const guardianFallback = `/images/character/guardian/guardian_${gender === "male" ? "male" : "female"}.webp`;
    const handleCharacterImageError = useCallback(() => {
        if (characterImgSrc !== guardianFallback) {
            setCharacterImgSrc(guardianFallback);
        } else {
            setCharacterImgFailed(true);
        }
    }, [characterImgSrc, guardianFallback]);

    const dateText = formatCertDate(certDate);
    const idText = formatCertId(certId);

    // 揭晓仪式 stagger：文字逐行淡入（尊重减弱动效）
    const stagger = (delay: number) => ({
        initial: { opacity: 0, y: reduceMotion ? 0 : 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : delay, ease: "easeOut" as const },
    });

    return (
        <div className="w-full flex flex-col gap-0 lg:contents" aria-label={`${nickname || "用户"}的肌智派证书`}>
            {/* Share Card（肌智派证书）：浅色单底 + 金色证书内框；移动端上下分区、桌面端左右分区，虚线分隔 */}
            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.05 }}
                className="relative rounded-[20px] lg:rounded-[24px] border border-brand-espresso/8 overflow-hidden"
                style={{ background: "#F5F2ED" }}
            >
                {/* 金色双线证书框（烫金质感，全周） */}
                <div
                    aria-hidden="true"
                    className="absolute inset-2 rounded-[14px] lg:rounded-[18px] border border-[#C9A86C]/25 pointer-events-none"
                />
                <div
                    aria-hidden="true"
                    className="absolute inset-[10px] rounded-[10px] lg:rounded-[14px] border border-[#C9A86C]/12 pointer-events-none"
                />

                {/* 移动端：形象顶部居中，虚线横向分隔 */}
                <div className="lg:hidden relative z-10 flex flex-col items-center pt-5">
                    {characterReady && !characterImgFailed && (
                        <Image
                            src={characterImgSrc}
                            alt={skinTypeName}
                            width={160}
                            height={160}
                            className="w-[160px] h-[160px] object-contain"
                            priority
                            onError={handleCharacterImageError}
                        />
                    )}
                    <div className="w-[calc(100%-3rem)] mt-4 border-t border-dashed border-brand-espresso/[0.2]" />
                </div>

                {/* 桌面端：文字区与形象区之间的竖向虚线分隔 */}
                <div
                    aria-hidden="true"
                    className="hidden lg:block absolute inset-y-12 left-[64%] border-l border-dashed border-brand-espresso/[0.2] pointer-events-none"
                />

                {/* 文字区 */}
                <div className="relative z-10 w-full p-6 lg:p-10 lg:pr-[36%]">
                    <div className="flex flex-col justify-center">
                        {/* 分享版标签：弱化处理，不抢派系名焦点 */}
                        <m.div
                            {...stagger(0.1)}
                            className="relative z-10 mb-4 lg:mb-5 inline-flex h-[24px] px-2.5 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/12 bg-transparent text-[11px] font-medium text-[var(--color-brand-charcoal)]/60 tracking-[0.12em] whitespace-nowrap self-start"
                        >
                            肌智派证书
                        </m.div>

                        {/* 归属标题：层级低于派系名，中等字重、紧凑行高 */}
                        <m.h2
                            {...stagger(0.18)}
                            className="text-balance text-[16px] lg:text-[19px] font-medium text-brand-espresso leading-snug tracking-[0.01em] mb-2 lg:mb-2.5"
                        >
                            {isReturning ? "欢迎回来，您的测肤报告已更新" : "恭喜完成首次测肤，您的报告已生成"}
                        </m.h2>

                        {/* 派系名巨大化：结果即主角 */}
                        <m.p
                            {...stagger(0.26)}
                            className="text-[13px] text-brand-espresso/50 font-light tracking-[0.06em] mb-1.5"
                        >
                            根据检测结果，您的肌智派系为
                        </m.p>
                        <m.h3
                            {...stagger(0.3)}
                            className="text-balance text-[40px] lg:text-[48px] font-serif font-light text-brand-espresso leading-none tracking-[0.04em] mb-3 lg:mb-4"
                        >
                            「{skinTypeName}」
                        </m.h3>

                        {/* 摘要：适读字号 + 1.7 行高，移动端三行/桌面两行截断 */}
                        <m.p
                            {...stagger(0.36)}
                            className="text-[13px] leading-[1.7] text-[var(--color-brand-cocoa)]/60 max-w-full lg:max-w-[400px] line-clamp-3 lg:line-clamp-2"
                        >
                            {summary || "详细分析见下方报告。"}
                        </m.p>
                    </div>

                    {/* Desktop: Character IP Image（右侧静态，无背景色块，与文字区以虚线分隔） */}
                    {characterReady && !characterImgFailed && (
                        <div className="hidden lg:block absolute right-[1%] top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                            <Image
                                src={characterImgSrc}
                                alt={skinTypeName}
                                width={360}
                                height={360}
                                className="w-[340px] h-[340px] object-contain object-right drop-shadow-[0_10px_24px_rgba(0,0,0,0.15)]"
                                priority
                                onError={handleCharacterImageError}
                            />
                        </div>
                    )}
                </div>
            </m.div>

            {/* 证书卡外操作区：极简——单一实心主按钮 + 纯文字次级入口，弱化一切装饰 */}
            <m.div {...stagger(0.42)} className="flex flex-col items-center gap-3 mt-6">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                    {onOpenReport && (
                        <button
                            onClick={onOpenReport}
                            className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[13px] font-light tracking-[0.06em] transition-colors hover:bg-[#4a3a2c] cursor-pointer"
                        >
                            查看完整报告
                        </button>
                    )}
                    <button
                        onClick={onDownloadPoster}
                        disabled={isPosterLoading}
                        className="inline-flex items-center gap-1.5 h-10 px-1 text-[13px] text-brand-charcoal/55 font-light tracking-[0.04em] transition-colors hover:text-brand-charcoal disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isPosterLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                            <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                        )}
                        {isPosterLoading ? "生成中..." : "保存测肤证书"}
                    </button>
                </div>
                {onGift && (
                    <button
                        onClick={onGift}
                        className="inline-flex items-center gap-1.5 px-1 py-0.5 text-[12px] text-brand-charcoal/50 font-light tracking-[0.04em] transition-colors hover:text-brand-charcoal cursor-pointer"
                    >
                        <Gift className="w-3.5 h-3.5" strokeWidth={1.75} />
                        肌智派送好礼 · 参与抽奖
                    </button>
                )}

                {/* 证书落款：日期 · 编号 */}
                {(dateText || idText) && (
                    <m.p {...stagger(0.5)} className="text-[11px] font-light tracking-[0.08em] text-brand-charcoal/45 tabular-nums">
                        {dateText || ""}
                        {dateText && idText ? " · " : ""}
                        {idText ? `No.${idText}` : ""}
                    </m.p>
                )}

                {onReTest && (
                    <m.button
                        {...stagger(0.55)}
                        type="button"
                        onClick={onReTest}
                        className="text-[12px] font-light text-brand-charcoal/55 underline underline-offset-4 hover:text-brand-charcoal transition-colors tracking-[0.04em] cursor-pointer"
                    >
                        认为派系判断不准确？重新测试（消耗 1 次测试额度）
                    </m.button>
                )}
            </m.div>
        </div>
    );
}
