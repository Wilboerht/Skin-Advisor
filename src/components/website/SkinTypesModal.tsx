"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
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
  /** 分析等待期复用时置 true：隐藏"测一测"/"开始测肤"站内跳转 CTA，
   *  避免把用户导离进行中的分析流程（/?start=1 会重启测肤引导） */
  hideTestCTA?: boolean;
}

const orderedTypes = routeOrder
  .map((route) => skinTypes.find((t) => t.route === route))
  .filter((t): t is SkinTypeData => Boolean(t));

/**
 * SkinTypesModal — 肌智派类型总览弹窗（替代原 /skin-types 独立页）
 * 容器/动效/关闭按钮与 SkinTypeModal、GiftModal、FaqModal 对齐；
 * 内容仅保留：标题 + 测肤 CTA + 派系总览（移动端为单列横排卡列表，桌面端为 Cover Flow 轮播）；
 * 移动端 CTA 为抽屉底部吸附条（≥768px 回到标题下方文本框内，避免与轮播抢横向空间）
 */
export function SkinTypesModal({ isOpen, onClose, hideTestCTA = false }: SkinTypesModalProps) {
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

            {/* 弹窗主体：移动端底部升起；桌面端高度贴合内容（不再固定 680，避免轮播下方留大片空白），
                超过视口时用 max-h + 内部滚动兜底 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full h-[85dvh] sm:h-auto sm:max-h-[min(680px,calc(100dvh-3rem))] sm:max-w-[1100px] bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[2.5rem] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
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

              {/* 可滚动内容区（移动端底部另有吸附底栏：CTA + 版权，滚动区底部留 24px 与之间隔） */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] sm:pt-8 pb-6 sm:pb-8">
                {/* 头部：肌智派徽标 + 标题（测肤 CTA 移动端移到底部吸附条，桌面端仍在标题下） */}
                <div className="text-center mb-5 md:mb-6">
                  <div className="mb-3 md:mb-4 flex justify-center">
                    <Image
                      src="/images/jzp-eyebrow.png"
                      alt="肌智派"
                      width={256}
                      height={156}
                      className="h-12 md:h-14 w-auto object-contain"
                    />
                  </div>
                  <h2
                    id="skin-types-modal-title"
                    className="text-xl md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em]"
                  >
                    肌智派<sup className="text-[0.55em] align-super font-sans">™</sup>形象与护理方案
                  </h2>
                  {!hideTestCTA && (
                    <Link
                      href="/?start=1"
                      onClick={onClose}
                      className="group mt-4 md:mt-5 hidden md:inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full border border-[#00263E]/40 bg-transparent text-[#00263E] text-sm font-medium transition-colors duration-200 hover:border-[#00263E] hover:bg-[#00263E]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/30 focus-visible:ring-offset-2"
                    >
                      <span>测一测，了解我的肤质类型</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </Link>
                  )}
                </div>

                {/* 派系总览：移动端为单列横排卡列表，桌面端为 Cover Flow 轮播 */}
                <div className="md:hidden">
                  <SkinTypesMobileList types={orderedTypes} hideTestCTA={hideTestCTA} />
                </div>
                <div className="hidden md:block">
                  <SkinTypesClient types={orderedTypes} hideTestCTA={hideTestCTA} />
                </div>

                {/* 桌面端版权：内容末尾居中（移动端版权在底部吸附栏内，始终可见） */}
                <p
                  suppressHydrationWarning
                  className="hidden md:block mt-6 text-center text-[11px] font-light tracking-[0.12em] text-brand-charcoal/50 select-none"
                >
                  &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                </p>
              </div>

              {/* 移动端吸附底栏：固定在抽屉底部（安全区之上）——CTA（分析等待期复用时隐藏）+ 版权（始终显示）；
                  与滚动区分离，不随内容滚走 */}
              <div className="md:hidden shrink-0 border-t border-black/[0.06] px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                {!hideTestCTA && (
                  <Link
                    href="/?start=1"
                    onClick={onClose}
                    className="group flex w-full items-center justify-center gap-2 h-12 rounded-full bg-[var(--color-brand-cocoa)] text-white text-sm font-medium tracking-[0.02em] transition-colors duration-200 hover:bg-[#4a3a2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/30 focus-visible:ring-offset-2"
                  >
                    <span>测一测，了解我的肤质类型</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                )}
                {/* 版权：窄屏用简写（与首页页脚一致），年份跨年瞬间 SSR/CSR 会不一致，抑制 hydration 告警 */}
                <p
                  suppressHydrationWarning
                  className={`text-center text-[10px] font-light tracking-[0.12em] text-brand-charcoal/50 select-none ${hideTestCTA ? "" : "mt-2"}`}
                >
                  &copy; {new Date().getFullYear()} NIHPLOD
                </p>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
