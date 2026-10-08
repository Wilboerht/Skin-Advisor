"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ArrowRight, Sun, ScanEye, Glasses, Info, ChevronLeft, Smile, Droplets, Brush, Palette } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useLegalDocModal } from "@/components/website/LegalDocModalContext";
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

/** 拍摄小贴士：压缩为一行图标 + 标题（对齐预览页 F） */
const TIPS = [
    { icon: Sun, title: "光线充足" },
    { icon: Glasses, title: "露出额头" },
    { icon: ScanEye, title: "对准镜头" },
];

/** 状态选择图标：与预览页 F 的图标卡片方案一致 */
const STATE_ICONS: Record<SkinStateValue, LucideIcon> = {
    bare: Smile,
    sunscreen: Sun,
    washed: Droplets,
    light_makeup: Brush,
    heavy_makeup: Palette,
};

export function ScanGuideModal({ isOpen, onConfirm, onExit }: ScanGuideModalProps) {
    const [skinState, setSkinState] = useState<SkinStateValue>(DEFAULT_SKIN_STATE);
    const { openLegalDoc } = useLegalDocModal();
    // 带妆时在状态选择下方就地提示影响范围（与结果页 banner、AI 条件化提示同口径）
    const isMakeup = isMakeupState(skinState);

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
                    className="fixed inset-0 z-[320] bg-[#FAF8F5] flex flex-col overscroll-contain"
                >
                    {/* ---- Header（随流布局，内容区独立滚动，矮屏/横屏不再靠固定 padding 避让） ---- */}
                    <header className="relative w-full shrink-0 flex items-center justify-center px-6 md:px-12 lg:px-20 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-5 md:pt-[calc(1.75rem+env(safe-area-inset-top,0px))] md:pb-6 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-brand-charcoal/5 z-10">
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

                    {/* ---- 内容区：不足一屏垂直居中，超出独立滚动 ---- */}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <div className="min-h-full w-full max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-10 flex flex-col justify-center items-center">
                            {/* 1. 预期管理：标题 + 时长 + 一行拍摄贴士 */}
                            <m.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.08, duration: 0.45 }}
                                className="flex w-full flex-col items-center text-center"
                            >
                                <h1 id="scan-guide-title" className="text-2xl md:text-3xl font-light text-brand-charcoal tracking-[0.02em]">
                                    面部扫描
                                </h1>
                                <p className="mt-3 text-[13px] md:text-sm font-light text-brand-charcoal/60 tracking-[0.02em] leading-relaxed">
                                    AI 将引导你完成 4 个角度，约 30 秒
                                </p>

                                <div className="mt-6 md:mt-7 grid w-full max-w-[330px] grid-cols-3 gap-2">
                                    {TIPS.map(({ icon: Icon, title }) => (
                                        <div key={title} className="flex flex-col items-center gap-1.5">
                                            <Icon className="h-5 w-5 text-brand-charcoal/45" strokeWidth={1.8} aria-hidden="true" />
                                            <span className="text-[12px] font-normal text-brand-charcoal/70 tracking-[0.03em]">{title}</span>
                                        </div>
                                    ))}
                                </div>
                            </m.div>

                            {/* 2. 拍摄状态（关键输入）：图标卡片（对齐预览页 F），选中带妆就地提示影响范围 */}
                            <m.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.16, duration: 0.45 }}
                                className="mt-8 md:mt-9 w-full flex flex-col items-center"
                            >
                                <p className="mb-3 text-center text-[12px] font-light tracking-[0.06em] text-brand-charcoal/60">
                                    拍摄状态<span className="text-brand-charcoal/45">（影响分析准确度）</span>
                                </p>
                                <div
                                    role="radiogroup"
                                    aria-label="拍摄时肌肤状态"
                                    onKeyDown={(e) => {
                                        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); }
                                        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }
                                    }}
                                    className="grid w-full max-w-[330px] grid-cols-5 gap-1.5"
                                >
                                    {SKIN_STATE_OPTIONS.map((option) => {
                                        const selected = skinState === option.value;
                                        const Icon = STATE_ICONS[option.value];
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                aria-label={option.label}
                                                onClick={() => setSkinState(option.value)}
                                                className={cn(
                                                    "flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[14px] border bg-white px-1 py-2 transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/25",
                                                    selected
                                                        ? "border-[var(--color-brand-cocoa)] bg-[var(--color-brand-cocoa)]/[0.05]"
                                                        : "border-brand-charcoal/[0.12] hover:border-brand-charcoal/25"
                                                )}
                                            >
                                                <Icon
                                                    className={cn("h-[22px] w-[22px]", selected ? "text-[var(--color-brand-cocoa)]" : "text-brand-charcoal/45")}
                                                    strokeWidth={1.8}
                                                    aria-hidden="true"
                                                />
                                                <span className={cn(
                                                    "text-[11.5px] tracking-[0.02em]",
                                                    selected ? "font-medium text-brand-charcoal" : "text-brand-charcoal/60"
                                                )}>
                                                    {CHIP_LABELS[option.value]}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <AnimatePresence initial={false}>
                                    {isMakeup && (
                                        <m.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: "easeOut" }}
                                            className="w-full max-w-md overflow-hidden"
                                            aria-live="polite"
                                        >
                                            <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-2 text-left text-[12px] font-light leading-[1.7] text-amber-900">
                                                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                                                <span>带妆会掩盖色斑与泛红，相关结论仅供参考</span>
                                            </p>
                                        </m.div>
                                    )}
                                </AnimatePresence>
                            </m.div>

                            {/* 3. 隐私透明（紧贴行动点） + 主 CTA */}
                            <m.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.26, duration: 0.45 }}
                                className="w-full flex flex-col items-center mt-8 md:mt-9"
                            >
                                <p className="text-center text-[12px] font-light text-brand-charcoal/60 leading-relaxed tracking-[0.02em]">
                                    照片仅用于本次分析，分析完成后即删除
                                    <span className="mx-1 text-brand-charcoal/30">·</span>
                                    <button
                                        type="button"
                                        onClick={() => openLegalDoc("privacy")}
                                        className="underline underline-offset-2 transition-colors hover:text-brand-charcoal/85 cursor-pointer"
                                    >
                                        隐私政策
                                    </button>
                                </p>

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
                                    className="group mt-5 inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[var(--color-brand-cocoa)] px-10 sm:px-12 text-[14px] font-normal tracking-[0.08em] text-white cursor-pointer transition-colors duration-300 hover:bg-brand-cocoa-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-cocoa)]/40 focus-visible:ring-offset-2"
                                >
                                    <span>开始扫描</span>
                                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                                </button>
                            </m.div>
                        </div>
                    </div>

                    {/* ---- Footer：法律链接手机端也展示 ---- */}
                    <div className="shrink-0 w-full border-t border-brand-charcoal/5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] px-4">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[11px] font-light tracking-[0.1em] md:tracking-[0.12em] text-brand-charcoal/55 leading-tight">
                            <p>&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                            <span className="hidden sm:inline text-brand-charcoal/30">·</span>
                            <div className="flex items-center gap-4 tracking-[0.12em]">
                                <button type="button" onClick={() => openLegalDoc("privacy")} className="hover:text-brand-charcoal/80 transition-colors duration-300 cursor-pointer">隐私政策</button>
                                <span className="text-brand-charcoal/30">·</span>
                                <button type="button" onClick={() => openLegalDoc("terms")} className="hover:text-brand-charcoal/80 transition-colors duration-300 cursor-pointer">服务条款</button>
                            </div>
                        </div>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
