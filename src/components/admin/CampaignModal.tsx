"use client"

import { type ReactNode } from "react"
import { AdminModal, type AdminModalMaxWidth } from "@/components/ui/AdminModal"

interface CampaignModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  maxWidth?: "md" | "lg" | "xl" | "4xl"
  disabled?: boolean
  titleId?: string
}

const maxWidthMap: Record<string, AdminModalMaxWidth> = {
  md: "md",
  lg: "lg",
  xl: "xl",
  "4xl": "4xl",
}

export function CampaignModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "lg",
  disabled = false,
  titleId = "campaign-modal-title",
}: CampaignModalProps) {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      titleId={titleId}
      subtitle={subtitle}
      maxWidth={maxWidthMap[maxWidth]}
      disabled={disabled}
    >
      {children}
    </AdminModal>
  )
}
