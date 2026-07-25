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
    const [reducedMotion, setReducedMotion] = React.useState(false);

    React.useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

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
            className="fixed right-0 left-0 bottom-[calc(1rem+env(safe-area-inset-bottom,16px))] md:right-6 md:left-auto md:top-6 md:bottom-auto z-[100000] flex flex-col items-center md:items-end gap-2 px-4 md:px-0"
        >
            <AnimatePresence>
                {toasts.map((t) => {
                    const Icon = IconComponent[t.type];
                    return (
                    <motion.div
                        key={t.id}
                        initial={reducedMotion ? false : { opacity: 0, y: 8, x: 0 }}
                        animate={reducedMotion ? {} : { opacity: 1, y: 0, x: 0 }}
                        exit={reducedMotion ? {} : { opacity: 0, y: 8, transition: { duration: 0.15 } }}
                        layout
                        onMouseEnter={() => setPausedIds((prev) => new Set(prev).add(t.id))}
                        onMouseLeave={() => setPausedIds((prev) => { const next = new Set(prev); next.delete(t.id); return next; })}
                        onTouchStart={() => setPausedIds((prev) => new Set(prev).add(t.id))}
                        onTouchEnd={() => setTimeout(() => setPausedIds((prev) => { const next = new Set(prev); next.delete(t.id); return next; }), 2000)}
                        onClick={() => removeToast(t.id)}
                        className="flex items-center gap-2.5 rounded-2xl bg-white/90 backdrop-blur-xl px-4 py-2.5 text-[13px] leading-snug text-[#1A1A1A] cursor-pointer select-none shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] w-full md:w-auto"
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
