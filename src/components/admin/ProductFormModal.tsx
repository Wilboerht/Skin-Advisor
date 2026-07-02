"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package } from "lucide-react";
import ProductForm, { ProductFormData } from "./ProductForm";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: ProductFormData | null;
    onSuccess?: () => void;
}

export function ProductFormModal({ isOpen, onClose, product, onSuccess }: ProductFormModalProps) {
    const mounted = typeof window !== 'undefined';
    const [submitting, setSubmitting] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const titleId = "product-form-modal-title";
    const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

    const handleClose = useCallback(() => {
        if (submitting) return;
        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    }, [submitting, isDirty, onClose]);

    // 打开时重置滚动位置，并绑定 Escape 键关闭
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                } else {
                    handleClose();
                }
            }
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, product, showDiscardConfirm, handleClose]);

    const handleSuccess = () => {
        onSuccess?.();
        onClose();
    };

    const handleConfirmDiscard = () => {
        setShowDiscardConfirm(false);
        onClose();
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    ref={containerRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    className="fixed inset-0 z-[99999] flex items-center justify-center"
                    tabIndex={-1}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !submitting && handleClose()}
                        className="absolute inset-0 bg-[#2C2C2C]/25 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-4xl mx-4 bg-white/70 backdrop-blur-3xl rounded-[28px] border-[1.5px] border-white/80 shadow-[0_40px_100px_rgba(0,0,0,0.08),inset_0_2px_10px_rgba(255,255,255,0.5)] overflow-hidden max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#C9A86C]/15 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-[#8B6914]" />
                                </div>
                                <div>
                                    <h3
                                        id={titleId}
                                        className="text-lg font-bold text-[#2C2C2C] tracking-tight"
                                    >
                                        {product ? "编辑产品" : "新建产品"}
                                    </h3>
                                    <p className="text-xs text-[#8B7355]">
                                        {product ? "修改产品信息" : "填写产品信息并发布到前端展示"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={submitting}
                                className="p-2 rounded-full text-[#B0A89A] hover:text-[#C9A86C] hover:bg-white/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <div ref={scrollRef} className="px-8 pb-8 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            <ProductForm
                                key={product?.id || "new"}
                                initialData={product}
                                onSuccess={handleSuccess}
                                onCancel={handleClose}
                                onSubmittingChange={setSubmitting}
                                onDirtyChange={setIsDirty}
                            />
                        </div>
                    </motion.div>

                    {/* Discard Changes Confirm */}
                    <ConfirmModal
                        isOpen={showDiscardConfirm}
                        onClose={() => setShowDiscardConfirm(false)}
                        onConfirm={handleConfirmDiscard}
                        title="放弃更改？"
                        message="您有未保存的更改，确定要关闭吗？"
                        confirmText="放弃更改"
                        variant="warning"
                    />
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
