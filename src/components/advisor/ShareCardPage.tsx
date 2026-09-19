"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, Gift, ImageDown, Loader2 } from "lucide-react";
import Image from "next/image";
import { getCharacterImage, getSkinTypeName, type IPMatchParams } from "@/lib/result-utils";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface ShareCardPageProps {
    nickname: string;
    score?: number;
    /** 综合评分百分位（后端真实聚合）；null/undefined 时不展示"超过 X% 用户"副标 */
    percentile?: number | null;
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
    /** 重新测试不可用原因：login=需登录 / daily=今日用完 / lifetime=总次数用完；缺省=可用（正常展示入口） */
    reTestBlockedReason?: "login" | "daily" | "lifetime" | null;
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

/** 抽奖按钮悬浮彩带：品牌色系的碎纸片 */
const GIFT_CONFETTI_COLORS = ["#C9A86C", "#D4B77A", "#B8975B", "#D9730D", "#7A9FD4", "#7A9A5B"];

interface GiftConfettiPiece {
    id: number;
    x: number;
    y: number;
    rotate: number;
    width: number;
    height: number;
    color: string;
    delay: number;
    duration: number;
}

export default function ShareCardPage({
    nickname,
    score,
    percentile = null,
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
    reTestBlockedReason = null,
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

    // 抽奖按钮悬浮彩带：一次性爆发，动画期间不重复触发
    const [giftConfetti, setGiftConfetti] = useState<GiftConfettiPiece[]>([]);
    const giftConfettiTimer = useRef<number | null>(null);
    const giftConfettiSeq = useRef(0);

    const fireGiftConfetti = useCallback(() => {
        if (reduceMotion || giftConfettiTimer.current !== null) return;
        const pieces = Array.from({ length: 24 }, (_, i) => {
            const angle = ((-160 + Math.random() * 140) * Math.PI) / 180;
            const distance = 40 + Math.random() * 50;
            return {
                id: ++giftConfettiSeq.current,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                rotate: (Math.random() - 0.5) * 540,
                width: 3 + Math.round(Math.random() * 3),
                height: 8 + Math.round(Math.random() * 8),
                color: GIFT_CONFETTI_COLORS[i % GIFT_CONFETTI_COLORS.length],
                delay: Math.random() * 0.1,
                duration: 0.7 + Math.random() * 0.4,
            };
        });
        setGiftConfetti(pieces);
        giftConfettiTimer.current = window.setTimeout(() => {
            setGiftConfetti([]);
            giftConfettiTimer.current = null;
        }, 1300);
    }, [reduceMotion]);

    useEffect(() => () => {
        if (giftConfettiTimer.current !== null) window.clearTimeout(giftConfettiTimer.current);
    }, []);

    // 重新测试二次确认：会清空当前测肤记录并消耗 1 次额度，误触成本高
    const [showReTestConfirm, setShowReTestConfirm] = useState(false);

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
                className="relative rounded-[20px] lg:rounded-[24px] border border-brand-espresso/8"
                style={{ background: "#F5F2ED" }}
            >
                {/* 金色双线证书框（烫金质感，全周） */}
                <div
                    aria-hidden="true"
                    className="absolute inset-2 rounded-[14px] lg:rounded-[18px] border border-[#C9A86C]/30 pointer-events-none"
                />
                <div
                    aria-hidden="true"
                    className="absolute inset-[10px] rounded-[10px] lg:rounded-[14px] border border-[#C9A86C]/14 pointer-events-none"
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
                <div className="relative z-10 w-full px-6 pt-6 pb-12 lg:p-10 lg:pr-[36%]">
                    {/* 间距系统：区块间统一 16/24px（gap-4 lg:gap-6），组内统一 6px（gap-1.5），全部落在 4px 网格上 */}
                    <div className="flex flex-col justify-center gap-4 lg:gap-6">
                        {/* 分享版标签：弱化处理，不抢派系名焦点 */}
                        <m.div
                            {...stagger(0.1)}
                            className="relative z-10 inline-flex h-[24px] px-2.5 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/12 bg-transparent text-[11px] font-medium text-[var(--color-brand-charcoal)]/60 tracking-[0.12em] whitespace-nowrap self-start"
                        >
                            肌智派证书
                        </m.div>

                        {/* 归属标题：同行区块，间距交给父层 gap */}
                        <m.h2
                            {...stagger(0.18)}
                            className="text-balance text-[15px] lg:text-[18px] font-medium text-brand-espresso/80 leading-snug tracking-[0.01em]"
                        >
                            {isReturning ? "欢迎回来，您的测肤报告已更新" : "恭喜完成首次测肤，您的报告已生成"}
                        </m.h2>

                        {/* 派系宣告：左侧「引语 + 派系名」两行；右侧徽章占满两行高度（顶部=引语顶、底部=派系名底）
                            徽章高度 = 引语行高(12×1.5=18 / 13×1.5=19.5) + gap-1.5(6) + 派系名(40/48) = 64 / 73.5 */}
                        <div className={`flex items-start justify-between gap-4 lg:gap-5 lg:pr-6 ${percentile !== null ? "pb-4" : ""}`}>
                            <div className="flex flex-col gap-1.5">
                                <m.p
                                    {...stagger(0.26)}
                                    className="text-[12px] lg:text-[13px] text-brand-espresso/45 font-light tracking-[0.1em]"
                                >
                                    根据检测结果，您的肌智派系为
                                </m.p>
                                <m.h3
                                    {...stagger(0.3)}
                                    className="text-[40px] lg:text-[48px] font-serif font-light text-brand-espresso leading-none tracking-[0.12em]"
                                >
                                    {skinTypeName}
                                </m.h3>
                            </div>
                            {score !== undefined && (
                                <m.div {...stagger(0.34)} className="relative flex shrink-0">
                                    <div className="relative flex h-16 w-16 lg:h-[73.5px] lg:w-[73.5px] flex-col items-center justify-center rounded-full border border-brand-gold/55">
                                        <div aria-hidden="true" className="absolute inset-[3px] rounded-full border border-dashed border-brand-gold/30" />
                                        <div className="flex flex-col items-center leading-none">
                                            <span className="font-serif text-[22px] lg:text-[26px] font-light text-brand-espresso tabular-nums">
                                                {Math.round(score)}
                                            </span>
                                            <span className="mt-1 text-[9px] tracking-[0.08em] text-brand-espresso/55">综合评分</span>
                                        </div>
                                    </div>
                                    {percentile !== null && (
                                        <p className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-light leading-none tracking-[0.02em] text-brand-espresso/50">
                                            超过 {percentile}% 的用户
                                        </p>
                                    )}
                                </m.div>
                            )}
                        </div>

                        {/* 摘要：适读字号 + 三行截断，行高独立于区块间距 */}
                        <m.p
                            {...stagger(0.4)}
                            className="text-[13px] lg:text-[14px] leading-[1.7] lg:leading-[1.75] text-[var(--color-brand-cocoa)]/65 max-w-full lg:max-w-[430px] line-clamp-3"
                        >
                            {summary || "详细分析见下方报告。"}
                        </m.p>
                    </div>

                    {/* Desktop: Character IP Image（高度随卡片自适应，底部与文字区对齐，顶部探出卡片上缘） */}
                    {characterReady && !characterImgFailed && (
                        <div className="hidden lg:block absolute right-3 -top-20 bottom-10 z-10 pointer-events-none">
                            <Image
                                src={characterImgSrc}
                                alt={skinTypeName}
                                width={480}
                                height={640}
                                className="h-full w-auto object-contain object-right drop-shadow-[0_10px_24px_rgba(0,0,0,0.15)]"
                                priority
                                onError={handleCharacterImageError}
                            />
                        </div>
                    )}
                </div>

                {/* 证书落款：日期 · 编号，固定在卡片右下角 */}
                {(dateText || idText) && (
                    <m.p
                        {...stagger(0.5)}
                        className="absolute bottom-4 right-5 z-10 text-[11px] font-light tracking-[0.08em] text-brand-charcoal/45 tabular-nums"
                    >
                        {dateText || ""}
                        {dateText && idText ? " · " : ""}
                        {idText ? `No.${idText}` : ""}
                    </m.p>
                )}
            </m.div>

            {/* 证书卡外操作区：主 CTA 独占一行（浅色 tonal 大按钮，避免实心过重），次级操作一行（描边胶囊） */}
            <m.div {...stagger(0.42)} className="flex flex-col items-center gap-3 mt-6">
                {onOpenReport && (
                    <button
                        onClick={onOpenReport}
                        className="group inline-flex w-full sm:w-auto sm:min-w-[224px] items-center justify-center gap-2 h-11 px-8 rounded-full border border-brand-cocoa/25 bg-brand-cocoa/[0.07] text-brand-cocoa text-[14px] font-medium tracking-[0.08em] transition-colors duration-200 hover:border-brand-cocoa/40 hover:bg-brand-cocoa/[0.12] active:bg-brand-cocoa/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2ED] lg:pointer-fine:hidden cursor-pointer"
                    >
                        查看完整报告
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                    </button>
                )}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
                    <button
                        onClick={onDownloadPoster}
                        disabled={isPosterLoading}
                        aria-busy={isPosterLoading}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 h-10 min-w-[10.5em] px-4 rounded-full border border-brand-espresso/12 text-[13px] text-brand-charcoal/70 font-light tracking-[0.04em] transition-colors hover:border-brand-espresso/25 hover:bg-brand-espresso/[0.03] hover:text-brand-charcoal active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2ED] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isPosterLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                            <ImageDown className="w-3.5 h-3.5" strokeWidth={1.75} />
                        )}
                        {isPosterLoading ? "生成中..." : "保存测肤证书"}
                    </button>
                    {onGift && (
                        <button
                            onClick={onGift}
                            onMouseEnter={fireGiftConfetti}
                            onFocus={fireGiftConfetti}
                            className="group relative inline-flex w-full sm:w-auto items-center justify-center gap-1.5 h-10 px-4 rounded-full border border-brand-gold/40 text-[13px] text-brand-bronze font-light tracking-[0.04em] transition-colors hover:border-brand-gold/70 hover:bg-brand-gold/[0.08] active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2ED] cursor-pointer"
                        >
                            {/* 悬浮彩带：从按钮中心向上扇形迸发，指针事件穿透不影响点击 */}
                            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2">
                                {giftConfetti.map((piece) => (
                                    <m.span
                                        key={piece.id}
                                        initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
                                        animate={{ x: piece.x, y: piece.y, opacity: [0, 1, 1, 0], rotate: piece.rotate, scale: 1 }}
                                        transition={{ duration: piece.duration, delay: piece.delay, ease: "easeOut" }}
                                        className="absolute rounded-[1px]"
                                        style={{
                                            width: piece.width,
                                            height: piece.height,
                                            marginLeft: -piece.width / 2,
                                            marginTop: -piece.height / 2,
                                            backgroundColor: piece.color,
                                        }}
                                    />
                                ))}
                            </span>
                            <Gift className="w-3.5 h-3.5 transition-transform group-hover:-rotate-6 group-hover:scale-110" strokeWidth={1.75} />
                            肌智派送好礼 · 参与抽奖
                        </button>
                    )}
                </div>
            </m.div>

            {/* 重新测试：无额度时展示原因而非入口，避免点进去才发现走不通；可用时与主 CTA 拉开距离、视觉降级，点击后二次确认 */}
            {onReTest && (
                reTestBlockedReason ? (
                    <m.div {...stagger(0.55)} className="mt-6 flex justify-center">
                        <p className="text-[11px] font-light text-brand-charcoal/35 tracking-[0.04em]">
                            {reTestBlockedReason === "login"
                                ? "登录后可重新测试"
                                : reTestBlockedReason === "lifetime"
                                    ? "测肤次数已用完"
                                    : "今日测试次数已用完"}
                        </p>
                    </m.div>
                ) : (
                    <>
                        <m.div {...stagger(0.55)} className="mt-6 flex justify-center">
                            <button
                                type="button"
                                onClick={() => setShowReTestConfirm(true)}
                                className="text-[11px] font-light text-brand-charcoal/45 tracking-[0.04em] underline-offset-4 transition-colors hover:text-brand-charcoal/70 hover:underline cursor-pointer"
                            >
                                认为派系判断不准确？重新测试（消耗 1 次测试额度）
                            </button>
                        </m.div>
                        <ConfirmModal
                            isOpen={showReTestConfirm}
                            onClose={() => setShowReTestConfirm(false)}
                            onConfirm={() => {
                                setShowReTestConfirm(false);
                                onReTest();
                            }}
                            title="重新测试？"
                            message="重新测试将清空当前测肤记录，并消耗 1 次测试额度。确认开始吗？"
                            confirmText="重新测试"
                            cancelText="取消"
                            variant="warning"
                        />
                    </>
                )
            )}
        </div>
    );
}
