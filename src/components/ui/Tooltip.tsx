"use client";

/**
 * Tooltip 提示组件（shadcn/ui Tooltip 规范实现，保持原 API）
 *
 * @example
 * ```tsx
 * <Tooltip content="删除产品">
 *   <button><Trash2 /></button>
 * </Tooltip>
 * ```
 */
import { ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
}

export function Tooltip({
    content,
    children,
    side = "top",
    className,
}: TooltipProps) {
    if (!content) return <>{children}</>;

    return (
        <TooltipPrimitive.Provider delayDuration={200}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                    <span className="inline-flex">{children}</span>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        side={side}
                        sideOffset={8}
                        className={cn(
                            "pointer-events-none z-[99999] max-w-xs rounded-md bg-brand-charcoal/90 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg",
                            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
                            className,
                        )}
                    >
                        {content}
                        <TooltipPrimitive.Arrow className="fill-brand-charcoal/90" />
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}
