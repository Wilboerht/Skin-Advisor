"use client";

import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { faqs } from "@/lib/faq-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * FaqModal — 首页"常见问题"入口弹出的 FAQ 模态框
 * 内容与 /faq 静态页共用 src/lib/faq-data.ts，手风琴样式与静态页一致；
 * 容器/动效/关闭按钮与 GiftModal（肌智派送好礼）对齐
 */
export function FaqModal({ isOpen, onClose }: FaqModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="faq-modal-title"
          tabIndex={-1}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-0 sm:p-4"
        >
          {/* 背景遮罩 */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* 弹窗主体：移动端全屏，桌面端居中卡片 */}
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[85dvh] bg-[#FDFBF7] rounded-none sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮：移动端加大触摸区域并避开刘海 */}
            <button
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* 可滚动内容区：移动端适配上下安全区 */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
              <h2
                id="faq-modal-title"
                className="text-2xl font-serif font-light text-brand-charcoal text-center tracking-[0.08em] mb-8"
              >
                常见问题
              </h2>

              {/* FAQ 手风琴列表 */}
              <div className="divide-y divide-brand-charcoal/[0.08]">
                {faqs.map((faq, i) => (
                  <details key={i} className="group py-4 md:py-5 cursor-pointer">
                    <summary className="flex items-center justify-between gap-4 text-[14px] md:text-[15px] font-medium text-[#1A1A1A] list-none marker:content-none hover:text-brand-charcoal transition-colors">
                      <span>{faq.question}</span>
                      <span className="shrink-0 text-[#8B7355] text-lg leading-none group-open:rotate-45 transition-transform duration-300 motion-reduce:transition-none">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-[13px] md:text-[14px] text-[#5E5E5E] font-light leading-relaxed">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
