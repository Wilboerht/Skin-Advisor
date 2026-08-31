"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface SkinTypeModalProps {
  /** null 表示关闭 */
  data: SkinTypeData | null;
  onClose: () => void;
}

/**
 * SkinTypeModal — 肌智派类型详情弹窗（替代原 /skin-types/[type] 独立页）
 * 容器/动效/关闭按钮与 GiftModal、FaqModal 对齐；
 * 内容保留：形象与简介、优势高光、护肤日常、护肤公式（不含成分产品表）
 */
export function SkinTypeModal({ data, onClose }: SkinTypeModalProps) {
  const isOpen = data !== null;
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  return (
    <LazyMotion features={domAnimation}>
    <AnimatePresence>
      {data && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="skin-type-modal-title"
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
            className="relative z-10 w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[85dvh] bg-[#FDFBF7] rounded-none sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
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

            {/* 可滚动内容区 */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] sm:pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
              {/* 头部：形象 + 类型名 + 简介 */}
              <div className="flex flex-col items-center text-center mb-8">
                <Image
                  src={`/images/character/${data.ipKey}/${data.ipKey}_female.webp`}
                  alt={`${data.typeName} 形象`}
                  width={180}
                  height={280}
                  className="h-36 md:h-44 w-auto object-contain mb-4"
                />
                <h2
                  id="skin-type-modal-title"
                  className="text-2xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-3"
                >
                  {data.typeName}
                </h2>
                <p className="text-[13px] md:text-sm text-brand-charcoal/70 font-light leading-[1.8] tracking-[0.06em] max-w-md">
                  {data.m1.persona}
                </p>
              </div>

              {/* 优势高光 */}
              {(data.m5?.advantages?.length ?? 0) > 0 && (
                <section className="mb-8">
                  <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4">
                    {data.m5?.title || "优势高光"}
                  </h3>
                  <div className="divide-y divide-brand-charcoal/[0.06]">
                    {data.m5!.advantages.map((adv, i) => (
                      <div key={i} className="py-3.5">
                        <div className="flex items-baseline gap-3 mb-1.5">
                          <span className="text-lg font-serif font-light text-brand-charcoal/20 leading-none select-none">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <h4 className="text-[14px] md:text-[15px] font-medium text-brand-charcoal">{adv.title}</h4>
                        </div>
                        <p className="pl-8 text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                          {adv.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 护肤日常（晨/夜） */}
              {(data.m4?.morning || data.m4?.night) && (
                <section className="mb-8">
                  <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4">
                    {data.m4?.title || "我们建议的护肤日常"}
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: "晨", content: data.m4?.morning },
                      { label: "夜", content: data.m4?.night },
                    ].map((item) =>
                      item.content ? (
                        <div key={item.label} className="flex gap-3">
                          <span className="shrink-0 w-8 h-8 rounded-full border border-brand-charcoal/15 flex items-center justify-center text-[13px] font-serif text-brand-charcoal/60 select-none">
                            {item.label}
                          </span>
                          <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] pt-1">
                            {item.content}
                          </p>
                        </div>
                      ) : null
                    )}
                  </div>
                </section>
              )}

              {/* 护肤公式 */}
              {data.m7 && (
                <section className="mb-8">
                  <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4">
                    {data.m7.title || `${data.typeName}的精准护肤公式`}
                  </h3>
                  {data.m7.formulaCore && (
                    <div className="flex flex-wrap gap-2 mb-5">
                      {data.m7.formulaCore.split(/\s*[·・]\s*/).filter(Boolean).map((keyword, i) => (
                        <span
                          key={i}
                          className="text-[11px] tracking-[0.12em] text-brand-charcoal/50 border border-brand-charcoal/12 rounded-full px-3 py-1 font-light"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="divide-y divide-brand-charcoal/[0.06]">
                    {(data.m7.suggestions ?? []).map((sug, i) => (
                      <div key={i} className="py-3.5">
                        <div className="flex items-baseline gap-3 mb-1.5">
                          <span className="text-lg font-serif font-light text-brand-charcoal/20 leading-none select-none">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <h4 className="text-[14px] md:text-[15px] font-medium text-brand-charcoal">{sug.title}</h4>
                        </div>
                        <p className="pl-8 text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                          {sug.content}
                        </p>
                      </div>
                    ))}
                  </div>
                  {data.m7.onlyOneSet && (
                    <div className="mt-5 border-l-[3px] border-brand-charcoal/20 pl-4">
                      <span className="inline-block text-[11px] tracking-[0.15em] text-brand-charcoal/60 bg-brand-charcoal/[0.05] rounded-full px-3 py-1 mb-2">
                        极简之选
                      </span>
                      <p className="text-[13px] text-brand-charcoal/90 font-light leading-[1.8] tracking-[0.06em]">
                        {data.m7.onlyOneSet}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* CTA */}
              <div className="flex justify-center">
                <Link
                  href="/"
                  onClick={onClose}
                  className="group inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full bg-brand-charcoal text-white text-[13px] tracking-[0.12em] font-light transition-all duration-300 hover:opacity-90"
                >
                  <span>开始测肤，解锁你的专属形象</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
    </LazyMotion>
  );
}
