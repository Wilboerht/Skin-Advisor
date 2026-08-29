"use client";

import { motion as m, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { STORAGE_KEYS } from "@/lib/storage-keys";

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
    onCancel?: () => void;
    queuePosition?: number;
    queueWaitSeconds?: number;
}

export function AnalyzingOverlay({ progress, onCancel, queuePosition, queueWaitSeconds }: AnalyzingOverlayProps) {
    const [showCancel, setShowCancel] = useState(false);
    const prefersReducedMotion = useReducedMotion();
    // 避免 SSR 与服务端渲染状态不一致，同时避免 effect 中同步 setState
    const isMounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );
    const [isExiting, setIsExiting] = useState(false);

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
        const interval = setInterval(() => {
            setPersonaIdx((prev) => (prev + 1) % PERSONAS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const [stuckTime, setStuckTime] = useState(0);
    const stuckStartRef = useRef<number | null>(null);

    // Track how long we've been stuck at the LLM waiting phase (75%-90%)
    const stuckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        const inRange = progress >= 75 && progress < 90;
        if (inRange) {
            if (stuckStartRef.current === null) {
                stuckStartRef.current = Date.now();
            }
            if (!stuckIntervalRef.current) {
                stuckIntervalRef.current = setInterval(() => {
                    setStuckTime(Math.floor((Date.now() - stuckStartRef.current!) / 1000));
                }, 1000);
            }
        } else {
            stuckStartRef.current = null;
            if (stuckIntervalRef.current) {
                clearInterval(stuckIntervalRef.current);
                stuckIntervalRef.current = null;
            }
        }
        return () => {
            if (stuckIntervalRef.current) {
                clearInterval(stuckIntervalRef.current);
                stuckIntervalRef.current = null;
            }
        };
    }, [progress]);

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
    const isWaitingLLM = progress >= 75 && progress < 90;
    const hasQueued = (queuePosition !== undefined && queuePosition > 0);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#FAF8F5] overflow-hidden">
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
                            setIsExiting(true);
                            onCancel();
                        }}
                        disabled={isExiting}
                        className="absolute top-8 right-4 md:right-12 lg:right-20 z-50 flex items-center gap-2 min-h-[44px] min-w-[44px] px-3 py-2 transition-all group text-brand-charcoal/60 hover:text-brand-charcoal disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="离开此页（分析将在后台继续）"
                    >
                        <span className="text-[12px] font-light tracking-[0.12em] transition-colors">
                            {isExiting ? "正在离开..." : "离开此页"}
                        </span>
                        <LogOut className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
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
            </div>

            {/* Footer: privacy reassurance */}
            <div className="absolute bottom-10 text-center px-6">
                <p className="text-[11px] text-brand-charcoal/35 font-light tracking-[0.06em] leading-relaxed">
                    您的面部数据仅用于本次分析，不会被存储或分享
                </p>
            </div>

            {/* 预加载全部派系形象：分析阶段（30s+）并行拉取进浏览器缓存，
                轮播切换到对应形象时零等待。priority 关闭懒加载，
                display:none 的 img 浏览器仍会发起请求 */}
            <div className="hidden" aria-hidden="true">
                {PERSONAS.map((p) => (
                    <Image
                        key={p.key}
                        src={`/images/character/${p.key}/${p.key}_${gender}.webp`}
                        alt=""
                        width={208}
                        height={240}
                        priority
                    />
                ))}
            </div>
            </m.div>
        </div>
    );
}
