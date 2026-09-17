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

export function ScanGuideModal({ isOpen, onConfirm, onExit }: ScanGuideModalProps) {

    const [skinState, setSkinState] = useState<SkinStateValue>(DEFAULT_SKIN_STATE);
    const isMakeup = isMakeupState(skinState);

    // 拍摄准备：带妆时"保持素颜"的提示与实际状态矛盾，改为"如实记录状态"，并各补一句可执行说明
    const guideItems = [
        {
            icon: Sparkles,
            title: isMakeup ? "记录状态" : "保持素颜",
            desc: isMakeup
                ? "带妆会影响纹理与泛红判断，分析会按实际情况校准"
                : "不化妆、不涂护肤品；已涂防晒或带妆请如实选择下方状态",
        },
        { icon: Sun, title: "光线充足", desc: "面向窗边自然光，避免背光与顶光" },
        { icon: ScanEye, title: "对准镜头", desc: "面部完整落在取景框内，不要出框" },
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
                    {/* ---- App Bar / Header（原右侧"退出"与左侧"返回"行为相同，已移除避免语义重复） ---- */}
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

                    {/* Content: my-auto 保证内容少时垂直居中、内容多时从顶部自然滚动（避免 justify-center 裁切顶部） */}
                    <div className="flex-1 flex flex-col items-center w-full px-4 md:px-8 pt-24 md:pt-28 pb-6">
                        <div className="w-full max-w-2xl flex flex-col items-center my-auto">
                            {/* Header */}
                            <m.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                                className="flex flex-col items-center text-center"
                            >
                                <h1 id="scan-guide-title" className="text-2xl md:text-3xl font-serif font-light text-brand-charcoal tracking-[0.02em]">
                                    开始面部扫描
                                </h1>
                                {/* 取景框示意：四角 + 人脸轮廓，替代原先无含义的大图标 */}
                                <div className="relative mx-auto mt-6 mb-8 md:mt-8 md:mb-10 h-24 w-24 md:h-28 md:w-28" aria-hidden="true">
                                    <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-md border-l border-t border-brand-charcoal/25" />
                                    <span className="absolute right-0 top-0 h-5 w-5 rounded-tr-md border-r border-t border-brand-charcoal/25" />
                                    <span className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-md border-b border-l border-brand-charcoal/25" />
                                    <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-md border-b border-r border-brand-charcoal/25" />
                                    <ScanFace className="absolute inset-0 m-auto h-14 w-14 md:h-16 md:w-16 text-brand-charcoal/45" strokeWidth={1} />
                                </div>
                            </m.div>

                            {/* 拍摄准备（窄屏纵向行、桌面横排；每条补一行说明） */}
                            <m.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="w-full"
                            >
                                <p className="mb-4 text-center text-[12px] font-light tracking-[0.12em] text-brand-charcoal/55">
                                    拍摄准备
                                </p>
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-center md:gap-12">
                                    {guideItems.map((item, index) => {
                                        const Icon = item.icon;
                                        return (
                                            <div key={index} className="flex items-start gap-3 md:w-[210px] md:flex-col md:items-center md:gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-charcoal/[0.05] md:h-12 md:w-12">
                                                    <Icon className="w-5 h-5 text-brand-charcoal/60" strokeWidth={1.25} />
                                                </div>
                                                <div className="min-w-0 text-left md:text-center">
                                                    <p className="text-sm font-normal text-brand-charcoal/85 tracking-[0.06em]">
                                                        {item.title}
                                                    </p>
                                                    <p className="mt-0.5 text-[12px] font-light leading-relaxed text-brand-charcoal/55">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </m.div>

                            {/* 分组分隔 */}
                            <div className="my-7 w-full border-t border-brand-charcoal/[0.08] md:my-9" />

                            {/* 拍摄时肌肤状态（胶囊分段单选，默认纯素颜；影响分析准确度与报告提示） */}
                            <m.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25, duration: 0.5 }}
                                className="w-full flex flex-col items-center"
                            >
                                <p className="mb-3 text-center text-[13px] font-light tracking-[0.06em] text-brand-charcoal/70">
                                    此刻镜头前的肌肤状态是？
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
                                        // "刚洗完脸（未护肤）"：主词 + 括号说明分层排版，避免按钮过长
                                        const [mainText, subRaw] = option.label.split("（");
                                        const subText = subRaw ? `（${subRaw}` : null;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                onClick={() => setSkinState(option.value)}
                                                className={`inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full px-4 py-2 text-[12px] tracking-[0.04em] transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/25 ${
                                                    selected
                                                        ? "bg-brand-charcoal/[0.08] font-medium text-brand-charcoal"
                                                        : "text-brand-charcoal/60 hover:text-brand-charcoal/85"
                                                }`}
                                            >
                                                <span>{mainText}</span>
                                                {subText && (
                                                    <span className={`text-[10px] font-light ${selected ? "text-brand-charcoal/60" : "text-brand-charcoal/45"}`}>
                                                        {subText}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-3 text-center text-[11px] font-light tracking-[0.04em] text-brand-charcoal/50">
                                    照片仅用于本次分析，不会被保存
                                </p>
                            </m.div>

                            {/* Actions */}
                            <m.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
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
                                    className="group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[var(--color-brand-cocoa)] px-10 sm:px-12 text-[14px] font-normal tracking-[0.08em] text-white cursor-pointer transition-colors duration-300 hover:bg-[#4a3a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-cocoa)]/40 focus-visible:ring-offset-2"
                                >
                                    <span>开始面部扫描 · 约 1 分钟</span>
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
