"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./Button";

type IconButtonVariant = "ghost" | "outline" | "danger";
type IconButtonSize = "sm" | "md" | "lg";

const sizeClasses: Record<IconButtonSize, string> = {
    sm: "size-8",
    md: "size-11 sm:size-9",
    lg: "size-11",
};

interface IconButtonProps {
    /** 必填：图标按钮没有可见文字，靠 aria-label 传达用途 */
    label: string;
    /** 传 href 时渲染为链接（如“编辑”跳转） */
    href?: string;
    onClick?: () => void;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    title?: string;
    className?: string;
    disabled?: boolean;
    children: ReactNode;
}

const variantMap = {
    ghost: "ghost",
    outline: "outline",
    danger: "destructive",
} as const;

/** 全站统一图标按钮：shadcn Button + 44px 移动端触控区 */
export function IconButton({
    label,
    href,
    onClick,
    variant = "ghost",
    size = "md",
    title,
    className,
    disabled = false,
    children,
}: IconButtonProps) {
    const classes = cn(
        buttonVariants({ variant: variantMap[variant], size: "icon" }),
        sizeClasses[size],
        className,
    );

    if (href) {
        return (
            <Link
                href={href}
                aria-label={label}
                aria-disabled={disabled || undefined}
                tabIndex={disabled ? -1 : undefined}
                title={title}
                onClick={(event) => {
                    if (disabled) {
                        event.preventDefault();
                        return;
                    }
                    onClick?.();
                }}
                className={classes}
            >
                {children}
            </Link>
        );
    }

    return (
        <Button
            type="button"
            variant={variantMap[variant]}
            size="icon"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={title}
            className={cn(sizeClasses[size], className)}
        >
            {children}
        </Button>
    );
}
