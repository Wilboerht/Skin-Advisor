"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion as m, useReducedMotion } from "framer-motion";
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

    // IP 形象入场 + idle 漂浮（尊重减弱动效偏好）。
    // useMemo 固定引用：父组件状态变化（如海报按钮 loading）不应触发动画对象重建导致漂浮循环重启
    const ipAnimation = useMemo(
        () => ({
            initial: { opacity: 0, scale: 0.92 },
            animate: { opacity: 1, scale: 1, y: reduceMotion ? 0 : [0, -5, 0] },
            transition: {
                opacity: { duration: 0.5, delay: 0.05 },
                scale: { type: "spring" as const, stiffness: 260, damping: 20, delay: 0.05 },
                y: reduceMotion ? { duration: 0 } : { duration: 4.5, repeat: Infinity, ease: "easeInOut" as const },
            },
        }),
        [reduceMotion]
    );

    return (
        <div className="w-full flex flex-col gap-0 lg:contents" aria-label={`${nickname || "用户"}的肌智派证书`}>
            {/* Mobile: Character IP Image (above Share Card) */}
            <m.div
                {...ipAnimation}
                className="relative flex lg:hidden justify-center pointer-events-none mx-auto h-[300px] w-[300px]"
            >
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
                {characterReady && !characterImgFailed ? (
                    <Image
                        src={characterImgSrc}
                        alt={skinTypeName}
                        width={280}
                        height={280}
                        className="relative z-10 h-[300px] w-[300px] object-contain drop-shadow-[0_3px_8px_rgba(92,73,55,0.12)]"
                        priority
                        onError={handleCharacterImageError}
                    />
                ) : (
                    <div className="relative z-10 h-[300px] w-[300px]" aria-hidden="true" />
                )}
            </m.div>

            {/* Share Card (肌智派证书) */}
            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative rounded-[20px] lg:rounded-[24px] p-6 lg:p-10 border border-brand-espresso/8 overflow-visible -mt-5 lg:mt-0"
                style={{ background: "#F5F2ED" }}
            >
                {/* 卡片顶部径向暖光：IP 像从光里浮出来 */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[20px] lg:rounded-[24px] pointer-events-none"
                    style={{
                        background:
                            "radial-gradient(600px 280px at 50% -60px, rgba(255,248,235,0.9), rgba(255,248,235,0) 70%)",
                    }}
                />
                <div className="relative z-10 w-full pr-0 lg:pr-[330px]">
                    {/* Text Content */}
                    <div className="flex flex-col justify-center z-10">
                        {/* 分享版标签 */}
                        <div className="relative z-10 mb-4 lg:mb-6 inline-flex h-[24px] px-2 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/15 bg-transparent text-xs font-bold text-[var(--color-brand-charcoal)] lg:h-[26px] lg:px-2.5 lg:text-xs lg:tracking-wide lg:rounded-lg lg:border lg:border-[var(--color-brand-charcoal)]/30 whitespace-nowrap self-start">
                            肌智派证书
                        </div>

                        <h2 className="text-balance text-lg lg:text-[24px] font-bold text-brand-espresso leading-snug tracking-tight mb-1.5 lg:mb-2.5">
                            {isReturning ? "欢迎回来，您的最新「肌智派测肤报告」已生成" : "恭喜完成首次「肌智派测肤」！您的报告已生成"}
                        </h2>

                        <h3 className="text-balance text-base lg:text-lg font-semibold text-brand-espresso leading-snug tracking-tight mb-3 lg:mb-4">
                            根据检测结果，您的肌智派系为「{skinTypeName}」
                        </h3>
                        <p className="text-[12px] leading-relaxed text-[var(--color-brand-cocoa)]/60 mb-5 lg:mb-6 max-w-full lg:max-w-[420px] line-clamp-2">
                            {summary || "详细分析见下方报告。"}
                        </p>

                        {/* 证书操作：单 CTA 焦点（翻到报告）+ 次级文字入口（保存证书） */}
                        <div className="flex flex-col items-stretch sm:items-start gap-3 w-full">
                            {onOpenReport && (
                                <m.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={onOpenReport}
                                    className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto min-h-[48px] px-8 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[13px] sm:text-[14px] font-medium tracking-[0.06em] shadow-[0_8px_20px_rgba(61,47,37,0.18)] transition-colors hover:bg-[#4a3a2c]"
                                >
                                    查看完整报告
                                    <ChevronDown className="w-4 h-4" strokeWidth={2} />
                                </m.button>
                            )}
                            <button
                                onClick={onDownloadPoster}
                                disabled={isPosterLoading}
                                className="self-center sm:self-auto inline-flex items-center gap-1.5 px-2 py-1 text-[12px] text-[var(--color-brand-cocoa)]/60 font-light tracking-[0.04em] transition-colors hover:text-[var(--color-brand-cocoa)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPosterLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 stroke-[2] animate-spin" />
                                ) : (
                                    <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                                )}
                                {isPosterLoading ? "生成中..." : "保存测肤证书"}
                            </button>
                        </div>

                        {/* 证书落款：日期 · 编号（等宽数字，上细分隔线） */}
                        {(dateText || idText) && (
                            <div className="mt-5 pt-3 border-t border-brand-espresso/[0.08]">
                                <p className="text-[11px] font-light tracking-[0.08em] text-[var(--color-brand-cocoa)]/50 tabular-nums">
                                    {dateText || ""}
                                    {dateText && idText ? " · " : ""}
                                    {idText ? `No.${idText}` : ""}
                                </p>
                            </div>
                        )}

                        {onReTest && (
                            <button
                                type="button"
                                onClick={onReTest}
                                className="mt-3 text-[12px] font-medium text-[var(--color-brand-cocoa)]/70 underline underline-offset-4 hover:text-[var(--color-brand-cocoa)] transition-colors tracking-[0.04em]"
                            >
                                认为派系判断不准确？重新测试（消耗 1 次测试额度）
                            </button>
                        )}
                    </div>

                    {/* Desktop: Character IP Image (absolute right) */}
                    {characterReady && !characterImgFailed && (
                        <m.div
                            {...ipAnimation}
                            className="hidden lg:block absolute right-0 top-[40%] -translate-y-1/2 z-0 pointer-events-none"
                        >
                            <Image
                                src={characterImgSrc}
                                alt={skinTypeName}
                                width={380}
                                height={380}
                                className="w-[380px] h-[380px] object-contain object-right"
                                priority
                                onError={handleCharacterImageError}
                            />
                        </m.div>
                    )}
                </div>
            </m.div>
        </div>
    );
}
