"use client";

import { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    /** 输入框左侧附加内容（如手机号/锁图标） */
    leftElement?: ReactNode;
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
            leftElement,
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
                    {leftElement && (
                        <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                            {leftElement}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        disabled={disabled}
                        required={required}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        className={cn(
                            "flex h-9 w-full min-w-0 rounded-md border border-input bg-card/60 px-3 py-1 text-base text-foreground shadow-[inset_0_1px_2px_rgba(61,47,37,0.04)] transition-[color,box-shadow,border-color] outline-none",
                            "placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground",
                            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
                            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                            "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                            leftElement && "pl-9",
                            rightElement && "pr-10",
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
