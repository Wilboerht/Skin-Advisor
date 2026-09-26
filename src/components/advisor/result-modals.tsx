"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "framer-motion";
import { AlertTriangle, Lightbulb, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

/* ------------------------- 性别不一致提示弹窗 ------------------------- */

interface GenderMismatchModalProps {
    faceAnalysis: FaceAnalysisResult | null;
    socialGender: string;
    hasUsedFreeRetry: boolean;
    onRetry: () => void;
    onContinue: () => void;
}

export function GenderMismatchModal({
    faceAnalysis,
    socialGender,
    hasUsedFreeRetry,
    onRetry,
    onContinue,
}: GenderMismatchModalProps) {
    const retryButtonRef = useRef<HTMLButtonElement>(null);
    const modalRef = useFocusTrap<HTMLDivElement>(true);

    // Auto-focus primary button when modal opens
    useEffect(() => {
        // Small delay to wait for animation
        const timer = setTimeout(() => retryButtonRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-brand-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <m.div
                ref={modalRef}
                initial={{ scale: 0.95, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="bg-[#FDFBF7] rounded-2xl shadow-sm w-full max-w-[420px] overflow-hidden border border-brand-charcoal/10"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gender-mismatch-title"
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.stopPropagation();
                        onContinue();
                    }
                }}
            >
                <div className="p-7 md:p-8">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-brand-charcoal/[0.08] flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-brand-charcoal" strokeWidth={1.5} />
                        </div>
                        <h3
                            id="gender-mismatch-title"
                            className="text-[17px] font-light text-brand-charcoal tracking-[0.02em]"
                        >
                            测前信息准确性提示
                        </h3>
                    </div>

                    <div className="space-y-5">
                        <p className="text-[14px] text-brand-charcoal/60 font-light leading-[1.8] text-left px-1">
                            AI 面部识别结果显示您的面部特征更接近
                            <span className="font-light bg-brand-charcoal/[0.08] px-1.5 py-0.5 rounded text-brand-charcoal mx-1">
                                {faceAnalysis?.gender?.value === 'male' ? '男性' : '女性'}
                            </span>
                            ，但您在问卷中选择的是
                            <span className="font-light bg-brand-charcoal/[0.08] px-1.5 py-0.5 rounded text-brand-charcoal mx-1">
                                {socialGender === 'male' ? '男性' : '女性'}
                            </span>
                            ，二者不一致。
                        </p>

                        {/* Callout Block */}
                        <div className="bg-brand-charcoal/[0.04] p-4 rounded-lg flex items-start gap-3">
                            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-brand-charcoal/70" strokeWidth={1.5} />
                            <div className="space-y-2 text-[13px] text-brand-charcoal/60 font-light leading-[1.8]">
                                <p>这可能会影响为您匹配<span className="font-light text-brand-charcoal">“针对性护肤方案”</span>的精准度，导致分析结论与您的实际肤感产生偏差。</p>
                                {hasUsedFreeRetry ? (
                                    <p>该会话已使用过免费重试，重新填写将正常消耗测试次数。</p>
                                ) : (
                                    <p>建议核实信息以获得更准确的建议。若是填写有误？<span className="font-light text-brand-charcoal">本次重新填写不消耗测试次数</span>。</p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                ref={retryButtonRef}
                                onClick={hasUsedFreeRetry ? onContinue : onRetry}
                                className="w-full h-11 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[14px] font-light hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                            >
                                <RotateCcw size={14} strokeWidth={2} />
                                <span>{hasUsedFreeRetry ? "我已了解" : "重新填写问卷"}</span>
                            </button>

                            <button
                                onClick={onContinue}
                                className="w-full h-11 bg-transparent text-brand-charcoal/60 text-[14px] font-light hover:bg-brand-charcoal/[0.06] hover:text-brand-charcoal transition-all flex items-center justify-center gap-2"
                            >
                                <span>信息无误，继续查看</span>
                            </button>
                        </div>
                    </div>
                </div>
            </m.div>
        </m.div>
    );
}

/* ------------------------- 微信内嵌浏览器海报保存弹窗 ------------------------- */

interface PosterSaveModalProps {
    /** 海报图片 URL（objectURL）；null 时不渲染 */
    imageUrl: string | null;
    /** mobile=微信内长按保存；desktop=微信桌面端右键另存（<a download> 在微信内不可靠） */
    variant?: "mobile" | "desktop";
    onClose: () => void;
    /** 用户点「已保存，关闭」（确认已保存）时回调，用于分享埋点；直接关闭（X/遮罩/Esc）不触发 */
    onSaved?: () => void;
}

export function PosterSaveModal({ imageUrl, variant = "mobile", onClose, onSaved }: PosterSaveModalProps) {
    const modalRef = useFocusTrap<HTMLDivElement>(imageUrl !== null);
    const isDesktop = variant === "desktop";

    return (
        <AnimatePresence>
            {imageUrl && (
                <m.div
                    className="fixed inset-0 z-[99998] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <m.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <m.div
                        ref={modalRef}
                        initial={{ scale: 0.95, opacity: 0, y: 12 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 12 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-5 text-center shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="保存测肤证书"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                e.stopPropagation();
                                onClose();
                            }
                        }}
                    >
                        <p className="text-[15px] font-medium text-[var(--color-brand-espresso)] mb-1">
                            {isDesktop ? "右键保存测肤证书" : "长按图片保存证书"}
                        </p>
                        <p className="text-[12px] text-[var(--color-brand-taupe)] mb-4">
                            {isDesktop
                                ? "微信内右键点击下方图片，选择「图片另存为」即可保存到电脑"
                                : "微信内长按下方图片，选择「保存图片」即可存入相册"}
                        </p>
                        <div className="mx-auto w-full max-w-[300px] rounded-xl overflow-hidden border border-black/5 bg-[var(--color-brand-cream)]">
                            <Image
                                src={imageUrl}
                                alt="肌智派证书海报"
                                width={480}
                                height={640}
                                unoptimized
                                className="w-full h-auto"
                            />
                        </div>
                        <button
                            onClick={() => { onSaved?.(); onClose(); }}
                            className="mt-4 inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full border border-[var(--color-brand-cocoa)]/30 text-[var(--color-brand-cocoa)] text-[13px] tracking-[0.1em] font-medium hover:bg-[var(--color-brand-cocoa)]/5 transition-colors"
                        >
                            已保存，关闭
                        </button>
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
