"use client";

import {
    forwardRef,
    useId,
    type ComponentPropsWithoutRef,
    type ComponentRef,
} from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

interface SwitchProps
    extends Omit<
        ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
        "checked" | "onCheckedChange" | "onChange"
    > {
    label?: string;
    description?: string;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
}

/**
 * 开关切换组件（shadcn/ui Switch 规范实现，保持原 API）
 */
export const Switch = forwardRef<
    ComponentRef<typeof SwitchPrimitive.Root>,
    SwitchProps
>(
    (
        {
            className,
            label,
            description,
            checked = false,
            onChange,
            disabled,
            id,
            ...props
        },
        ref,
    ) => {
        // 未显式传 id 时自动生成，使 label 点击可切换开关
        const generatedId = useId();
        const switchId = id ?? generatedId;

        return (
            <div className={cn("flex items-start gap-3", className)}>
                <SwitchPrimitive.Root
                    ref={ref}
                    id={switchId}
                    data-slot="switch"
                    checked={checked}
                    onCheckedChange={onChange}
                    disabled={disabled}
                    className={cn(
                        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-brand-charcoal/15",
                    )}
                    {...props}
                >
                    <SwitchPrimitive.Thumb
                        data-slot="switch-thumb"
                        className={cn(
                            "pointer-events-none block size-5 rounded-full bg-white shadow ring-0 transition-transform",
                            "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
                        )}
                    />
                </SwitchPrimitive.Root>

                {(label || description) && (
                    <div className="flex-1">
                        {label && (
                            <label
                                htmlFor={switchId}
                                className={cn(
                                    "text-sm font-medium text-brand-charcoal",
                                    disabled && "cursor-not-allowed opacity-50",
                                )}
                            >
                                {label}
                            </label>
                        )}
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    },
);

Switch.displayName = "Switch";
