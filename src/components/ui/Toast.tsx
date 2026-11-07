"use client";

import * as React from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastActions {
    toast: {
        success: (message: string, duration?: number) => void;
        error: (message: string, duration?: number) => void;
        info: (message: string, duration?: number) => void;
        warning: (message: string, duration?: number) => void;
    };
    removeToast: (id: string) => void;
}

// 拆成两个 Context：toast 函数消费者不随 toast 列表变化重渲染
const ToastActionsContext = React.createContext<ToastActions | undefined>(
    undefined,
);
const ToastListContext = React.createContext<Toast[]>([]);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    // 按 toastId 绑定定时器，避免按 Set 顺序误清其他 toast 的 timer
    const timeoutRefs = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
        new Map(),
    );

    React.useEffect(() => {
        const timers = timeoutRefs.current;
        return () => {
            timers.forEach(clearTimeout);
            timers.clear();
        };
    }, []);

    // toast 被移除（手动/自动/超上限）后清理对应 timer
    React.useEffect(() => {
        const alive = new Set(toasts.map((t) => t.id));
        for (const [id, timer] of timeoutRefs.current) {
            if (!alive.has(id)) {
                clearTimeout(timer);
                timeoutRefs.current.delete(id);
            }
        }
    }, [toasts]);

    const toastIdCounter = React.useRef(0);
    const MAX_TOASTS = 4;

    const removeToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = React.useCallback(
        (message: string, type: ToastType, duration?: number) => {
            // 错误类 toast 默认展示更久，给用户留足阅读时间
            const effectiveDuration =
                duration ?? (type === "error" ? 5000 : 3000);
            const id = `${++toastIdCounter.current}-${Date.now()}`;
            setToasts((prev) => {
                const next = [
                    ...prev,
                    { id, message, type, duration: effectiveDuration },
                ];
                // 超过上限时移除最早的 toast
                return next.length > MAX_TOASTS
                    ? next.slice(next.length - MAX_TOASTS)
                    : next;
            });

            if (effectiveDuration > 0) {
                const timer = setTimeout(() => {
                    timeoutRefs.current.delete(id);
                    removeToast(id);
                }, effectiveDuration);
                timeoutRefs.current.set(id, timer);
            }
        },
        [removeToast],
    );

    const toast = React.useMemo(
        () => ({
            success: (message: string, duration?: number) =>
                addToast(message, "success", duration),
            error: (message: string, duration?: number) =>
                addToast(message, "error", duration),
            info: (message: string, duration?: number) =>
                addToast(message, "info", duration),
            warning: (message: string, duration?: number) =>
                addToast(message, "warning", duration),
        }),
        [addToast],
    );

    const actions = React.useMemo(
        () => ({ toast, removeToast }),
        [toast, removeToast],
    );

    return (
        <ToastActionsContext.Provider value={actions}>
            <ToastListContext.Provider value={toasts}>
                {children}
                <ToastContainer />
            </ToastListContext.Provider>
        </ToastActionsContext.Provider>
    );
}

function ToastContainer() {
    const toasts = React.useContext(ToastListContext);
    const actions = React.useContext(ToastActionsContext);
    const removeToast = actions?.removeToast ?? (() => {});
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
            aria-live="polite"
            className="fixed right-0 left-0 bottom-[calc(1rem+env(safe-area-inset-bottom,16px))] md:right-6 md:left-auto md:top-6 md:bottom-auto z-[100100] flex flex-col items-center md:items-end gap-2 px-4 md:px-0"
        >
            <LazyMotion features={domAnimation}>
                <AnimatePresence>
                    {toasts.map((t) => {
                        const Icon = IconComponent[t.type];
                        return (
                            <m.div
                                key={t.id}
                                role={t.type === "error" ? "alert" : undefined}
                                initial={
                                    reducedMotion
                                        ? false
                                        : { opacity: 0, y: 8, x: 0 }
                                }
                                animate={
                                    reducedMotion
                                        ? {}
                                        : { opacity: 1, y: 0, x: 0 }
                                }
                                exit={
                                    reducedMotion
                                        ? {}
                                        : {
                                              opacity: 0,
                                              y: 8,
                                              transition: { duration: 0.15 },
                                          }
                                }
                                onClick={() => removeToast(t.id)}
                                className="flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl border border-brand-charcoal/10 bg-white px-4 py-3 text-sm leading-snug text-brand-charcoal shadow-xl md:w-auto"
                            >
                                <Icon
                                    className={`h-4 w-4 shrink-0 ${iconColor[t.type]}`}
                                    strokeWidth={2}
                                />
                                <span className="font-normal tracking-wide">
                                    {t.message}
                                </span>
                            </m.div>
                        );
                    })}
                </AnimatePresence>
            </LazyMotion>
        </div>
    );
}

export function useToast() {
    const context = React.useContext(ToastActionsContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context.toast;
}
