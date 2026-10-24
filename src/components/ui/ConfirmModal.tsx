"use client";

import { useState, useCallback, useId, useRef } from "react";
import { AdminModal } from "./AdminModal";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "default";
    loading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "确认",
    cancelText = "取消",
    variant = "default",
    loading = false,
}: ConfirmModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const titleId = useId();
    const descId = `${titleId}-desc`;

    const handleConfirm = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            // 30 秒超时保护，防止 Promise 永不 resolve
            const result = onConfirm();
            if (result instanceof Promise) {
                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error("操作超时，请重试")),
                        30000,
                    ),
                );
                await Promise.race([result, timeout]);
            }
            setIsSubmitting(false);
        } catch (err) {
            setIsSubmitting(false);
            setError(err instanceof Error ? err.message : "操作未成功，请重试");
        }
    };

    const isLoading = loading || isSubmitting;

    const iconStyles =
        variant === "danger"
            ? "bg-red-50 text-red-500"
            : variant === "warning"
              ? "bg-amber-50 text-amber-500"
              : "bg-brand-primary/10 text-brand-primary";

    return (
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            titleId={titleId}
            maxWidth="sm"
            disabled={isLoading}
            showCloseButton={!isLoading}
            aria-describedby={descId}
        >
            <div className="flex gap-4">
                <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconStyles}`}
                >
                    <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p
                        id={descId}
                        className="text-sm leading-relaxed text-brand-charcoal/65"
                    >
                        {message}
                    </p>
                    {error && (
                        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                            {error}
                        </p>
                    )}
                </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading}
                >
                    {cancelText}
                </Button>
                <Button
                    type="button"
                    variant={variant === "danger" ? "danger" : "primary"}
                    onClick={handleConfirm}
                    loading={isLoading}
                >
                    {confirmText}
                </Button>
            </div>
        </AdminModal>
    );
}

// Hook for easier usage
interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "warning" | "default";
    confirmText: string;
    onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
    const [state, setState] = useState<ConfirmState>({
        isOpen: false,
        title: "",
        message: "",
        variant: "default",
        confirmText: "确认",
        onConfirm: () => {},
    });

    const resolveRef = useRef<((value: boolean) => void) | undefined>(
        undefined,
    );

    const confirm = useCallback(
        (options: {
            title: string;
            message: string;
            variant?: "danger" | "warning" | "default";
            confirmText?: string;
        }): Promise<boolean> => {
            return new Promise((resolve) => {
                resolveRef.current = resolve;
                setState({
                    isOpen: true,
                    title: options.title,
                    message: options.message,
                    variant: options.variant || "default",
                    confirmText: options.confirmText || "确认",
                    onConfirm: () => {
                        setState((prev) => ({ ...prev, isOpen: false }));
                        resolveRef.current?.(true);
                        resolveRef.current = undefined;
                    },
                });
            });
        },
        [],
    );

    const close = useCallback(() => {
        setState((prev) => ({ ...prev, isOpen: false }));
        resolveRef.current?.(false);
        resolveRef.current = undefined;
    }, []);

    const ConfirmDialog = useCallback(
        () => (
            <ConfirmModal
                isOpen={state.isOpen}
                onClose={close}
                onConfirm={state.onConfirm}
                title={state.title}
                message={state.message}
                variant={state.variant}
                confirmText={state.confirmText}
            />
        ),
        [state, close],
    );

    return { confirm, ConfirmDialog };
}
