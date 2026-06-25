"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    toast: {
        success: (message: string, duration?: number) => void;
        error: (message: string, duration?: number) => void;
        info: (message: string, duration?: number) => void;
        warning: (message: string, duration?: number) => void;
    };
    removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    const timeoutRefs = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

    React.useEffect(() => {
        return () => {
            timeoutRefs.current.forEach(clearTimeout);
            timeoutRefs.current.clear();
        };
    }, []);

    const removeToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = React.useCallback(
        (message: string, type: ToastType, duration = 3000) => {
            const id = Math.random().toString(36).substring(2, 9);
            setToasts((prev) => [...prev, { id, message, type, duration }]);

            if (duration > 0) {
                const timer = setTimeout(() => {
                    timeoutRefs.current.delete(timer);
                    removeToast(id);
                }, duration);
                timeoutRefs.current.add(timer);
            }
        },
        [removeToast]
    );

    const toast = React.useMemo(
        () => ({
            success: (message: string, duration?: number) => addToast(message, "success", duration),
            error: (message: string, duration?: number) => addToast(message, "error", duration),
            info: (message: string, duration?: number) => addToast(message, "info", duration),
            warning: (message: string, duration?: number) => addToast(message, "warning", duration),
        }),
        [addToast]
    );

    return (
        <ToastContext.Provider value={{ toasts, toast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

function ToastContainer({
    toasts,
    removeToast,
}: {
    toasts: Toast[];
    removeToast: (id: string) => void;
}) {
    // 生产环境不展示 Toast 提示
    if (process.env.NODE_ENV === "production") return null;

    const typeStyles = {
        success: {
            bg: "bg-emerald-50/95",
            border: "border-emerald-100",
            accent: "bg-emerald-500",
            text: "text-emerald-800",
            icon: "text-emerald-500",
        },
        error: {
            bg: "bg-red-50/95",
            border: "border-red-100",
            accent: "bg-red-500",
            text: "text-red-800",
            icon: "text-red-500",
        },
        warning: {
            bg: "bg-amber-50/95",
            border: "border-amber-100",
            accent: "bg-amber-500",
            text: "text-amber-800",
            icon: "text-amber-500",
        },
        info: {
            bg: "bg-blue-50/95",
            border: "border-blue-100",
            accent: "bg-blue-500",
            text: "text-slate-800",
            icon: "text-blue-500",
        },
    };

    return (
        <div className="fixed top-4 left-1/2 z-[100000] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:top-6">
            <AnimatePresence>
                {toasts.map((t) => {
                    const s = typeStyles[t.type];
                    return (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: -16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                            layout
                            className={`relative flex items-center gap-3 rounded-xl pl-4 pr-3 py-3.5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] backdrop-blur-md border overflow-hidden ${s.bg} ${s.border}`}
                        >
                            {/* Left accent bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full ${s.accent}`} />

                            {t.type === "success" && <CheckCircle className={`h-5 w-5 shrink-0 ${s.icon}`} strokeWidth={1.5} />}
                            {t.type === "error" && <AlertCircle className={`h-5 w-5 shrink-0 ${s.icon}`} strokeWidth={1.5} />}
                            {t.type === "warning" && <AlertTriangle className={`h-5 w-5 shrink-0 ${s.icon}`} strokeWidth={1.5} />}
                            {t.type === "info" && <Info className={`h-5 w-5 shrink-0 ${s.icon}`} strokeWidth={1.5} />}

                            <p className={`flex-1 text-[13px] font-medium leading-snug ${s.text}`}>
                                {t.message}
                            </p>

                            <button
                                onClick={() => removeToast(t.id)}
                                className="shrink-0 rounded-full p-1.5 hover:bg-black/5 transition-colors"
                            >
                                <X className="h-3.5 w-3.5 text-black/25" strokeWidth={2} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

export function useToast() {
    const context = React.useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context.toast;
}
