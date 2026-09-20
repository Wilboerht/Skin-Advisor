"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { skinTypes, routeOrder, type SkinTypeData } from "@/lib/result-content";
import { SkinTypesClient } from "@/components/website/SkinTypesClient";
import { SkinTypesMobileList } from "@/components/website/SkinTypesMobileList";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface SkinTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const orderedTypes = routeOrder
  .map((route) => skinTypes.find((t) => t.route === route))
  .filter((t): t is SkinTypeData => Boolean(t));

/**
 * SkinTypesModal — 肌智派类型总览弹窗（替代原 /skin-types 独立页）
 * 容器/动效/关闭按钮与 SkinTypeModal、GiftModal、FaqModal 对齐；
 * 内容仅保留：标题 + 测肤 CTA + 派系轮播（移动端为图鉴网格）
 */
export function SkinTypesModal({ isOpen, onClose }: SkinTypesModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 遮罩防误触：打开后 350ms 内忽略遮罩点击关闭（与站内弹层规范一致）
  const openSinceRef = useRef(0);
  useEffect(() => {
    if (isOpen) openSinceRef.current = Date.now();
  }, [isOpen]);

  const handleBackdropClick = () => {
    if (Date.now() - openSinceRef.current < 350) return;
    onClose();
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skin-types-modal-title"
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

            {/* 弹窗主体：移动端底部升起，桌面端与护肤档案弹层同规格 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full h-[85dvh] sm:h-[min(680px,calc(100dvh-3rem))] sm:max-w-[1100px] bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[2.5rem] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮：移动端加大触摸区域并避开刘海 */}
              <button
                onClick={onClose}
                aria-label="关闭"
                className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.04] transition-colors"
              >
                <X size={17} strokeWidth={1.5} />
              </button>

              {/* 可滚动内容区 */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] sm:pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
                {/* 头部：标题 + 测肤 CTA */}
                <div className="text-center mb-5 md:mb-7">
                  <h2
                    id="skin-types-modal-title"
                    className="text-xl md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em]"
                  >
                    肌智派<sup className="text-[0.55em] align-super font-sans">™</sup>形象与护理方案
                  </h2>
                  <Link
                    href="/?start=1"
                    onClick={onClose}
                    className="group mt-4 md:mt-5 inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full border border-[#00263E]/40 bg-transparent text-[#00263E] text-sm font-medium transition-colors duration-200 hover:border-[#00263E] hover:bg-[#00263E]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/30 focus-visible:ring-offset-2"
                  >
                    <span>测一测，了解我的肤质类型</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                </div>

                {/* 派系轮播：移动端为图鉴网格，桌面端为 Cover Flow */}
                <div className="md:hidden">
                  <SkinTypesMobileList types={orderedTypes} />
                </div>
                <div className="hidden md:block">
                  <SkinTypesClient types={orderedTypes} />
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
