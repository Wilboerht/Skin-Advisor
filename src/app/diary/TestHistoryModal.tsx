"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { X } from "lucide-react";
import { TestHistoryList } from "@/components/website/TestHistoryList";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

/**
 * TestHistoryModal — 全部测肤记录（分页列表，一行一条）
 * 入口在 /diary 测肤趋势卡标题行「全部记录」；容器/动效与 AccountModal 等全站模态框对齐。
 */
export function TestHistoryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            tabIndex={-1}
            className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            {/* 背景遮罩 */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* 弹窗主体：移动端底部升起，桌面端居中 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full sm:max-w-md max-h-[80dvh] bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="flex items-center justify-between px-6 md:px-8 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] sm:pt-6 pb-4 border-b border-brand-charcoal/[0.06] shrink-0">
                <h2
                  id="history-modal-title"
                  className="text-xl font-serif font-light text-brand-charcoal tracking-[0.08em]"
                >
                  测肤记录
                </h2>
                <button
                  onClick={onClose}
                  aria-label="关闭"
                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* 记录列表（可滚动） */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 md:px-6 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                <TestHistoryList />
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
