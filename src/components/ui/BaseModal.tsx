"use client";

import { AdminModal, type AdminModalMaxWidth } from "./AdminModal";
import type { ReactNode } from "react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  titleId?: string;
  subtitle?: ReactNode;
  maxWidth?: AdminModalMaxWidth;
  showCloseButton?: boolean;
  disabled?: boolean;
}

/**
 * @deprecated Use AdminModal directly instead.
 * This wrapper remains for backward compatibility with existing code.
 */
export function BaseModal({
  isOpen,
  onClose,
  children,
  title,
  titleId,
  subtitle,
  maxWidth,
  showCloseButton = true,
  disabled = false,
}: BaseModalProps) {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      titleId={titleId ?? "base-modal-title"}
      subtitle={subtitle}
      maxWidth={maxWidth ?? "2xl"}
      showCloseButton={showCloseButton}
      disabled={disabled}
    >
      {children}
    </AdminModal>
  );
}
