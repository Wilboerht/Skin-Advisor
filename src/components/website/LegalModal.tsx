"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import type { LegalDoc } from "@/lib/legal-content";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: LegalDoc;
}

/**
 * LegalModal — 页脚「隐私政策 / 服务条款」弹出的简版法律文本模态框。
 * 内容为子项目简易版（src/lib/legal-content.ts），完整版链至官网；
 * 容器/动效/关闭按钮与 FaqModal 对齐
 */
export function LegalModal({ isOpen, onClose, doc }: LegalModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 遮罩防误触：打开后 350ms 内忽略遮罩点击关闭（与 FaqModal 一致）
  const openSinceRef = useRef(0);
  useEffect(() => {
    if (isOpen) openSinceRef.current = Date.now();
  }, [isOpen]);

  const handleBackdropClick = () => {
    if (Date.now() - openSinceRef.current < 350) return;
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
          tabIndex={-1}
          className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          {/* 背景遮罩 */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* 弹窗主体：移动端底部升起，桌面端居中卡片 */}
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full h-[85dvh] sm:h-[min(680px,calc(100dvh-3rem))] sm:max-w-lg bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* 可滚动内容区 */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
              <h2
                id="legal-modal-title"
                className="text-xl font-serif font-light text-brand-charcoal text-center tracking-[0.08em] mb-6"
              >
                {doc.title}
              </h2>

              <div className="space-y-5">
                {doc.sections.map((section) => (
                  <section key={section.heading}>
                    <h3 className="text-[14px] md:text-[15px] font-medium text-[#1A1A1A] mb-1.5">
                      {section.heading}
                    </h3>
                    {section.paragraphs.map((p, i) => (
                      <p
                        key={i}
                        className="text-[13px] md:text-[14px] text-[#5E5E5E] font-light leading-relaxed mt-1.5 first:mt-0"
                      >
                        {p}
                      </p>
                    ))}
                  </section>
                ))}
              </div>

              <p className="mt-8 pt-4 border-t border-brand-charcoal/[0.08] text-[12px] text-brand-charcoal/50 font-light leading-relaxed text-center">
                本简版仅供快速了解，完整版本请访问
                <a
                  href={doc.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2E4D9E] underline underline-offset-2 hover:text-[#23409a]"
                >
                  官网全文
                </a>
                。
              </p>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
