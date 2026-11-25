"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    "bg-gradient-to-b from-primary to-brand-primary-dark text-primary-foreground shadow-button hover:from-primary/95 hover:to-brand-primary-dark/95 active:translate-y-px",
                primary:
                    "bg-gradient-to-b from-primary to-brand-primary-dark text-primary-foreground shadow-button hover:from-primary/95 hover:to-brand-primary-dark/95 active:translate-y-px",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-button hover:bg-destructive/90 focus-visible:ring-destructive/30",
                danger:
                    "bg-destructive text-destructive-foreground shadow-button hover:bg-destructive/90 focus-visible:ring-destructive/30",
                outline:
                    "border border-border/80 bg-card/50 text-foreground shadow-xs hover:border-border hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
                ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-8 gap-1.5 rounded-md px-3",
                md: "h-9 px-4 py-2",
                lg: "h-10 rounded-md px-6",
                icon: "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

/**
 * shadcn/ui Button 规范实现
 * - 原生 variant：default / destructive / outline / secondary / ghost / link
 * - 兼容旧别名：primary / danger
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "default",
            size = "default",
            loading = false,
            leftIcon,
            rightIcon,
            disabled,
            children,
            ...props
        },
        ref,
    ) => {
        return (
            <button
                ref={ref}
                type="button"
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                className={cn(buttonVariants({ variant, size }), className)}
                {...props}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : leftIcon ? (
                    <span className="flex-shrink-0">{leftIcon}</span>
                ) : null}
                {children}
                {!loading && rightIcon && (
                    <span className="flex-shrink-0">{rightIcon}</span>
                )}
            </button>
        );
    },
);

Button.displayName = "Button";
