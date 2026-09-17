"use client";

import { AnimatePresence, m } from "framer-motion";
import { Check } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { PosterTemplate, PosterTemplateId } from "./poster-templates";

interface PosterTemplatePickerProps {
    isOpen: boolean;
    /** 可选模板（已过滤未就绪的） */
    templates: PosterTemplate[];
    /** 当前记忆的选择（用于预标记） */
    selectedId: PosterTemplateId;
    /** 点击某一版式：选择并立即保存 */
    onSelect: (id: PosterTemplateId) => void;
    onClose: () => void;
}

/**
 * PosterTemplatePicker — 「保存测肤证书」的版式选择弹层
 *
 * 仅在存在 2 套及以上已就绪模板时由 ResultClient 打开；
 * 点选某一版式即按该版式生成并保存（不再二次确认）。
 */
export function PosterTemplatePicker({ isOpen, templates, selectedId, onSelect, onClose }: PosterTemplatePickerProps) {
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
                        initial={{ y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 24, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="relative z-10 w-full sm:max-w-[420px] rounded-t-[28px] sm:rounded-[28px] bg-[#FDFBF7] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-label="选择保存样式"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                e.stopPropagation();
                                onClose();
                            }
                        }}
                    >
                        <div className="px-6 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 sm:pt-7">
                            <p className="text-[16px] font-medium text-[var(--color-brand-espresso)] text-center">
                                选择保存样式
                            </p>
                            <p className="mt-1 mb-5 text-[12px] text-[var(--color-brand-taupe)] text-center">
                                两套版式内容一致，仅视觉不同
                            </p>

                            <div className="flex flex-col gap-2.5">
                                {templates.map((tpl) => {
                                    const selected = tpl.id === selectedId;
                                    return (
                                        <button
                                            key={tpl.id}
                                            type="button"
                                            onClick={() => onSelect(tpl.id)}
                                            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors cursor-pointer active:opacity-80 ${
                                                selected
                                                    ? "border-[var(--color-brand-cocoa)]/45 bg-[var(--color-brand-cocoa)]/[0.06]"
                                                    : "border-[var(--color-brand-espresso)]/[0.12] bg-white hover:border-[var(--color-brand-espresso)]/[0.22]"
                                            }`}
                                        >
                                            <span className="min-w-0">
                                                <span className="block text-[14px] font-medium text-[var(--color-brand-espresso)]">
                                                    {tpl.label}
                                                </span>
                                                <span className="mt-0.5 block text-[12px] text-[var(--color-brand-taupe)]">
                                                    {tpl.description}
                                                </span>
                                            </span>
                                            {selected && (
                                                <Check className="w-4 h-4 shrink-0 text-[var(--color-brand-cocoa)]" strokeWidth={2.5} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-4 w-full py-2 text-center text-[13px] text-[var(--color-brand-taupe)] hover:text-[var(--color-brand-espresso)] transition-colors cursor-pointer"
                            >
                                取消
                            </button>
                        </div>
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
