"use client";

import { TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
        { className, label, error, hint, id, disabled, required, ...props },
        ref,
    ) => {
        // 未显式传 id 时自动生成，保证 label 与错误提示可正确关联
        const generatedId = useId();
        const textareaId = id ?? generatedId;
        const errorId = `${textareaId}-error`;
        const hintId = `${textareaId}-hint`;
        const describedBy = error ? errorId : hint ? hintId : undefined;
        return (
            <div className="w-full">
                {label && (
                    <Label
                        htmlFor={textareaId}
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
                <textarea
                    ref={ref}
                    id={textareaId}
                    disabled={disabled}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn(
                        "flex min-h-16 w-full rounded-lg border border-input bg-white px-4 py-2.5 text-base text-brand-charcoal shadow-xs transition-[color,box-shadow] outline-none",
                        "placeholder:text-muted-foreground",
                        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                        "disabled:cursor-not-allowed disabled:bg-brand-charcoal/[0.03] disabled:opacity-50 md:text-sm",
                        className,
                    )}
                    {...props}
                />
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

Textarea.displayName = "Textarea";
