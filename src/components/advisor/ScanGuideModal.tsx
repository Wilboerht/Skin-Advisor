"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Sun, ScanEye, ScanFace, ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { SKIN_STATE_OPTIONS, DEFAULT_SKIN_STATE, isMakeupState, type SkinStateValue } from "@/lib/skin-state";

interface ScanGuideModalProps {
    isOpen: boolean;
    /** 确认开始扫描时回传拍摄时肌肤状态 */
    onConfirm: (skinState: SkinStateValue) => void;
    onExit?: () => void;
}

/** 状态胶囊的短文案：完整文案（SKIN_STATE_LABELS）仍用于报告与 AI 提示词，这里只做界面简写 */
const CHIP_LABELS: Record<SkinStateValue, string> = {
    bare: "素颜",
    sunscreen: "防晒",
    washed: "刚洗脸",
    light_makeup: "淡妆",
    heavy_makeup: "浓妆",
};

export function ScanGuideModal({ isOpen, onConfirm, onExit }: ScanGuideModalProps) {

    const [skinState, setSkinState] = useState<SkinStateValue>(DEFAULT_SKIN_STATE);
    const isMakeup = isMakeupState(skinState);

    // 拍摄准备：带妆时"保持素颜"的提示与实际状态矛盾，改为"如实记录状态"
    const guideItems = [
        { icon: Sparkles, title: isMakeup ? "记录状态" : "保持素颜" },
        { icon: Sun, title: "光线充足" },
        { icon: ScanEye, title: "对准镜头" },
    ];

    const handleClose = () => {
        onExit?.();
    };

    // 方向键切换状态（radiogroup 键盘语义）
    const moveSelection = (dir: 1 | -1) => {
        const idx = SKIN_STATE_OPTIONS.findIndex((o) => o.value === skinState);
        const next = (idx + dir + SKIN_STATE_OPTIONS.length) % SKIN_STATE_OPTIONS.length;
        setSkinState(SKIN_STATE_OPTIONS[next].value);
    };

    // 对话框焦点圈定 + Escape 关闭
    const containerRef = useFocusTrap<HTMLDivElement>(isOpen, handleClose);

    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    ref={containerRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="scan-guide-title"
                    tabIndex={-1}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="fixed inset-0 z-[320] bg-[#FAF8F5] flex flex-col items-center overflow-y-auto overscroll-contain"
                >
                    {/* ---- App Bar / Header ---- */}
                    <header className="fixed top-0 left-0 right-0 z-[330] flex items-center justify-center px-6 md:px-12 lg:px-20 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-6 md:pt-[calc(1.75rem+env(safe-area-inset-top,0px))] md:pb-7 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-brand-charcoal/5">
                        <button
                            onClick={handleClose}
                            className="absolute left-4 md:left-12 lg:left-20 min-w-[44px] min-h-[44px] px-3 py-2 flex items-center justify-center gap-1.5 text-brand-charcoal/70 hover:text-brand-charcoal transition-colors rounded-md hover:bg-brand-charcoal/5 cursor-pointer bg-transparent border-none touch-manipulation active:scale-95"
                            aria-label="返回"
                        >
                            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline text-[14px] font-light tracking-[0.08em]">返回</span>
                        </button>

                        <Image
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD"
                            width={120}
                            height={36}
                            className="h-7 md:h-9 w-auto object-contain"
                        />
                    </header>

                    {/* Content */}
                    <div className="flex-1 flex flex-col items-center w-full px-4 md:px-8 pt-24 md:pt-28 pb-6">
                        <div className="w-full max-w-2xl flex flex-col items-center my-auto">
                            <m.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.45 }}
                                className="flex flex-col items-center text-center"
                            >
                                <h1 id="scan-guide-title" className="text-2xl md:text-3xl font-serif font-light text-brand-charcoal tracking-[0.02em]">
                                    开始面部扫描
                                </h1>

                                {/* 取景框示意：四角 + 人脸轮廓 */}
                                <div className="relative mx-auto mt-6 mb-7 md:mt-8 md:mb-8 h-24 w-24 md:h-28 md:w-28" aria-hidden="true">
                                    <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-md border-l border-t border-brand-charcoal/25" />
                                    <span className="absolute right-0 top-0 h-5 w-5 rounded-tr-md border-r border-t border-brand-charcoal/25" />
                                    <span className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-md border-b border-l border-brand-charcoal/25" />
                                    <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-md border-b border-r border-brand-charcoal/25" />
                                    <ScanFace className="absolute inset-0 m-auto h-14 w-14 md:h-16 md:w-16 text-brand-charcoal/45" strokeWidth={1} />
                                </div>

                                {/* 三提示：一行三词，无分组标题与说明 */}
                                <div className="flex items-center justify-center gap-6 md:gap-10 text-[13px] text-brand-charcoal/70 font-light tracking-[0.06em]">
                                    {guideItems.map((item, index) => {
                                        const Icon = item.icon;
                                        return (
                                            <span key={index} className="inline-flex items-center gap-1.5">
                                                <Icon className="w-4 h-4 text-brand-charcoal/45" strokeWidth={1.5} />
                                                {item.title}
                                            </span>
                                        );
                                    })}
                                </div>
                            </m.div>

                            {/* 拍摄状态（胶囊分段单选，默认素颜；影响分析准确度与报告提示） */}
                            <m.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.18, duration: 0.45 }}
                                className="mt-9 md:mt-10 w-full flex flex-col items-center"
                            >
                                <p className="mb-3 text-center text-[12px] font-light tracking-[0.06em] text-brand-charcoal/60">
                                    拍摄状态
                                </p>
                                <div
                                    role="radiogroup"
                                    aria-label="拍摄时肌肤状态"
                                    onKeyDown={(e) => {
                                        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); }
                                        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }
                                    }}
                                    className="inline-flex w-full flex-wrap items-center justify-center gap-1 rounded-[22px] border border-brand-charcoal/[0.12] bg-white p-1 md:w-auto md:rounded-full"
                                >
                                    {SKIN_STATE_OPTIONS.map((option) => {
                                        const selected = skinState === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                aria-label={option.label}
                                                onClick={() => setSkinState(option.value)}
                                                className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-3 text-[12px] tracking-[0.04em] transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/25 md:flex-none md:px-4 ${
                                                    selected
                                                        ? "bg-brand-charcoal/[0.08] font-medium text-brand-charcoal"
                                                        : "text-brand-charcoal/60 hover:text-brand-charcoal/85"
                                                }`}
                                            >
                                                {CHIP_LABELS[option.value]}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-3 text-center text-[11px] font-light text-brand-charcoal/50">
                                    照片不会被保存
                                </p>
                            </m.div>

                            {/* Actions */}
                            <m.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.26, duration: 0.45 }}
                                className="w-full flex flex-col items-center mt-8 md:mt-10"
                            >
                                <button
                                    onClick={() => {
                                        // 关键体验修复：利用用户的首次显式点击解锁 iOS Safari 的语音合成引擎
                                        if (typeof window !== 'undefined' && window.speechSynthesis) {
                                            try {
                                                const wakeUpStr = new SpeechSynthesisUtterance('');
                                                wakeUpStr.volume = 0;
                                                window.speechSynthesis.speak(wakeUpStr);
                                            } catch (e) {
                                                console.warn("[ScanGuide] speechSynthesis wake-up failed:", e);
                                            }
                                        }
                                        onConfirm(skinState);
                                    }}
                                    className="group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[var(--color-brand-cocoa)] px-10 sm:px-12 text-[14px] font-normal tracking-[0.08em] text-white cursor-pointer transition-colors duration-300 hover:bg-brand-cocoa-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-cocoa)]/40 focus-visible:ring-offset-2"
                                >
                                    <span>开始扫描</span>
                                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                                </button>
                            </m.div>
                        </div>
                    </div>

                    {/* Footer（去掉整块 opacity-40，文字对比度达到可读水平） */}
                    <div className="py-6 shrink-0 text-center px-4">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[11px] font-light tracking-[0.1em] md:tracking-[0.12em] text-brand-charcoal/55 leading-tight">
                            <p>&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                            <span className="hidden sm:inline text-brand-charcoal/30">·</span>
                            <div className="hidden sm:flex items-center gap-4 tracking-[0.12em]">
                                <Link href="https://nihplod.cn/privacy" className="hover:text-brand-charcoal/80 transition-colors duration-300">隐私政策</Link>
                                <span className="text-brand-charcoal/30">·</span>
                                <Link href="https://nihplod.cn/terms" className="hover:text-brand-charcoal/80 transition-colors duration-300">服务条款</Link>
                            </div>
                        </div>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
