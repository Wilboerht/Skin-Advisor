"use client";

/**
 * DatePicker 日期选择组件
 *
 * 基于原生 date input 的封装：label、错误态、必填标识、范围限制。
 * 移动端自动使用系统原生日期选择器。
 */
import { forwardRef, InputHTMLAttributes, useId } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface DatePickerProps extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange"
> {
    label?: string;
    error?: string;
    hint?: string;
    value?: string;
    onChange?: (value: string) => void;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
    (
        {
            className,
            label,
            error,
            hint,
            value,
            onChange,
            id,
            required,
            disabled,
            min,
            max,
            ...props
        },
        ref,
    ) => {
        const generatedId = useId();
        const dateId = id ?? generatedId;
        const errorId = `${dateId}-error`;
        const hintId = `${dateId}-hint`;
        const describedBy = error ? errorId : hint ? hintId : undefined;

        return (
            <div className="w-full">
                {label && (
                    <Label
                        htmlFor={dateId}
                        className="mb-1 text-sm font-medium text-foreground/80"
                    >
                        {label}
                        {required && (
                            <span
                                className="ml-0.5 text-destructive"
                                aria-hidden="true"
                            >
                                *
                            </span>
                        )}
                    </Label>
                )}
                <div className="relative">
                    <input
                        ref={ref}
                        type="date"
                        id={dateId}
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={disabled}
                        required={required}
                        min={min}
                        max={max}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        className={cn(
                            "flex h-9 w-full rounded-md border border-input bg-card/60 px-3 py-1 pr-10 text-base text-foreground shadow-[inset_0_1px_2px_rgba(61,47,37,0.04)] transition-[color,box-shadow,border-color] outline-none",
                            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
                            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                            "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                            "[color-scheme:light]",
                            !value && "text-transparent",
                            className,
                        )}
                        {...props}
                    />
                    {!value && !disabled && (
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                        >
                            {props.placeholder || "选择日期"}
                        </span>
                    )}
                    <Calendar
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                </div>
                {error ? (
                    <p id={errorId} className="mt-1 text-sm text-destructive">
                        {error}
                    </p>
                ) : hint ? (
                    <p
                        id={hintId}
                        className="mt-1 text-xs text-muted-foreground"
                    >
                        {hint}
                    </p>
                ) : null}
            </div>
        );
    },
);

DatePicker.displayName = "DatePicker";
