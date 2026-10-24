"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@/lib/utils";

// 模块级滚动锁引用计数，支持跨实例的嵌套模态框
let globalScrollLockCount = 0;
let globalScrollOriginalOverflow = "";
let globalScrollOriginalPaddingRight = "";

export type AdminModalMaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";

const maxWidthClasses: Record<AdminModalMaxWidth, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
};

interface AdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    titleId: string;
    subtitle?: ReactNode;
    children: ReactNode;
    maxWidth?: AdminModalMaxWidth;
    showCloseButton?: boolean;
    disabled?: boolean;
    /** Extra content for the header, rendered to the right of title */
    headerExtra?: ReactNode;
    /** Optional icon shown before the title */
    headerIcon?: ReactNode;
    className?: string;
    /** Accessibility: associate description content with the dialog */
    "aria-describedby"?: string;
}

export function AdminModal({
    isOpen,
    onClose,
    title,
    titleId,
    subtitle,
    children,
    maxWidth = "2xl",
    showCloseButton = true,
    disabled = false,
    headerExtra,
    headerIcon,
    className,
    "aria-describedby": ariaDescribedby,
}: AdminModalProps) {
    const mounted = useMounted();
    // Escape 由 focus trap 栈统一处理：只有最上层弹层响应，避免嵌套弹层一次关两层
    const containerRef = useFocusTrap<HTMLDivElement>(isOpen, () => {
        if (!disabled) onClose();
    });
    // 检测用户是否偏好减少动画
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [isOpen]);

    // Body scroll lock: 使用模块级引用计数支持跨实例嵌套模态框
    useEffect(() => {
        if (!isOpen) return;
        if (globalScrollLockCount === 0) {
            globalScrollOriginalOverflow = document.body.style.overflow;
            globalScrollOriginalPaddingRight = document.body.style.paddingRight;
            const scrollbarWidth =
                window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = "hidden";
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }
        }
        globalScrollLockCount++;
        return () => {
            globalScrollLockCount--;
            if (globalScrollLockCount <= 0) {
                globalScrollLockCount = 0;
                document.body.style.overflow = globalScrollOriginalOverflow;
                document.body.style.paddingRight =
                    globalScrollOriginalPaddingRight;
                globalScrollOriginalOverflow = "";
                globalScrollOriginalPaddingRight = "";
            }
        };
    }, [isOpen]);

    if (!mounted) return null;

    // prefers-reduced-motion: 无动画过渡
    const motionProps = reducedMotion
        ? ({ transition: { duration: 0 } } as const)
        : ({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
          } as const);

    const contentProps = reducedMotion
        ? ({ transition: { duration: 0 } } as const)
        : ({
              initial: { opacity: 0, scale: 0.95, y: 10 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.95, y: 10 },
              transition: {
                  type: "spring" as const,
                  damping: 25,
                  stiffness: 300,
              },
          } as const);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    ref={containerRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={ariaDescribedby}
                    className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
                    style={{
                        paddingTop: "env(safe-area-inset-top, 0px)",
                        paddingBottom: "env(safe-area-inset-bottom, 0px)",
                        paddingLeft: "env(safe-area-inset-left, 0px)",
                        paddingRight: "env(safe-area-inset-right, 0px)",
                    }}
                    tabIndex={-1}
                >
                    <motion.div
                        {...motionProps}
                        onClick={() => !disabled && onClose()}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />
                    <motion.div
                        {...contentProps}
                        className={cn(
                            "relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-full flex-col overflow-hidden rounded-xl border border-brand-charcoal/10 bg-white shadow-2xl mx-4 sm:mx-0",
                            maxWidthClasses[maxWidth],
                            className,
                        )}
                    >
                        {(title ||
                            showCloseButton ||
                            headerExtra ||
                            headerIcon) && (
                            <div className="flex shrink-0 items-start justify-between border-b border-brand-charcoal/10 px-4 py-3 sm:px-6 sm:py-4">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    {headerIcon}
                                    <div className="min-w-0">
                                        {title && (
                                            <h3
                                                id={titleId}
                                                className="text-base font-semibold text-brand-charcoal sm:text-lg"
                                            >
                                                {title}
                                            </h3>
                                        )}
                                        {subtitle && (
                                            <p className="mt-1 text-sm text-brand-charcoal/65">
                                                {subtitle}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {headerExtra}
                                    {showCloseButton && (
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            disabled={disabled}
                                            aria-label="关闭"
                                            className="-mr-2 -mt-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-brand-charcoal/65 transition-colors hover:bg-brand-charcoal/[0.06] hover:text-brand-charcoal sm:h-9 sm:w-9"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 sm:px-6">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
