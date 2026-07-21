"use client";

import { useState, useCallback, useRef } from "react";
import { AdminModal } from "./AdminModal";
import { X, AlertTriangle, Loader2 } from "lucide-react";

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
  const titleId = useRef(`confirm-modal-title-${Math.random().toString(36).slice(2, 9)}`).current;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      setIsSubmitting(false);
    } catch {
      setIsSubmitting(false);
    }
  };

  const isLoading = loading || isSubmitting;

  const variantStyles = {
    danger: {
      icon: "bg-red-100 text-red-600",
      button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      icon: "bg-amber-100 text-amber-600",
      button: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
    },
    default: {
      icon: "bg-slate-100 text-slate-600",
      button: "bg-slate-900 hover:bg-slate-800 focus:ring-slate-500",
    },
  };

  const styles = variantStyles[variant];

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      titleId={titleId}
      maxWidth="sm"
      disabled={isLoading}
      showCloseButton={!isLoading}
    >
      <div className="text-center">
        <div
          className={`w-16 h-16 rounded-2xl ${styles.icon} flex items-center justify-center mx-auto mb-6 shadow-sm border`}
        >
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-sm font-medium text-slate-500 text-center mb-8 leading-relaxed px-2">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-white/40 hover:bg-white/60 border border-white/60 rounded-2xl transition-all shadow-sm disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-3 text-sm font-bold text-white rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70 ${styles.button}`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
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

  const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined);

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
    []
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
    [state, close]
  );

  return { confirm, ConfirmDialog };
}
