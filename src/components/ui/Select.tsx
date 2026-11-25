"use client";

import { useId } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

// Radix Select 不允许空字符串 value：内部用哨兵值，对外仍保持 ""
const EMPTY_VALUE = "__empty__";

interface SelectProps {
    label?: string;
    error?: string;
    hint?: string;
    options: SelectOption[];
    placeholder?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    id?: string;
    name?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    portalContainer?: HTMLElement | null;
    "aria-label"?: string;
}

/**
 * shadcn/ui Select 规范实现（Radix Select），保持原 options / onChange API
 */
export function Select({
    label,
    error,
    hint,
    options,
    placeholder,
    value,
    onChange,
    id,
    name,
    required,
    disabled,
    className,
    portalContainer,
    "aria-label": ariaLabel,
}: SelectProps) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;
    const describedBy = error ? errorId : hint ? hintId : undefined;

    return (
        <div className="w-full">
            {label && (
                <Label
                    htmlFor={selectId}
                    className="mb-1 text-sm font-medium text-foreground/80"
                >
                    {label}
                    {required && (
                        <span className="ml-0.5 text-destructive" aria-hidden>
                            *
                        </span>
                    )}
                </Label>
            )}
            <SelectPrimitive.Root
                value={value === "" ? EMPTY_VALUE : value}
                onValueChange={(next) =>
                    onChange?.({
                        target: {
                            value: next === EMPTY_VALUE ? "" : next,
                        },
                    })
                }
                name={name}
                required={required}
                disabled={disabled}
            >
                <SelectPrimitive.Trigger
                    id={selectId}
                    aria-label={ariaLabel}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn(
                        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card/60 px-3 py-2 text-sm whitespace-nowrap text-foreground shadow-[inset_0_1px_2px_rgba(61,47,37,0.04)] transition-[color,box-shadow,border-color] outline-none",
                        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
                        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1",
                        className,
                    )}
                >
                    <SelectPrimitive.Value placeholder={placeholder} />
                    <SelectPrimitive.Icon asChild>
                        <ChevronDown className="size-4 opacity-50" />
                    </SelectPrimitive.Icon>
                </SelectPrimitive.Trigger>
                <SelectPrimitive.Portal container={portalContainer ?? undefined}>
                    <SelectPrimitive.Content
                        position="popper"
                        sideOffset={4}
                        className={cn(
                            "relative z-[var(--z-modal)] max-h-[var(--radix-select-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border border-border/80 bg-popover text-popover-foreground shadow-card",
                            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                        )}
                    >
                        <SelectPrimitive.Viewport className="p-1">
                            {options.map((option) => (
                                <SelectPrimitive.Item
                                    key={option.value}
                                    value={
                                        option.value === ""
                                            ? EMPTY_VALUE
                                            : option.value
                                    }
                                    disabled={option.disabled}
                                    className={cn(
                                        "relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none",
                                        "focus:bg-accent focus:text-accent-foreground",
                                        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                    )}
                                >
                                    <span className="absolute right-2 flex size-3.5 items-center justify-center">
                                        <SelectPrimitive.ItemIndicator>
                                            <Check className="size-4" />
                                        </SelectPrimitive.ItemIndicator>
                                    </span>
                                    <SelectPrimitive.ItemText>
                                        {option.label}
                                    </SelectPrimitive.ItemText>
                                </SelectPrimitive.Item>
                            ))}
                        </SelectPrimitive.Viewport>
                    </SelectPrimitive.Content>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
            {error ? (
                <p id={errorId} className="mt-1 text-sm text-destructive">
                    {error}
                </p>
            ) : hint ? (
                <p id={hintId} className="mt-1 text-xs text-muted-foreground">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
