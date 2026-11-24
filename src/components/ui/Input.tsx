"use client";

import { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    /** 输入框右侧附加内容（如密码可见按钮） */
    rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            label,
            error,
            hint,
            rightElement,
            id,
            disabled,
            required,
            ...props
        },
        ref,
    ) => {
        // 未显式传 id 时自动生成，保证 label 与错误提示可正确关联
        const generatedId = useId();
        const inputId = id ?? generatedId;
        const errorId = `${inputId}-error`;
        const hintId = `${inputId}-hint`;
        const describedBy = error ? errorId : hint ? hintId : undefined;
        return (
            <div className="w-full">
                {label && (
                    <Label
                        htmlFor={inputId}
                        className="mb-1 text-sm font-medium text-brand-charcoal/80"
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
                        id={inputId}
                        disabled={disabled}
                        required={required}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        className={cn(
                            "flex h-11 w-full min-w-0 rounded-lg border border-input bg-white px-4 py-2.5 text-base text-brand-charcoal shadow-xs transition-[color,box-shadow] outline-none",
                            "placeholder:text-muted-foreground",
                            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                            "disabled:cursor-not-allowed disabled:bg-brand-charcoal/[0.03] disabled:opacity-50 md:text-sm",
                            rightElement && "pr-12",
                            className,
                        )}
                        {...props}
                    />
                    {rightElement && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2">
                            {rightElement}
                        </div>
                    )}
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

Input.displayName = "Input";
