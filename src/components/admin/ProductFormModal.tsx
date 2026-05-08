"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package } from "lucide-react";
import ProductForm from "./ProductForm";

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: any;
    onSuccess?: () => void;
}

export function ProductFormModal({ isOpen, onClose, product, onSuccess }: ProductFormModalProps) {
    const [mounted, setMounted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => setMounted(true), []);

    const handleSuccess = () => {
        onSuccess?.();
        onClose();
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !submitting && onClose()}
                        className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-3xl mx-4 bg-white/60 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/70 shadow-[0_40px_100px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                        {product ? "编辑产品" : "新建产品"}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {product ? "修改产品信息" : "填写产品信息并发布到前端展示"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={submitting}
                                className="p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-white/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="px-8 pb-8 overflow-y-auto">
                            <ProductForm
                                key={product?.id || "new"}
                                initialData={product}
                                onSuccess={handleSuccess}
                                onCancel={onClose}
                                onSubmittingChange={setSubmitting}
                            />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
