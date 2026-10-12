"use client";

import { AnimatePresence, m } from "framer-motion";
import Image from "next/image";
import { Check } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { certImageUrl, type CertVariant } from "@/lib/cert-image";

interface CertVariantPickerProps {
    isOpen: boolean;
    /** 当前派系/性别：缩略图直接展示用户自己的证书成品，所见即所得 */
    persona: string;
    gender: string;
    selectedId: CertVariant;
    onSelect: (variant: CertVariant) => void;
    onClose: () => void;
}

const VARIANTS: { id: CertVariant; label: string; desc: string }[] = [
    { id: "qr", label: "标准版", desc: "含综合评分与二维码" },
    { id: "noqr", label: "分享版", desc: "无二维码，适合小红书等平台分享" },
];

/** 「保存测肤证书」的版本选择弹层：标准版（含二维码）/ 分享版（无二维码） */
export function CertVariantPicker({ isOpen, persona, gender, selectedId, onSelect, onClose }: CertVariantPickerProps) {
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen);

    return (
        <AnimatePresence>
            {isOpen && (
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
                        className="relative z-10 w-full max-w-[440px] rounded-2xl bg-white p-5 text-center shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="选择证书版式"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                e.stopPropagation();
                                onClose();
                            }
                        }}
                    >
                        <p className="text-[15px] font-medium text-[var(--color-brand-espresso)] mb-4">选择证书版式</p>
                        <div className="grid grid-cols-2 gap-3">
                            {VARIANTS.map((v) => {
                                const active = v.id === selectedId;
                                return (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => onSelect(v.id)}
                                        aria-pressed={active}
                                        className={`group flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors cursor-pointer ${
                                            active
                                                ? "border-[var(--color-brand-cocoa)]/60 bg-[var(--color-brand-cocoa)]/[0.06]"
                                                : "border-black/8 hover:border-[var(--color-brand-cocoa)]/30"
                                        }`}
                                    >
                                        <span className="relative block w-full overflow-hidden rounded-lg border border-black/5 bg-[var(--color-brand-cream)]">
                                            <Image
                                                src={certImageUrl(persona, gender, v.id)}
                                                alt={v.label}
                                                width={360}
                                                height={480}
                                                className="w-full h-auto"
                                            />
                                            {active && (
                                                <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-brand-cocoa)] text-white">
                                                    <Check className="h-3 w-3" strokeWidth={2.5} />
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-[13px] font-medium text-[var(--color-brand-espresso)]">{v.label}</span>
                                        <span className="text-[11px] leading-snug text-[var(--color-brand-taupe)]">{v.desc}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-4 text-[11px] text-[var(--color-brand-taupe)]">点击任一版式即可生成并保存</p>
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
