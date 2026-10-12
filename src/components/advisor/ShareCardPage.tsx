"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, Gift, ImageDown, Info, Loader2 } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { getCharacterImage, matchCharacterIP, type IPMatchParams } from "@/lib/result-utils";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { getConcernLabel } from "@/lib/advisor-labels";
import { ReTestConfirmModal } from "@/components/advisor/result-modals";
import { useLazyOpen } from "@/hooks/use-lazy-open";

// 派系介绍弹窗：首次点击按钮才下载 chunk（配合 useLazyOpen latch，不进入首屏）
const SkinTypeModal = dynamic(
    () => import("@/components/website/SkinTypeModal").then((mod) => mod.SkinTypeModal),
    { ssr: false }
);

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
    /** 皮肤特点短标签（桌面端活页纸「皮肤特点」栏；来自 skinProfile.concerns） */
    concerns?: string[];
    onDownloadPoster: () => void;
    isPosterLoading?: boolean;
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
    concerns = [],
    onDownloadPoster,
    isPosterLoading = false,
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
    // 桌面端活页纸「护肤建议」栏：派系静态建议前 2 条（m7 建议标题）
    const adviceTags = (factionContent?.m7.suggestions ?? []).slice(0, 2).map((s) => s.title);
    // 桌面端「皮肤特点」栏：concerns 落库存的是 identifyConcerns 原始 key，展示前映射为中文标签；
    // 取前 2 条——区域纵向空间有限（夹在两个烘焙标签之间），3 条会贴近下方「护肤建议」标签
    const concernLabels = concerns.slice(0, 2).map((c) => getConcernLabel(c));

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

    // 派系介绍弹窗（移动端海报「查看派系介绍」入口）
    const [showFactionIntro, setShowFactionIntro] = useState(false);
    const shouldRenderFactionIntro = useLazyOpen(showFactionIntro);

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
                className="lg:hidden relative -mx-6 w-[calc(100%_+_3rem)] md:mx-auto md:w-full md:max-w-[480px] h-[560px] overflow-hidden bg-[#F2EDE5]"
            >
                {/* 下部灰蓝色块：斜切 */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[#A9BED1] [clip-path:polygon(0_47%,100%_42%,100%_100%,0_100%)]"
                />

                {/* 文字区：引语 + 派系 + 文案，评分徽章右上纵排。
                    顶部偏移 0：tab → 引语 = 页头 ResultHeader pb-4（16px），
                    与标题 mb-4 → tab（16px）等距，tab 上下间距对称 */}
                <div className="absolute top-0 left-[28px] right-[28px] z-[4]">
                    <p className="text-[14px] tracking-[0.1em] text-[#22364B]/60">
                        {isReturning ? "欢迎回来，您的肌肤派系是：" : "根据测肤结果，您的肌肤派系是："}
                    </p>
                    <h3 className="mt-[12px] text-[34px] font-medium leading-[1.15] tracking-[0.04em] text-[#22364B]">
                        「{skinTypeName}」
                    </h3>
                    <p className="mt-[16px] max-w-[200px] text-[12.5px] leading-[1.9] tracking-[0.03em] text-[#6B7B8C] line-clamp-3">
                        {factionIntro || summary || "详细分析见下方报告。"}
                    </p>

                    {/* 派系介绍入口：打开对应派系的说明弹窗（首次点击才加载弹窗 chunk） */}
                    {factionContent && (
                        <button
                            type="button"
                            onClick={() => setShowFactionIntro(true)}
                            className="mt-3 inline-flex h-[30px] items-center gap-1.5 rounded-full border border-[#22364B]/15 bg-white/70 px-3.5 text-[11px] font-medium tracking-[0.08em] text-[#22364B]/75 transition-colors hover:bg-white hover:border-[#22364B]/30 active:scale-[0.98] cursor-pointer"
                        >
                            <Info className="h-3.5 w-3.5 flex-none" strokeWidth={1.75} />
                            查看派系介绍
                        </button>
                    )}

                    {/* 评分徽章：综合评分圆环 + 超过 X% 桂冠，右上角纵排 */}
                    {(score !== undefined || percentile !== null) && (
                        <div className="absolute right-0 top-0 flex flex-col items-center gap-2.5">
                            {/* 综合评分圆环（金边 + 虚线内圈，与桌面端徽章风格一致） */}
                            {score !== undefined && (
                                <div className="relative flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full border border-[#C9A86C]/70">
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-[3px] rounded-full border border-dashed border-[#C9A86C]/40"
                                    />
                                    <div className="relative flex flex-col items-center leading-none">
                                        <span className="text-[18px] font-light text-[#3D2F25] tabular-nums" style={POSTER_SERIF_STYLE}>
                                            {Math.round(score)}
                                        </span>
                                        <span className="mt-0.5 text-[8px] tracking-[0.08em] text-[#3D2F25]/55">综合评分</span>
                                    </div>
                                </div>
                            )}
                            {/* 桂冠徽章：超过 X% 的用户（月桂左右枝合围） */}
                            {percentile !== null && (
                                <div className="relative flex h-[54px] w-[74px] items-center justify-center text-[#C9A86C]/85">
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
                                        <span className="text-[7px] leading-[1.4] tracking-[0.06em] text-[#3D2F25]/55">超过</span>
                                        <span className="text-[13px] font-light leading-[1.1] text-[#3D2F25] tabular-nums" style={POSTER_SERIF_STYLE}>
                                            {percentile}%
                                        </span>
                                        <span className="text-[7px] leading-[1.4] tracking-[0.06em] text-[#3D2F25]/55">的用户</span>
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
                        className="absolute right-[-60px] bottom-[3px] z-[3] h-[420px] w-auto object-contain drop-shadow-[0_18px_24px_rgba(35,54,75,0.28)]"
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
                        className="w-[104px] h-auto self-start"
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
                        <p className="absolute right-[28px] bottom-[40px] z-[6] max-w-[170px] text-right text-[11px] font-light leading-[1.6] tracking-[0.04em] text-[#22364B]/45">
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
                            className="absolute right-[28px] bottom-[32px] z-[6] inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#FDFCF9]/92 text-[14px] font-semibold leading-none text-[#22364B]/72 shadow-[0_3px_10px_rgba(35,54,75,0.14)] transition-colors hover:bg-[#FDFCF9] hover:text-[#22364B] cursor-pointer"
                        >
                            ?
                        </button>
                    )
                )}
            </m.div>

            {/* ===== 桌面端：活页笔记本证书（静态元素烘焙进背景图，动态字段绝对定位覆盖，≥1024px 生效） ===== */}
            <div className="hidden lg:contents">
            {/* 容器即坐标系：aspect 锁定背景图比例（2960×1636），container-type 让 cqw 字号随卡片宽度等比缩放 */}
            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.05 }}
                className="relative w-full aspect-[2960/1636] [container-type:inline-size]"
            >
                <Image
                    src="/images/cert-pc-bg.webp"
                    alt=""
                    fill
                    priority
                    sizes="(min-width: 1024px) 900px, 100vw"
                    className="object-contain pointer-events-none select-none"
                />

                {/* IP 形象：卡片最左缘站立，身高超过卡片（头顶探出上缘），脚踩蓝灰色块 */}
                {characterReady && !characterImgFailed && (
                    <Image
                        src={characterImgSrc}
                        alt={skinTypeName}
                        width={480}
                        height={640}
                        className="absolute left-[-28%] bottom-[-15%] z-[3] h-[130%] w-auto object-contain object-bottom drop-shadow-[0_18px_24px_rgba(35,54,75,0.28)]"
                        priority
                        onError={handleCharacterImageError}
                    />
                )}

                {/* 左区：@昵称 / 引语 / 派系名（收于烘焙问号涂鸦左侧） */}
                <div className="absolute left-[25%] top-[23%] z-[4] flex max-w-[26%] flex-col items-start">
                    <m.p {...stagger(0.1)} className="text-[1.7cqw] tracking-[0.06em] text-[#22364B]/70">
                        @{nickname || "用户"}
                    </m.p>
                    <m.p
                        {...stagger(0.16)}
                        className="mt-[0.9cqw] inline-flex items-center bg-[#EFE6D2] px-[0.9cqw] py-[0.35cqw] text-[1.7cqw] tracking-[0.04em] text-[#22364B]/85"
                    >
                        {isReturning ? "欢迎回来，你的肌智派系是" : "你的肌智派系是"}
                    </m.p>
                    <m.h3
                        {...stagger(0.22)}
                        className="mt-[1.2cqw] -ml-[0.5em] text-[4.6cqw] font-medium leading-[1.15] tracking-[0.04em] text-[#22364B]"
                    >
                        「{skinTypeName}」
                    </m.h3>
                </div>

                {/* 左区：派系引语（蓝灰色块内，斜边上缘最低点 54.5% 以下，两行截断） */}
                <m.p
                    {...stagger(0.3)}
                    className="absolute left-[25%] top-[57.5%] z-[4] max-w-[23%] text-[1.7cqw] leading-[1.9] tracking-[0.03em] text-[#22364B]/85 line-clamp-2"
                >
                    {factionIntro || summary || "详细分析见完整报告。"}
                </m.p>

                {/* 左区：抽奖入口（蓝灰色块上） */}
                {onGift && (
                    <m.div {...stagger(0.36)} className="absolute left-[25%] top-[74.5%] z-[5] flex flex-col items-start gap-[0.8cqw]">
                        <p className="flex items-center gap-[0.4cqw] text-[1.7cqw] tracking-[0.06em] text-[#22364B]/80">
                            <Gift className="h-[1.8cqw] w-[1.8cqw] flex-none" strokeWidth={1.75} />
                            肌智派送好礼：
                        </p>
                        <button
                            type="button"
                            onClick={onGift}
                            onMouseEnter={fireGiftConfetti}
                            onFocus={fireGiftConfetti}
                            className="relative inline-flex h-[3.4cqw] min-h-[32px] items-center justify-center border border-[#22364B]/15 bg-white px-[2.2cqw] text-[1.7cqw] font-medium tracking-[0.1em] text-[#22364B] shadow-[0_3px_10px_rgba(35,54,75,0.16)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
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
                            点击查看活动
                        </button>
                    </m.div>
                )}

                {/* 右页：综合评分（烘焙标签正下方）；无评分时用纸色块盖住烘焙文案 */}
                {score !== undefined ? (
                    <m.p
                        {...stagger(0.26)}
                        className="absolute left-[62%] top-[33%] z-[4] w-[20%] text-center text-[8.5cqw] font-medium leading-none text-[#22364B] tabular-nums"
                        style={POSTER_SERIF_STYLE}
                    >
                        {Math.round(score)}
                    </m.p>
                ) : (
                    <div aria-hidden="true" className="absolute left-[63%] top-[24%] z-[3] h-[25%] w-[18%] bg-[#F7F3EC]" />
                )}

                {/* 右页：百分位（烘焙"击败了全国 / 的用户"之间）；无数据时盖住圆环内烘焙文字 */}
                {percentile !== null ? (
                    <m.p
                        {...stagger(0.32)}
                        className="absolute left-[62%] top-[60%] z-[4] w-[20%] text-center text-[3.5cqw] font-medium leading-none text-[#22364B] tabular-nums"
                        style={POSTER_SERIF_STYLE}
                    >
                        {percentile}%
                    </m.p>
                ) : (
                    <div aria-hidden="true" className="absolute left-[67.5%] top-[55%] z-[3] h-[17%] w-[10.5%] bg-[#F7F3EC]" />
                )}

                {/* 右页：皮肤特点（对齐烘焙标签左缘 83%，不超出纸面右缘 93%，最多 2 条） */}
                {concernLabels.length > 0 && (
                    <m.ul {...stagger(0.38)} className="absolute left-[83%] top-[47%] z-[4] flex w-[10%] flex-col gap-[0.5cqw]">
                        {concernLabels.map((c) => (
                            <li key={c} className="text-[1.35cqw] leading-[1.3] tracking-[0.04em] text-[#22364B]/85 line-clamp-1">{c}</li>
                        ))}
                    </m.ul>
                )}

                {/* 右页：护肤建议（派系静态建议前 2 条，对齐烘焙标签左缘、不超出纸面右缘） */}
                {adviceTags.length > 0 && (
                    <m.ul {...stagger(0.44)} className="absolute left-[83%] top-[66%] z-[4] flex w-[10%] flex-col gap-[0.6cqw]">
                        {adviceTags.map((t) => (
                            <li key={t} title={t} className="text-[1.25cqw] leading-[1.35] tracking-[0.02em] text-[#22364B]/85 line-clamp-2">{t}</li>
                        ))}
                    </m.ul>
                )}
            </m.div>

            {/* 卡外操作区：主 CTA 深色实心 + 保存证书描边，并排居中（对齐效果图） */}
            <m.div {...stagger(0.42)} className="flex items-center justify-center gap-4 mt-6">
                {onOpenReport && (
                    <button
                        onClick={onOpenReport}
                        className="group inline-flex min-w-[224px] h-11 px-8 items-center justify-center gap-2 rounded-full bg-[#1D3A5F] text-white text-[14px] font-medium tracking-[0.08em] transition-colors duration-200 hover:bg-[#16304F] active:bg-[#122842] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D3A5F]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F2EDE5] cursor-pointer"
                    >
                        查看完整报告
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                    </button>
                )}
                <button
                    onClick={onDownloadPoster}
                    disabled={isPosterLoading}
                    aria-busy={isPosterLoading}
                    className="inline-flex min-w-[224px] h-11 px-8 items-center justify-center gap-2 rounded-full border border-[#1D3A5F]/55 text-[#1D3A5F] text-[14px] font-medium tracking-[0.08em] transition-colors duration-200 hover:border-[#1D3A5F] hover:bg-[#1D3A5F]/[0.05] active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D3A5F]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F2EDE5] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    {isPosterLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                    ) : (
                        <ImageDown className="w-4 h-4" strokeWidth={1.75} />
                    )}
                    {isPosterLoading ? "生成中..." : "保存测肤证书"}
                </button>
            </m.div>
            </div>

            {/* 重新测试二次确认：移动端「?」入口使用（样式对齐保存海报弹窗）；桌面端证书面不提供重测入口 */}
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

            {/* 派系介绍弹窗：移动端海报「查看派系介绍」入口（懒加载，隐藏测肤 CTA） */}
            {shouldRenderFactionIntro && (
                <SkinTypeModal
                    data={showFactionIntro ? factionContent ?? null : null}
                    onClose={() => setShowFactionIntro(false)}
                    hideTestCTA
                />
            )}
        </div>
    );
}
