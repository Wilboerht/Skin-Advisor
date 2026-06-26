"use client";

import { motion as m, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Sparkles, LogOut } from "lucide-react";
import Image from "next/image";

const PRODUCT_IMAGES = [
    "/images/products/Body Lotion.svg",
    "/images/products/Face Cream.svg",
    "/images/products/Face Mask.svg",
    "/images/products/Face Scrub.svg",
    "/images/products/Foam Cleanser.svg",
    "/images/products/Hand Cream.svg",
    "/images/products/Serum.svg",
    "/images/products/Sunscreen.svg",
    "/images/products/Treatment Oil.svg",
];

interface AnalyzingOverlayProps {
    progress: number;
    onCancel?: () => void;
    queuePosition?: number;
    queueWaitSeconds?: number;
}

export function AnalyzingOverlay({ progress, onCancel, queuePosition, queueWaitSeconds }: AnalyzingOverlayProps) {
    const [activeIconIndex, setActiveIconIndex] = useState(0);
    const [showCancel, setShowCancel] = useState(false);
    // "use client" 组件在客户端运行时始终已挂载
    const isMounted = typeof window !== 'undefined';
    const [isExiting, setIsExiting] = useState(false);
    const [stuckTime, setStuckTime] = useState(0);
    const stuckStartRef = useRef<number | null>(null);

    // Memoize particles to prevent jumping on re-renders (triggered by progress updates)
    const particles = useMemo(() => {
        return [...Array(6)].map((_, i) => ({
            id: i,
            duration: 2 + (((i * 37) % 100) / 100),
            delay: (((i * 53) % 100) / 50),
            left: 50 + (((i * 71) % 100) - 50),
            top: 50 + (((i * 89) % 100) - 50),
        }));
    }, []);

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
            // 不在这里同步 setState；isWaitingLLM 条件已控制显示，progress 离开范围后自然隐藏
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

    // Cycle through icons for "loading" animation
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIconIndex((prev) => (prev + 1) % 9);
        }, 800);

        const timeoutId = setTimeout(() => {
            setShowCancel(true);
        }, 2000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeoutId);
        };
    }, []);

    // Dynamic status messages based on progress, wait time, and queue info
    const getStatusText = useCallback((p: number, stuckSeconds: number, qPos?: number) => {
        if (p < 20) return "正在准备您的面部数据...";
        if (p < 45) return "正在识别面部轮廓与特征...";
        if (p < 60) return "正在进行皮肤纹理分析...";
        if (p < 75) return "正在构建个性化 AI 分析模型并安全删除您的面部照片...";
        if (p < 90) return "AI 专家正在深度分析您的肌肤数据...";
        if (p < 90) {
            if (qPos && qPos > 0) {
                if (stuckSeconds < 3) return "系统繁忙，AI 专家正在接入...";
                if (stuckSeconds < 10) return "当前使用人数较多，AI 正在全力处理中...";
                return "系统负载较高，正在加速处理您的分析...";
            }
            if (stuckSeconds < 3) return "正在连接 AI 护肤专家...";
            if (stuckSeconds < 10) return "AI 正在深度思考中，请稍候...";
            return "正在处理复杂的肌肤数据，即将完成...";
        }
        if (p < 100) return "正在生成您的专属肌肤报告...";
        return "即将为您呈现专属肌肤报告...";
    }, []);

    const statusText = getStatusText(progress, stuckTime, queuePosition);
    const isWaitingLLM = progress >= 75 && progress < 90;
    const hasQueued = (queuePosition !== undefined && queuePosition > 0);

    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8 } }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#FDFBF7] overflow-hidden"
        >
            {/* Elegant Cancel Button (appears after 5 seconds) */}
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
                        className="absolute top-8 right-8 z-50 flex items-center gap-2 transition-all group text-[#5A5A5A]/60 hover:text-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Exit analysis"
                    >
                        <span className="text-[12px] font-medium tracking-[0.2em] transition-colors">
                            {isExiting ? "退出中..." : "退出测试"}
                        </span>
                        <LogOut className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                    </m.button>
                )}
            </AnimatePresence>
            {/* 1. Background Ambience - Soft, Organic, High-end Spa feel */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Warm light leak from top-left */}
                <m.div
                    animate={{ opacity: [0.4, 0.6, 0.4], scale: [1, 1.1, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-[#E8DCC6] rounded-full blur-[120px] opacity-40"
                />
                {/* Secondary warmer light from bottom-right */}
                <m.div
                    animate={{ opacity: [0.3, 0.5, 0.3], scale: [1.1, 1, 1.1] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-[10%] -right-[10%] w-[60vw] h-[60vw] bg-[#D4B78F] rounded-full blur-[100px] opacity-30"
                />

                {/* Grain Texture for premium paper feel */}
                <div className="absolute inset-0 opacity-[0.4] mix-blend-multiply"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")` }}
                />
            </div>

            {/* 2. Main Visual Content */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">

                {/* Central Visualization */}
                <div className="relative w-48 h-48 mb-12 flex items-center justify-center">
                    {/* Ripple Effects behind */}
                    {[0, 1, 2].map((i) => (
                        <m.div
                            key={i}
                            className="absolute inset-0 border border-[#D4B78F] rounded-full"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{
                                opacity: [0, 0.3, 0],
                                scale: [0.8, 1.4, 1.6],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                delay: i * 1,
                                ease: "easeOut"
                            }}
                        />
                    ))}

                    {/* Abstract Icon Container */}
                    <div className="relative w-28 h-28 rounded-full overflow-hidden shadow-[0_20px_40px_rgba(212,183,143,0.2)] border-[1px] border-white/50 z-20 bg-gradient-to-br from-[#FFFBF5] to-[#F2EFE9] flex items-center justify-center">
                        <m.div
                            animate={{
                                scale: [1, 1.1, 1],
                                opacity: [0.8, 1, 0.8],
                                rotate: [0, 5, -5, 0]
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Sparkles className="w-8 h-8 text-[#D4B78F]" strokeWidth={1} />
                        </m.div>

                        {/* Inner Glow */}
                        <m.div
                            className="absolute inset-0 bg-radial-gradient from-[#D4B78F]/10 to-transparent"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        />

                        {/* Scanning Light Sweep - Very subtle & elegant */}
                        <m.div
                            className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent"
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            style={{ opacity: 0.3 }}
                        />
                    </div>

                    {/* Floating particles */}
                    {isMounted && particles.map((p) => (
                        <m.div
                            key={`p-${p.id}`}
                            className="absolute w-1.5 h-1.5 bg-[#D4B78F] rounded-full"
                            animate={{
                                y: [0, -40],
                                opacity: [0, 1, 0],
                                scale: [0, 1, 0]
                            }}
                            transition={{
                                duration: p.duration,
                                repeat: Infinity,
                                delay: p.delay,
                                ease: "easeOut"
                            }}
                            style={{
                                left: `${p.left}%`,
                                top: `${p.top}%`,
                            }}
                        />
                    ))}
                </div>

                {/* Text Information */}
                <div className="flex flex-col items-center gap-6 w-full">
                    {/* Status with smooth transition */}
                    <div className="h-8 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                            <m.span
                                key={statusText}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-[15px] text-[#5A5A5A] font-medium tracking-wider text-center"
                            >
                                {statusText}
                            </m.span>
                        </AnimatePresence>
                    </div>

                    {/* Progress Bar — pulses when waiting for AI response */}
                    <div className="w-full max-w-[280px] relative h-[4px] bg-[#E9E9E7] rounded-full overflow-hidden">
                        <m.div
                            className="absolute top-0 bottom-0 left-0 bg-[#D4B78F]"
                            initial={{ width: 0 }}
                            animate={isWaitingLLM 
                                ? { width: ["88%", "92%", "88%"], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } }
                                : { width: `${progress}%`, transition: { type: "spring", stiffness: 50, damping: 20 } }
                            }
                        />
                        {/* Streamer effect: active waiting indicator when LLM is thinking */}
                        {isWaitingLLM && (
                            <m.div
                                className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                                style={{ width: '30%' }}
                                initial={{ left: '-30%' }}
                                animate={{ left: '100%' }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                            />
                        )}
                    </div>

                    {/* Percentage + Wait hint */}
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-xs text-[#9A9A9A] font-mono tracking-widest">
                            {Math.round(progress)}%
                        </span>
                        {hasQueued && (
                            <m.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] text-[#D4B78F] tracking-wider font-medium"
                            >
                                当前使用人数较多{queueWaitSeconds ? `，预计等待约 ${queueWaitSeconds} 秒` : ""}
                            </m.span>
                        )}
                        {isWaitingLLM && stuckTime >= 3 && !hasQueued && (
                            <m.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] text-[#9A9A9A]/60 tracking-wider"
                            >
                                已等待 {stuckTime} 秒，AI 专家正在工作中
                            </m.span>
                        )}
                    </div>
                </div>

            </div>

            {/* 3. Analysis Icons Row (9 Metrics) */}
            <div className="absolute bottom-24 w-full px-4 z-50">
                <m.div
                    className="flex flex-nowrap items-center justify-center gap-2 sm:gap-4 md:gap-6 max-w-[95vw] sm:max-w-2xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    {PRODUCT_IMAGES.map((src, i) => {
                        const isCurrent = i === activeIconIndex;

                        return (
                            <m.div
                                key={i}
                                className="relative flex items-center justify-center"
                                animate={isCurrent ? {
                                    scale: [1, 1.2, 1],
                                    y: [0, -8, 0],
                                    filter: "brightness(1.1)",
                                    opacity: 1
                                } : {
                                    scale: 0.9,
                                    y: 0,
                                    filter: "brightness(0.85)",
                                    opacity: 0.4
                                }}
                                transition={{
                                    duration: 0.8,
                                    ease: "easeInOut"
                                }}
                            >
                                <Image
                                    src={src}
                                    alt=""
                                    width={48}
                                    height={48}
                                    className="w-6 h-6 sm:w-11 sm:h-11 md:w-12 md:h-12 drop-shadow-sm transition-all duration-300 object-contain"
                                />
                            </m.div>
                        );
                    })}
                </m.div>
            </div>

            {/* Footer Branding */}
            <div className="absolute bottom-8 text-center opacity-40">
                <p className="text-[9px] text-[#8A8A8A] tracking-[0.2em] font-light">
                    MySkinToday™ Technology Support
                </p>
            </div>
        </m.div>
    );
}
