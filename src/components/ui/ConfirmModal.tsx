"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/use-mounted";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "default";
    loading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "确认",
    cancelText = "取消",
    variant = "default",
    loading = false,
}: ConfirmModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const mounted = useMounted();

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm();
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLoading = loading || isSubmitting;

    const variantStyles = {
        danger: {
            icon: "bg-red-100 text-red-600",
            button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
        },
        warning: {
            icon: "bg-amber-100 text-amber-600",
            button: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
        },
        default: {
            icon: "bg-slate-100 text-slate-600",
            button: "bg-slate-900 hover:bg-slate-800 focus:ring-slate-500",
        },
    };

    const styles = variantStyles[variant];

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center">
                     {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
                    />

                    {/* Modal - Liquid Glass Upgrade */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-sm mx-4 bg-white/60 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/70 shadow-[0_40px_100px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-900 hover:bg-white/50 transition-all disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-8">
                            {/* Icon */}
                            <div className={`w-16 h-16 rounded-2xl ${styles.icon.split(' ')[0]} bg-opacity-20 flex items-center justify-center mx-auto mb-6 shadow-sm border-[1px] ${styles.icon.split(' ')[1].replace('text-', 'border-').replace('600', '200')}`}>
                                <AlertTriangle className={`w-8 h-8 ${styles.icon.split(' ')[1]}`} />
                            </div>

                            {/* Title */}
                            <h3 className="text-xl font-bold text-slate-900 text-center mb-3 tracking-tight">
                                {title}
                            </h3>

                            {/* Message */}
                            <p className="text-sm font-medium text-slate-500 text-center mb-8 leading-relaxed px-2">
                                {message}
                            </p>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-white/40 hover:bg-white/60 border border-white/60 rounded-2xl transition-all shadow-sm disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className={`flex-1 px-4 py-3 text-sm font-bold text-white rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70 ${styles.button}`}
                                >
                                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    if (!mounted) return null;
    return createPortal(modalContent, document.body);
}

// Hook for easier usage
interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "warning" | "default";
    confirmText: string;
    onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
    const [state, setState] = useState<ConfirmState>({
        isOpen: false,
        title: "",
        message: "",
        variant: "default",
        confirmText: "确认",
        onConfirm: () => { },
    });

    const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined);

    const confirm = useCallback(
        (options: {
            title: string;
            message: string;
            variant?: "danger" | "warning" | "default";
            confirmText?: string;
        }): Promise<boolean> => {
            return new Promise((resolve) => {
                resolveRef.current = resolve;
                setState({
                    isOpen: true,
                    title: options.title,
                    message: options.message,
                    variant: options.variant || "default",
                    confirmText: options.confirmText || "确认",
                    onConfirm: () => {
                        setState((prev) => ({ ...prev, isOpen: false }));
                        resolveRef.current?.(true);
                        resolveRef.current = undefined;
                    },
                });
            });
        },
        []
    );

    const close = useCallback(() => {
        setState((prev) => ({ ...prev, isOpen: false }));
        resolveRef.current?.(false);
        resolveRef.current = undefined;
    }, []);

    const ConfirmDialog = useCallback(
        () => (
            <ConfirmModal
                isOpen={state.isOpen}
                onClose={close}
                onConfirm={state.onConfirm}
                title={state.title}
                message={state.message}
                variant={state.variant}
                confirmText={state.confirmText}
            />
        ),
        [state, close]
    );

    return { confirm, ConfirmDialog };
}
