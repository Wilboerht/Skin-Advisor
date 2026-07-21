"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"

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

const maxWidthClasses = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "4xl": "max-w-4xl",
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
  const mounted = useMounted()
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, disabled])

  if (!mounted) return null

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
              maxWidthClasses[maxWidth]
            )}
          >
            <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
              <div>
                <h3 id={titleId} className="text-lg font-bold text-[#2C2C2C] tracking-tight">
                  {title}
                </h3>
                {subtitle && <p className="text-xs text-[#8B7355] mt-0.5">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={disabled}
                aria-label="关闭"
                className="p-2 rounded-full text-[#B0A89A] hover:text-[#C9A86C] hover:bg-white/60 transition-all disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 pb-8 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
