"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "./Button";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./alert-dialog";

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

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !isLoading) onClose();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{message}</AlertDialogDescription>
                </AlertDialogHeader>
                {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </p>
                )}
                <AlertDialogFooter>
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
                        variant={variant === "danger" ? "destructive" : "default"}
                        onClick={handleConfirm}
                        loading={isLoading}
                    >
                        {confirmText}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
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
