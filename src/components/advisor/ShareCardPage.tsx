"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, Gift, ImageDown, Loader2 } from "lucide-react";
import Image from "next/image";
import { getCharacterImage, matchCharacterIP, type IPMatchParams } from "@/lib/result-utils";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { formatCertDate, formatCertId } from "@/lib/poster-utils";
import { ReTestConfirmModal } from "@/components/advisor/result-modals";

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

/** 抽奖按钮悬浮彩带：品牌色系的碎纸片 */
const GIFT_CONFETTI_COLORS = ["#C9A86C", "#D4B77A", "#B8975B", "#D9730D", "#7A9FD4", "#7A9A5B"];

/** 移动端海报评分数字的衬线字体栈（对齐 demo/cert-mobile.html 的 --serif） */
const POSTER_SERIF_STYLE = { fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", Georgia, serif' } as const;

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
    // 纯问卷场景无评分：传中性分 80；matchCharacterIP 按 skinType 匹配派系（评分不再影响肤质派系命中）
    const ipParams: IPMatchParams = { score: score ?? 80, skinType, budget, skincareFrequency };
    const characterReady = gender === "male" || gender === "female";
    const characterImage = getCharacterImage({ ...ipParams, gender });
    const characterIp = matchCharacterIP(ipParams);
    const skinTypeName = characterIp.name;
    // 派系介绍（海报引语下方文案）：取对应派系 m1.intro，缺省回退 persona
    const factionContent = getSkinTypeByIpKey(characterIp.key);
    const factionIntro = factionContent?.m1.intro || factionContent?.m1.persona;

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
            {/* ===== 移动端：证书海报（对齐 demo/cert-mobile.html，全出血无卡片框；≥1024px 由桌面卡片接管） ===== */}
            <m.div
                initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.05 }}
                className="lg:hidden relative -mx-6 w-[calc(100%_+_3rem)] md:mx-auto md:w-full md:max-w-[480px] h-[600px] overflow-hidden bg-[#F2EDE5]"
            >
                {/* 下部灰蓝色块：斜切 */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[#A9BED1] [clip-path:polygon(0_47%,100%_42%,100%_100%,0_100%)]"
                />

                {/* 左侧背景水印：NIHPLOD 印章（透明 PNG，压在内容层之下）。
                    top 150 = 海报高度 600 - 水印高 440 - 10px 边距，同时与蓝区斜切保持稿中相对距离 */}
                <Image
                    src="/images/nihplod-seal.png"
                    alt=""
                    aria-hidden="true"
                    width={512}
                    height={512}
                    className="absolute left-[-110px] top-[150px] w-[440px] h-auto opacity-[0.26] pointer-events-none z-[1]"
                />

                {/* 文字区：引语 + 派系 + 文案，右侧评分徽章纵排。
                    顶部偏移 16px = 页头 ResultHeader pb-4（tab → 分割线距离），保证分割线上下视觉间距一致 */}
                <div className="absolute top-[16px] left-[28px] right-[28px] z-[4]">
                    <p className="text-[14px] tracking-[0.1em] text-[#22364B]/60">
                        {nickname || "用户"} 的肌肤派系是
                    </p>
                    <h3 className="mt-[10px] text-[38px] font-medium leading-[1.15] tracking-[0.04em] text-[#22364B]">
                        「{skinTypeName}」
                    </h3>
                    <p className="mt-[16px] max-w-[200px] text-[12.5px] leading-[1.9] tracking-[0.03em] text-[#6B7B8C] line-clamp-3">
                        {factionIntro || summary || "详细分析见下方报告。"}
                    </p>

                    {(score !== undefined || percentile !== null) && (
                        <div className="absolute right-0 top-0 flex flex-col items-center gap-3">
                            {/* 综合评分圆环（金边 + 虚线内圈，与桌面端徽章风格一致） */}
                            {score !== undefined && (
                                <div className="relative flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border border-[#C9A86C]/70">
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-[3px] rounded-full border border-dashed border-[#C9A86C]/40"
                                    />
                                    <div className="relative flex flex-col items-center leading-none">
                                        <span className="text-[22px] font-light text-[#3D2F25] tabular-nums" style={POSTER_SERIF_STYLE}>
                                            {Math.round(score)}
                                        </span>
                                        <span className="mt-1 text-[9px] tracking-[0.08em] text-[#3D2F25]/55">综合评分</span>
                                    </div>
                                </div>
                            )}
                            {/* 桂冠徽章：超过 X% 的用户（月桂左右枝合围） */}
                            {percentile !== null && (
                                <div className="relative flex h-[68px] w-[92px] items-center justify-center text-[#C9A86C]/85">
                                    <svg
                                        className="absolute inset-0 h-full w-full"
                                        viewBox="-28 108 1100 808"
                                        fill="currentColor"
                                        aria-hidden="true"
                                    >
                                        <g transform="translate(-290 0)">
                                            <path d="M447.6416 761.1648c-46.6176 3.1488-68.1216 29.056-61.3632 47.8976 6.784 18.8672 54.272 66.0992 134.0672 78.7712 79.7952 12.5952 158.72 6.8608 188.9024 6.8608 30.1568 0 65.6384-4.608 47.3088-21.76a454.8608 454.8608 0 0 0-143.4112-86.5024c-70.016-25.344-118.9632-28.544-165.504-25.2672z m-165.8368-225.4336c3.1744 21.9392 24.064 77.9264 84.3264 120.32a446.3616 446.3616 0 0 0 160.7168 71.0912c43.1872 9.9328 84.0704 23.4752 70.528-4.1216-13.5424-27.5968-59.2128-96.0768-125.3888-144.256-66.0736-48.0768-100.9664-53.8368-130.3552-60.5952-29.4912-6.6816-62.9248-4.3008-59.8272 17.5616z m20.3008-226.8672c-24.2432 0-22.6304 24.4224-16.2048 45.312 6.528 20.8384 34.304 83.1744 82.304 121.0368 31.9744 25.216 72.4992 47.1552 121.5232 65.664-10.88-67.7888-34.3552-121.0112-70.272-159.744-53.9136-58.2912-93.0816-72.192-117.3504-72.2688z m108.9536-180.6848a31.2832 31.2832 0 0 0-22.1184 6.1696 27.904 27.904 0 0 0-10.9824 19.2l-1.024 10.8032a240.3328 240.3328 0 0 0 14.4896 102.4c18.6112 49.664 46.5408 89.1648 83.7376 118.0416 7.296-26.4704 11.136-106.9568 2.2272-154.88-8.3968-45.4144-24.7808-72.2432-48.4352-93.8496a31.488 31.488 0 0 0-17.92-7.8848z" />
                                        </g>
                                        <g transform="translate(290 0)">
                                            <path d="M595.5328 761.1648c46.6176 3.1488 68.1472 29.056 61.3632 47.8976-6.7584 18.8672-54.2464 66.0992-134.0416 78.7712-79.7952 12.5952-158.72 6.8608-188.928 6.8608-30.1568 0-65.6384-4.608-47.2832-21.76a454.8608 454.8608 0 0 1 143.36-86.5024c70.0416-25.344 118.9888-28.544 165.5296-25.2672z m165.8624-225.4336c-3.1744 21.9392-24.0896 77.9264-84.352 120.32a446.336 446.336 0 0 1-160.7168 71.0912c-43.1872 9.9328-84.0704 23.4752-70.528-4.1216 13.5424-27.5968 59.2128-96.0768 125.3888-144.256 66.0992-48.0768 100.9664-53.8368 130.3808-60.5952 29.4656-6.6816 62.8992-4.3008 59.8272 17.5616z m-20.3264-226.8672c24.2688 0 22.6304 24.4224 16.2048 45.312-6.528 20.8384-34.304 83.1744-82.2784 121.0368-32 25.216-72.5248 47.1552-121.5488 65.664 10.88-67.7888 34.3808-121.0112 70.2976-159.744 53.9136-58.2912 93.0816-72.192 117.3248-72.2688z m-108.928-180.6848c7.7824-0.8448 15.6672 1.3824 22.0928 6.1696 6.016 4.352 10.0352 11.392 11.008 19.2l1.024 10.8032a240.3072 240.3072 0 0 1-14.5152 102.4c-18.5856 49.664-46.5408 89.1648-83.712 118.0416-7.296-26.4704-11.1616-106.9568-2.2528-154.88 8.3968-45.4144 24.7808-72.2432 48.4352-93.8496 5.12-4.5312 11.392-7.296 17.92-7.8848z" />
                                        </g>
                                    </svg>
                                    <div className="relative flex flex-col items-center">
                                        <span className="text-[8px] leading-[1.4] tracking-[0.06em] text-[#3D2F25]/55">超过</span>
                                        <span className="text-[15px] font-light leading-[1.1] text-[#3D2F25] tabular-nums" style={POSTER_SERIF_STYLE}>
                                            {percentile}%
                                        </span>
                                        <span className="text-[8px] leading-[1.4] tracking-[0.06em] text-[#3D2F25]/55">的用户</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 角色：右侧站立，脚底距海报下缘 3px，压制蓝色斜切块之上 */}
                {characterReady && !characterImgFailed && (
                    <Image
                        src={characterImgSrc}
                        alt={skinTypeName}
                        width={480}
                        height={640}
                        className="absolute right-[-80px] bottom-[3px] z-[3] h-[440px] w-auto object-contain drop-shadow-[0_18px_24px_rgba(35,54,75,0.28)]"
                        priority
                        onError={handleCharacterImageError}
                    />
                )}

                {/* 证书内操作区：人物左侧空白处（logo + 查看完整报告 / 保存证书 / 参与抽奖）
                    三个按钮沿用首页「立刻体验」贴纸样式，三级层级：主 CTA 实心阴影、次按钮减弱、抽奖金色阴影 */}
                <div className="absolute left-[28px] bottom-[32px] z-[5] flex w-[158px] flex-col items-stretch gap-[10px]">
                    <Image
                        src="/images/jzp-eyebrow.png"
                        alt="肌智派"
                        width={256}
                        height={156}
                        className="mb-[6px] w-[104px] h-auto self-start"
                    />
                    {onOpenReport && (
                        <button
                            type="button"
                            onClick={onOpenReport}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#22304E]/10 bg-white px-[14px] text-[13px] font-bold tracking-[0.15em] text-[#22304E] shadow-[3px_4px_0_0_rgba(34,48,78,0.85)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_3px_0_0_rgba(34,48,78,0.85)] cursor-pointer"
                        >
                            查看完整报告
                            <ArrowRight className="h-[13px] w-[13px] flex-none" strokeWidth={1.75} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onDownloadPoster}
                        disabled={isPosterLoading}
                        aria-busy={isPosterLoading}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#22304E]/10 bg-white px-[14px] text-[13px] font-bold tracking-[0.15em] text-[#22304E]/75 shadow-[2px_3px_0_0_rgba(34,48,78,0.28)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[1px_2px_0_0_rgba(34,48,78,0.28)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isPosterLoading ? (
                            <Loader2 className="h-[13px] w-[13px] flex-none animate-spin" strokeWidth={2} />
                        ) : (
                            <ImageDown className="h-[13px] w-[13px] flex-none" strokeWidth={1.75} />
                        )}
                        {isPosterLoading ? "生成中..." : "保存证书"}
                    </button>
                    {onGift && (
                        <button
                            type="button"
                            onClick={onGift}
                            onMouseEnter={fireGiftConfetti}
                            onFocus={fireGiftConfetti}
                            className="relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#C9A86C]/55 bg-white px-[14px] text-[13px] font-bold tracking-[0.15em] text-[#8B6914] shadow-[3px_4px_0_0_rgba(201,168,108,0.95)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_3px_0_0_rgba(201,168,108,0.95)] cursor-pointer"
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
                            <Gift className="h-[13px] w-[13px] flex-none" strokeWidth={1.75} />
                            参与抽奖
                        </button>
                    )}
                </div>

                {/* 重新测试入口：人物 IP 右下角问号按钮；无额度时同一位置改显原因文案 */}
                {onReTest && (
                    reTestBlockedReason ? (
                        <p className="absolute right-[24px] bottom-[40px] z-[6] max-w-[170px] text-right text-[11px] font-light leading-[1.6] tracking-[0.04em] text-[#22364B]/45">
                            {reTestBlockedReason === "login"
                                ? "登录后可重新测试"
                                : reTestBlockedReason === "lifetime"
                                    ? "测肤次数已用完"
                                    : "今日测试次数已用完"}
                        </p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowReTestConfirm(true)}
                            aria-label="重新测试"
                            className="absolute right-[24px] bottom-[32px] z-[6] inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#FDFCF9]/92 text-[14px] font-semibold leading-none text-[#22364B]/72 shadow-[0_3px_10px_rgba(35,54,75,0.14)] transition-colors hover:bg-[#FDFCF9] hover:text-[#22364B] cursor-pointer"
                        >
                            ?
                        </button>
                    )
                )}
            </m.div>

            {/* ===== 桌面端：证书卡（保持原有版式，≥1024px 生效） ===== */}
            <div className="hidden lg:contents">
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

                        {/* 摘要：右缘与徽章右缘对齐（桌面端同样内缩 24px），行高独立于区块间距 */}
                        <m.p
                            {...stagger(0.4)}
                            className="text-[13px] lg:text-[14px] leading-[1.7] lg:leading-[1.75] text-[var(--color-brand-cocoa)]/65 lg:pr-6 line-clamp-3"
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
                        className="group inline-flex w-full sm:w-auto sm:min-w-[224px] items-center justify-center gap-2 h-11 px-8 rounded-full border border-brand-cocoa/25 bg-brand-cocoa/[0.07] text-brand-cocoa text-[14px] font-medium tracking-[0.08em] transition-colors duration-200 hover:border-brand-cocoa/40 hover:bg-brand-cocoa/[0.12] active:bg-brand-cocoa/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2ED] cursor-pointer"
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
                    <m.div {...stagger(0.55)} className="mt-6 flex justify-center">
                        <button
                            type="button"
                            onClick={() => setShowReTestConfirm(true)}
                            className="text-[11px] font-light text-brand-charcoal/45 tracking-[0.04em] underline-offset-4 transition-colors hover:text-brand-charcoal/70 hover:underline cursor-pointer"
                        >
                            认为派系判断不准确？重新测试（消耗 1 次测试额度）
                        </button>
                    </m.div>
                )
            )}
            </div>

            {/* 重新测试二次确认：移动端「?」与桌面端文字入口共用（样式对齐保存海报弹窗） */}
            {onReTest && !reTestBlockedReason && (
                <ReTestConfirmModal
                    isOpen={showReTestConfirm}
                    onClose={() => setShowReTestConfirm(false)}
                    onConfirm={() => {
                        setShowReTestConfirm(false);
                        onReTest();
                    }}
                />
            )}
        </div>
    );
}
