"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium tracking-wider outline-none transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                secondary:
                    "bg-brand-charcoal/8 text-brand-charcoal hover:bg-brand-charcoal/15",
                outline:
                    "border border-brand-charcoal/20 bg-white text-brand-charcoal/80 hover:bg-brand-charcoal/[0.03]",
                ghost: "text-brand-charcoal/80 hover:bg-brand-charcoal/[0.06]",
                danger:
                    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
            },
            size: {
                sm: "h-9 px-3 text-sm",
                md: "h-11 px-4 text-sm",
                lg: "h-12 px-6 text-base",
                icon: "size-9",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "md",
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
 * 通用按钮组件（shadcn/ui Button 规范实现，保持原 API）
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "primary",
            size = "md",
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
