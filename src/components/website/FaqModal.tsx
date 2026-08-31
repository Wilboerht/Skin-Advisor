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
 * 内容与 /faq 静态页共用 src/lib/faq-data.ts，手风琴样式与静态页一致
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
          className="fixed inset-0 z-[var(--z-modal)] flex items-end md:items-center justify-center"
        >
          {/* 背景遮罩 */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#1A1A1A]/30 backdrop-blur-sm"
          />

          {/* 面板：移动端底部升起，桌面端居中 */}
          <m.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full md:max-w-2xl max-h-[85dvh] bg-[#FDFBF7] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col motion-reduce:transition-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 md:px-8 pt-6 md:pt-7 pb-4 border-b border-brand-charcoal/[0.06] shrink-0">
              <div>
                <p className="text-[10px] tracking-[0.25em] text-[#8B7355] uppercase mb-1">
                  Frequently Asked Questions
                </p>
                <h2 id="faq-modal-title" className="text-lg md:text-xl font-serif text-brand-charcoal">
                  常见问题
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="关闭"
                className="w-10 h-10 flex items-center justify-center rounded-full text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-charcoal/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FAQ 列表（可滚动） */}
            <div className="overflow-y-auto overscroll-contain px-6 md:px-8 py-2 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
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
