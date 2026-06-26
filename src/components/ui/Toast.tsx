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

    const toastIdCounter = React.useRef(0);
    const MAX_TOASTS = 4;

    const removeToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = React.useCallback(
        (message: string, type: ToastType, duration = 3000) => {
            const id = `${++toastIdCounter.current}-${Date.now()}`;
            setToasts((prev) => {
                const next = [...prev, { id, message, type, duration }];
                // 超过上限时移除最早的 toast
                if (next.length > MAX_TOASTS) {
                    const removed = next.shift();
                    if (removed) {
                        const timer = timeoutRefs.current.values().next().value;
                        if (timer) clearTimeout(timer);
                    }
                }
                return next;
            });

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
    // pause-on-hover: mouse/touch suspends auto-dismiss
    const [pausedIds, setPausedIds] = React.useState<Set<string>>(new Set());

    const iconColor = {
        success: "text-emerald-500",
        error: "text-red-500",
        warning: "text-amber-500",
        info: "text-blue-500",
    };
    const IconComponent = {
        success: CheckCircle,
        error: AlertCircle,
        warning: AlertTriangle,
        info: Info,
    };

    return (
        <div
            className="fixed top-4 left-1/2 z-[100000] flex w-full max-w-xs -translate-x-1/2 flex-col items-center gap-2 px-4"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
            <AnimatePresence>
                {toasts.map((t) => {
                    const Icon = IconComponent[t.type];
                    return (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                        layout
                        onMouseEnter={() => setPausedIds((prev) => new Set(prev).add(t.id))}
                        onMouseLeave={() => setPausedIds((prev) => { const next = new Set(prev); next.delete(t.id); return next; })}
                        onTouchStart={() => setPausedIds((prev) => new Set(prev).add(t.id))}
                        onTouchEnd={() => setTimeout(() => setPausedIds((prev) => { const next = new Set(prev); next.delete(t.id); return next; }), 2000)}
                        onClick={() => removeToast(t.id)}
                        className="flex items-center gap-2.5 rounded-2xl bg-white/90 backdrop-blur-xl px-4 py-2.5 text-[13px] leading-snug text-[#1A1A1A] cursor-pointer select-none shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]"
                    >
                        <Icon className={`h-4 w-4 shrink-0 ${iconColor[t.type]}`} strokeWidth={2} />
                        <span className="font-normal tracking-wide">{t.message}</span>
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
