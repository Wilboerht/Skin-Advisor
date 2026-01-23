"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "info";

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
    };
    removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const addToast = React.useCallback(
        (message: string, type: ToastType, duration = 3000) => {
            const id = Math.random().toString(36).substring(2, 9);
            setToasts((prev) => [...prev, { id, message, type, duration }]);

            if (duration > 0) {
                setTimeout(() => {
                    removeToast(id);
                }, duration);
            }
        },
        []
    );

    const removeToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = React.useMemo(
        () => ({
            success: (message: string, duration?: number) => addToast(message, "success", duration),
            error: (message: string, duration?: number) => addToast(message, "error", duration),
            info: (message: string, duration?: number) => addToast(message, "info", duration),
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
    return (
        <div className="fixed top-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:top-6">
            <AnimatePresence>
                {toasts.map((t) => (
                    <m.div
                        key={t.id}
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        layout
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg backdrop-blur-md border ${t.type === "success"
                                ? "bg-white/90 border-green-200 text-green-800"
                                : t.type === "error"
                                    ? "bg-white/90 border-red-200 text-red-800"
                                    : "bg-white/90 border-blue-200 text-slate-800"
                            }`}
                    >
                        {t.type === "success" && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                        {t.type === "error" && <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />}
                        {t.type === "info" && <Info className="h-5 w-5 text-blue-500 shrink-0" />}

                        <p className="flex-1 text-sm font-medium">{t.message}</p>

                        <button
                            onClick={() => removeToast(t.id)}
                            className="ml-2 rounded-full p-1 hover:bg-black/5 transition-colors"
                        >
                            <X className="h-4 w-4 opacity-50" />
                        </button>
                    </m.div>
                ))}
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
