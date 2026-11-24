"use client";

import { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
    "inline-flex items-center rounded-full font-medium",
    {
        variants: {
            variant: {
                default: "bg-brand-charcoal/8 text-brand-charcoal/80",
                primary: "bg-primary/10 text-primary",
                secondary: "bg-brand-charcoal/8 text-brand-charcoal/70",
                success: "bg-state-great/10 text-state-great",
                warning: "bg-brand-ember/10 text-brand-ember",
                danger: "bg-brand-danger/10 text-brand-danger",
                outline:
                    "border border-brand-charcoal/20 bg-transparent text-brand-charcoal/80",
            },
            size: {
                sm: "px-2.5 py-0.5 text-xs",
                md: "px-2.5 py-1 text-sm",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "sm",
        },
    },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
    children: ReactNode;
    className?: string;
}

/**
 * 状态徽章组件（shadcn/ui Badge 规范实现，保持原 API）
 */
export function Badge({
    children,
    variant = "default",
    size = "sm",
    className,
}: BadgeProps) {
    return (
        <span
            data-slot="badge"
            className={cn(badgeVariants({ variant, size }), className)}
        >
            {children}
        </span>
    );
}

/**
 * 圆点徽章组件
 */
export function DotBadge({
    children,
    color = "gray",
    className,
}: {
    children: ReactNode;
    color?: "gray" | "green" | "yellow" | "red" | "primary";
    className?: string;
}) {
    const dotColors = {
        gray: "bg-brand-charcoal/40",
        green: "bg-state-great",
        yellow: "bg-brand-ember",
        red: "bg-brand-danger",
        primary: "bg-primary",
    };

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-xs",
                className,
            )}
        >
            <span className={cn("h-2 w-2 rounded-full", dotColors[color])} />
            {children}
        </span>
    );
}
