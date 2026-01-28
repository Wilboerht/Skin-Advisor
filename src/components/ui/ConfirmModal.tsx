"use client";

import * as React from "react";
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
    const [isSubmitting, setIsSubmitting] = React.useState(false);

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

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-full ${styles.icon} flex items-center justify-center mx-auto mb-4`}>
                                <AlertTriangle className="w-6 h-6" />
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                                {title}
                            </h3>

                            {/* Message */}
                            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
                                {message}
                            </p>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${styles.button}`}
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
    const [state, setState] = React.useState<ConfirmState>({
        isOpen: false,
        title: "",
        message: "",
        variant: "default",
        confirmText: "确认",
        onConfirm: () => { },
    });

    const confirm = React.useCallback(
        (options: {
            title: string;
            message: string;
            variant?: "danger" | "warning" | "default";
            confirmText?: string;
        }): Promise<boolean> => {
            return new Promise((resolve) => {
                setState({
                    isOpen: true,
                    title: options.title,
                    message: options.message,
                    variant: options.variant || "default",
                    confirmText: options.confirmText || "确认",
                    onConfirm: () => {
                        setState((prev) => ({ ...prev, isOpen: false }));
                        resolve(true);
                    },
                });
            });
        },
        []
    );

    const close = React.useCallback(() => {
        setState((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const ConfirmDialog = React.useCallback(
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
