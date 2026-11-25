"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./dialog";
import { useModalBackClose } from "@/hooks/use-modal-back-close";
import { cn } from "@/lib/utils";
import { MODAL_BOTTOM_SHEET_RADIUS } from "./modal-styles";

type ResponsiveDialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";

const sizeClasses: Record<ResponsiveDialogSize, string> = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "4xl": "sm:max-w-4xl",
};

interface ResponsiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    /** 覆盖在弹窗内容之上的装饰层（礼物彩带等），不参与交互 */
    overlay?: ReactNode;
    size?: ResponsiveDialogSize;
    className?: string;
    bodyClassName?: string;
    headerClassName?: string;
    footerClassName?: string;
    showCloseButton?: boolean;
    dismissible?: boolean;
    /** 移动端底部升起（默认），桌面端居中 */
    mobileSheet?: boolean;
}

/**
 * 全站统一响应式弹窗：
 * - 移动端底部 Sheet，桌面端居中 Dialog（shadcn 原生结构）
 * - 统一处理焦点锁定、Esc、遮罩、浏览器返回键
 */
export function ResponsiveDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    overlay,
    size = "lg",
    className,
    bodyClassName,
    headerClassName,
    footerClassName,
    showCloseButton = true,
    dismissible = true,
    mobileSheet = true,
}: ResponsiveDialogProps) {
    const openedAtRef = useRef(0);

    useEffect(() => {
        if (open) openedAtRef.current = Date.now();
    }, [open]);

    useModalBackClose(open, () => {
        if (dismissible) onOpenChange(false);
    });

    const handleOpenChange = (next: boolean) => {
        if (next) {
            onOpenChange(true);
            return;
        }
        if (!dismissible) return;
        // 防止“双击入口”的第二下穿透遮罩，打开后 350ms 内忽略关闭
        if (Date.now() - openedAtRef.current < 350) return;
        onOpenChange(false);
    };

    const hasHeader = Boolean(title || description);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                showCloseButton={showCloseButton}
                className={cn(
                    "flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)]",
                    mobileSheet &&
                        `max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 ${MODAL_BOTTOM_SHEET_RADIUS}`,
                    sizeClasses[size],
                    className,
                )}
            >
                {overlay && (
                    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                        {overlay}
                    </div>
                )}

                {hasHeader ? (
                    <DialogHeader
                        className={cn(
                            "shrink-0 border-b border-border/70 px-6 py-4 pr-14 text-left",
                            headerClassName,
                        )}
                    >
                        <DialogTitle>{title}</DialogTitle>
                        {description ? (
                            <DialogDescription>{description}</DialogDescription>
                        ) : (
                            <DialogDescription className="sr-only">
                                对话框内容
                            </DialogDescription>
                        )}
                    </DialogHeader>
                ) : (
                    <DialogHeader className="sr-only">
                        <DialogTitle>对话框</DialogTitle>
                        <DialogDescription>对话框内容</DialogDescription>
                    </DialogHeader>
                )}

                <div
                    className={cn(
                        "flex-1 overflow-y-auto overscroll-y-contain px-6 py-4",
                        bodyClassName,
                    )}
                >
                    {children}
                </div>

                {footer && (
                    <DialogFooter
                        className={cn(
                            "shrink-0 border-t border-border/70 px-6 py-4",
                            footerClassName,
                        )}
                    >
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
