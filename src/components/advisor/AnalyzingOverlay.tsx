"use client";

import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { Check, LogOut, ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useFocusTrap } from "@/hooks/use-focus-trap";

// 8 大派系 IP 形象
const PERSONAS = [
    { key: "sensitive", name: "敏敏派" },
    { key: "minimalist", name: "极简派" },
    { key: "luxury", name: "奢华派" },
    { key: "ageless", name: "冻龄派" },
    { key: "desert", name: "沙漠派" },
    { key: "oily", name: "油条派" },
    { key: "combination", name: "混合派" },
    { key: "guardian", name: "守护派" },
];

interface AnalyzingOverlayProps {
    progress: number;
    /** 分析阶段：用于阶段清单与进度文案，避免仅凭模拟进度判断 */
    status?: 'idle' | 'preparing' | 'analyzing_face' | 'analyzing_skin' | 'completed' | 'error';
    onCancel?: () => void;
    queuePosition?: number;
    queueWaitSeconds?: number;
    /** 等待期"了解派系"入口：打开派系介绍弹层（纯静态内容，不打断分析；
     *  弹层 state 由外层持有，overlay 在完成卸载时不会带走它） */
    onShowSkinTypes?: () => void;
}

export function AnalyzingOverlay({ progress, status = 'preparing', onCancel, queuePosition, queueWaitSeconds, onShowSkinTypes }: AnalyzingOverlayProps) {
    const [showCancel, setShowCancel] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [personaPaused, setPersonaPaused] = useState(false);
    // 分析遮罩是模态层：锁定键盘焦点并让背景 inert，避免 Tab 进入下层页面
    const overlayRef = useFocusTrap<HTMLDivElement>(true);
    const prefersReducedMotion = useReducedMotion();
    // 避免 SSR 与服务端渲染状态不一致，同时避免 effect 中同步 setState
    const isMounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // IP 形象轮播
    const [personaIdx, setPersonaIdx] = useState(0);
    const [gender, setGender] = useState("female");
    useEffect(() => {
        try {
            const g = localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER);
            if (g === "male" || g === "female") setGender(g);
        } catch { /* ignore */ }
    }, []);
    useEffect(() => {
        // 减弱动效偏好或用户悬停/聚焦时暂停轮播
        if (prefersReducedMotion || personaPaused) return;
        const interval = setInterval(() => {
            setPersonaIdx((prev) => (prev + 1) % PERSONAS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [prefersReducedMotion, personaPaused]);

    // 只预取下一张，避免一次性下载 8 张形象
    useEffect(() => {
        const next = PERSONAS[(personaIdx + 1) % PERSONAS.length];
        const img = new globalThis.Image();
        img.src = `/images/character/${next.key}/${next.key}_${gender}.webp`;
    }, [personaIdx, gender]);

    const [stuckTime, setStuckTime] = useState(0);
    const stuckStartRef = useRef<number | null>(null);
    const inLlmWaitPhase = progress >= 75 && progress < 90;

    // Track how long we've been stuck at the LLM waiting phase (75%-90%).
    // 依赖布尔区间而非 progress，避免进度每 400ms 更新时反复重建 interval。
    useEffect(() => {
        if (!inLlmWaitPhase) {
            stuckStartRef.current = null;
            setStuckTime(0);
            return;
        }
        stuckStartRef.current = Date.now();
        const interval = setInterval(() => {
            setStuckTime(Math.floor((Date.now() - (stuckStartRef.current ?? Date.now())) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [inLlmWaitPhase]);

    // 导航失败时不要永久停留在“正在离开...”
    useEffect(() => {
        if (!isExiting) return;
        const timeout = setTimeout(() => setIsExiting(false), 8000);
        return () => clearTimeout(timeout);
    }, [isExiting]);

    // Show cancel button after 2 seconds
    useEffect(() => {
        const timeoutId = setTimeout(() => setShowCancel(true), 2000);
        return () => clearTimeout(timeoutId);
    }, []);

    // Status messages: user-value language, not system language
    const getStatusText = useCallback((p: number, stuckSeconds: number, qPos?: number) => {
        if (p < 20) return "正在为您准备专属分析空间...";
        if (p < 45) return "正在阅读您的肌肤故事...";
        if (p < 60) return "正在为您匹配最合适的护理方案...";
        if (p < 75) return "正在梳理专属于您的护肤建议...";
        if (p < 90) {
            if (qPos && qPos > 0) {
                if (stuckSeconds < 3) return "正在为您接通 AI 护肤顾问...";
                if (stuckSeconds < 10) return "当前咨询人数较多，正在为您加速处理...";
                return "请再稍候片刻，精准分析值得等待...";
            }
            if (stuckSeconds < 3) return "AI 顾问正在深入分析您的肌肤数据...";
            if (stuckSeconds < 10) return "AI 顾问正在为您斟酌最佳方案...";
            return "即将完成，好的分析值得多等几秒...";
        }
        if (p < 100) return "正在生成您的专属护肤报告...";
        return "报告已就绪，即将呈现...";
    }, []);

    const statusText = getStatusText(progress, stuckTime, queuePosition);
    const stageIndex =
        status === 'preparing' || status === 'idle'
            ? 0
            : status === 'analyzing_face'
                ? 1
                : status === 'analyzing_skin'
                    ? 2
                    : status === 'completed'
                        ? 3
                        : 2;
    const stages = ["准备", "视觉分析", "报告生成", "保存"];
    const isWaitingLLM = progress >= 75 && progress < 90;
    const hasQueued = (queuePosition !== undefined && queuePosition > 0);

    return (
        <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label="正在生成专属护肤报告"
            tabIndex={-1}
            onMouseEnter={() => setPersonaPaused(true)}
            onMouseLeave={() => setPersonaPaused(false)}
            onFocus={() => setPersonaPaused(true)}
            onBlur={() => setPersonaPaused(false)}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#FAF8F5] overflow-hidden outline-none"
        >
            {/* Brand anchor — 立即出现，不参与淡入 */}
            <div className="absolute top-0 left-0 right-0 flex justify-center pt-8 px-4 md:px-12 lg:px-20">
                <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={120}
                    height={36}
                    className="h-7 md:h-9 w-auto object-contain"
                />
            </div>

            <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.8 } }}
                className="absolute inset-0 flex flex-col items-center justify-center"
            >
            {/* Exit */}
            <AnimatePresence>
                {showCancel && onCancel && (
                    <m.button
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1, ease: "easeInOut" }}
                        onClick={() => {
                            if (isExiting) return;
                            setShowLeaveConfirm(true);
                        }}
                        disabled={isExiting}
                        className="absolute top-8 right-4 md:right-12 lg:right-20 z-50 flex min-h-[44px] items-center gap-1.5 px-3 rounded-full border border-brand-charcoal/[0.12] text-brand-charcoal/50 transition-colors duration-300 hover:text-brand-charcoal hover:border-brand-charcoal/30 hover:bg-brand-charcoal/[0.03] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        aria-label="离开此页（停止等待本次分析）"
                    >
                        <span className="text-[12px] font-light tracking-[0.08em]">
                            {isExiting ? "正在离开..." : "离开此页"}
                        </span>
                        <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </m.button>
                )}
            </AnimatePresence>

            {/* Ambient: single soft radial glow, cold blue */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[50vw] h-[50vw] max-w-[560px] max-h-[560px] bg-brand-charcoal/[0.03] rounded-full blur-[100px]" />
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">

                {/* IP 形象轮播 — 无框裸排 + 极慢浮动（reduced-motion 时静止） */}
                <m.div
                    animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative w-40 h-48 md:w-52 md:h-60 mb-4 flex items-center justify-center"
                >
                    <AnimatePresence mode="wait">
                        <m.div
                            key={personaIdx}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }}
                            exit={{ opacity: 0, y: -8, transition: { duration: 0.4, ease: "easeIn" } }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <Image
                                src={`/images/character/${PERSONAS[personaIdx].key}/${PERSONAS[personaIdx].key}_${gender}.webp`}
                                alt={PERSONAS[personaIdx].name}
                                width={208}
                                height={240}
                                className="w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,38,62,0.08)]"
                            />
                        </m.div>
                    </AnimatePresence>
                </m.div>

                {/* 当前派系名 — 暗示"其中一个就是你" */}
                <AnimatePresence mode="wait">
                    <m.span
                        key={personaIdx}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.5 }}
                        className="text-[12px] text-brand-charcoal/40 font-light tracking-[0.15em] mb-12"
                    >
                        {PERSONAS[personaIdx].name}
                    </m.span>
                </AnimatePresence>

                {/* Status text */}
                <div className="h-7 flex items-center justify-center mb-8" aria-live="polite">
                    <AnimatePresence mode="wait">
                        <m.span
                            key={statusText}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.5 }}
                            className="text-[14px] text-brand-charcoal/70 font-light tracking-[0.08em] text-center"
                        >
                            {statusText}
                        </m.span>
                    </AnimatePresence>
                </div>

                {/* Progress — hairline, no percentage */}
                <div
                    className="w-full max-w-[240px] relative h-px bg-brand-charcoal/10 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="分析进度"
                >
                    <m.div
                        className="absolute top-0 bottom-0 left-0 bg-brand-charcoal/50"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%`, transition: { duration: 0.4, ease: "easeInOut" } }}
                    />
                    {isWaitingLLM && !prefersReducedMotion && (
                        <m.div
                            className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-brand-charcoal/30 to-transparent"
                            style={{ width: '30%' }}
                            initial={{ left: '-30%' }}
                            animate={{ left: '100%' }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                        />
                    )}
                </div>

                {/* Stage checklist + elapsed：让用户知道“到哪一步了” */}
                <div className="mt-6 flex items-center gap-3 text-[11px] font-light text-brand-charcoal/45">
                    {stages.map((label, index) => {
                        const done = index < stageIndex || (index === 3 && status === 'completed');
                        const active = index === stageIndex && status !== 'completed';
                        return (
                            <span key={label} className="inline-flex items-center gap-1.5">
                                {done ? (
                                    <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
                                ) : active ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-brand-charcoal/55" />
                                ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-brand-charcoal/20" />
                                )}
                                {label}
                            </span>
                        );
                    })}
                </div>
                <p className="mt-2 text-[11px] font-light tabular-nums text-brand-charcoal/35">
                    已等待 {elapsedSeconds} 秒
                </p>

                {/* Queue / wait hints */}
                {isMounted && (hasQueued || (isWaitingLLM && stuckTime >= 5)) && (
                    <m.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-6 text-[11px] text-brand-charcoal/40 font-light tracking-[0.06em] text-center"
                    >
                        {hasQueued
                            ? `当前使用人数较多${queueWaitSeconds ? `，预计还需约 ${queueWaitSeconds} 秒` : ""}`
                            : "AI 顾问正在全力为您分析，请再稍候片刻"}
                    </m.p>
                )}

                {/* 等待期入口：派系介绍（延迟淡入，不抢进度文案的首屏注意力） */}
                {onShowSkinTypes && (
                    <m.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: prefersReducedMotion ? 0 : 1.2, duration: prefersReducedMotion ? 0 : 0.8 }}
                        onClick={onShowSkinTypes}
                        className="mt-8 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-brand-charcoal/[0.15] text-brand-charcoal/55 text-[12px] font-light tracking-[0.08em] transition-colors duration-300 hover:text-brand-charcoal hover:border-brand-charcoal/35 hover:bg-brand-charcoal/[0.03] cursor-pointer"
                    >
                        <span>等待时，了解 8 大肌肤派系</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </m.button>
                )}
            </div>

            {/* Footer: privacy reassurance */}
            <div className="absolute bottom-10 text-center px-6">
                <p className="text-[11px] text-brand-charcoal/35 font-light tracking-[0.06em] leading-relaxed">
                    您的面部图像仅用于本次分析，会加密传输给 AI 服务处理；成功后立即删除，异常最长保留 6 小时。
                </p>
            </div>

            <ConfirmModal
                isOpen={showLeaveConfirm}
                onClose={() => setShowLeaveConfirm(false)}
                onConfirm={() => {
                    if (isExiting) return;
                    setShowLeaveConfirm(false);
                    setIsExiting(true);
                    onCancel?.();
                }}
                title="离开分析页面？"
                message="离开后本页将停止等待；分析可能仍在后台完成，可在历史报告中查看。"
                confirmText="离开并停止等待"
                cancelText="继续等待"
                variant="warning"
            />

            </m.div>
        </div>
    );
}
