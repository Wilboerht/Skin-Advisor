"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@/lib/utils";

export type AdminModalMaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";

const maxWidthClasses: Record<AdminModalMaxWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
};

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  titleId: string;
  subtitle?: ReactNode;
  children: ReactNode;
  maxWidth?: AdminModalMaxWidth;
  showCloseButton?: boolean;
  disabled?: boolean;
  /** Extra content for the header, rendered to the right of title */
  headerExtra?: ReactNode;
  /** Optional icon shown before the title */
  headerIcon?: ReactNode;
  className?: string;
}

export function AdminModal({
  isOpen,
  onClose,
  title,
  titleId,
  subtitle,
  children,
  maxWidth = "2xl",
  showCloseButton = true,
  disabled = false,
  headerExtra,
  headerIcon,
  className,
}: AdminModalProps) {
  const mounted = useMounted();
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, disabled]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          tabIndex={-1}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !disabled && onClose()}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "relative z-10 w-full mx-4 bg-white/70 backdrop-blur-3xl rounded-[28px] border-[1.5px] border-white/80 shadow-[0_40px_100px_rgba(0,0,0,0.08),inset_0_2px_10px_rgba(255,255,255,0.5)] overflow-hidden max-h-[90vh] flex flex-col",
              maxWidthClasses[maxWidth],
              className
            )}
          >
            {(title || showCloseButton || headerExtra || headerIcon) && (
              <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {headerIcon}
                  <div className="min-w-0">
                    {title && (
                      <h3
                        id={titleId}
                        className="text-lg font-bold text-slate-900 tracking-tight"
                      >
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {headerExtra}
                  {showCloseButton && (
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={disabled}
                      aria-label="关闭"
                      className="p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-white/50 transition-all disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="px-8 pb-8 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
