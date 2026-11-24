"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type AdminModalMaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";

const maxWidthClasses: Record<AdminModalMaxWidth, string> = {
    sm: "max-w-sm sm:max-w-sm",
    md: "max-w-md sm:max-w-md",
    lg: "max-w-2xl sm:max-w-2xl",
    xl: "max-w-3xl sm:max-w-3xl",
    "2xl": "max-w-2xl sm:max-w-2xl",
    "4xl": "max-w-4xl sm:max-w-4xl",
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
    const hasHeader = Boolean(
        title || showCloseButton || headerExtra || headerIcon,
    );

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !disabled) onClose();
            }}
        >
            <DialogContent
                aria-labelledby={titleId}
                aria-describedby={ariaDescribedby}
                showCloseButton={false}
                className={cn(
                    "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0",
                    maxWidthClasses[maxWidth],
                    className,
                )}
            >
                {!hasHeader && (
                    <DialogTitle id={titleId} className="sr-only">
                        对话框
                    </DialogTitle>
                )}
                {hasHeader && (
                    <div className="flex shrink-0 items-start justify-between border-b border-brand-charcoal/10 px-4 py-3 sm:px-6 sm:py-4">
                        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                            {headerIcon}
                            <div className="min-w-0">
                                {title ? (
                                    <DialogTitle
                                        id={titleId}
                                        className="text-base font-semibold text-brand-charcoal sm:text-lg"
                                    >
                                        {title}
                                    </DialogTitle>
                                ) : (
                                    <DialogTitle
                                        id={titleId}
                                        className="sr-only"
                                    >
                                        对话框
                                    </DialogTitle>
                                )}
                                {subtitle && (
                                    <DialogDescription className="mt-1 text-sm text-brand-charcoal/65">
                                        {subtitle}
                                    </DialogDescription>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {headerExtra}
                            {showCloseButton && (
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="关闭"
                                        disabled={disabled}
                                        className="-mt-1 -mr-1 h-9 w-9 sm:h-8 sm:w-8"
                                    >
                                        <X className="h-5 w-5" />
                                    </Button>
                                </DialogClose>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4 sm:px-6">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
