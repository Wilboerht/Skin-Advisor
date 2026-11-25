"use client";

import { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3",
    {
        variants: {
            variant: {
                default: "border-primary/15 bg-primary/10 text-primary",
                primary: "border-primary/15 bg-primary/10 text-primary",
                secondary:
                    "border-border/80 bg-secondary text-secondary-foreground",
                destructive:
                    "border-destructive/20 bg-destructive/10 text-destructive",
                danger:
                    "border-destructive/20 bg-destructive/10 text-destructive",
                success:
                    "border-state-great/20 bg-state-great/10 text-state-great",
                warning:
                    "border-brand-ember/20 bg-brand-ember/10 text-brand-ember",
                outline: "border-border/80 text-muted-foreground",
            },
            size: {
                sm: "",
                md: "px-2.5 py-0.5 text-xs",
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
 * shadcn/ui Badge 规范实现
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
        gray: "bg-muted-foreground",
        green: "bg-state-great",
        yellow: "bg-brand-ember",
        red: "bg-destructive",
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
