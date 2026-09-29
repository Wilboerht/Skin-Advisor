"use client";

import Image from "next/image";
import Link from "next/link";
import { createElement, useEffect, useRef } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ArrowRight, MoonStar, Sunrise, X } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { getFactionAccent, getFactionIcon, getFactionPortraitSpot } from "@/components/website/faction-icons";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface SkinTypeModalProps {
  /** null 表示关闭 */
  data: SkinTypeData | null;
  onClose: () => void;
  /** 分析等待期复用时置 true：隐藏"开始测肤"CTA，避免把用户导离进行中的分析流程 */
  hideTestCTA?: boolean;
}

/**
 * SkinTypeModal — 肌智派类型详情弹窗（替代原 /skin-types/[type] 独立页）
 * 容器/动效/关闭按钮与 GiftModal、FaqModal 对齐；
 * 内容保留：形象与简介、优势高光、护肤日常、护肤公式（不含成分产品表）
 * 纵向节奏规范：板块间距 32、板块标题下 16、列表行 16（py-4）、「标题→正文」8、正文行高 1.8
 */
export function SkinTypeModal({ data, onClose, hideTestCTA = false }: SkinTypeModalProps) {
  const isOpen = data !== null;
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 遮罩防误触：记录打开时刻，打开后 350ms 内忽略遮罩点击关闭——
  // 入口双击的第二下会穿透到遮罩上，若不设保护会"打开即被关闭"
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
      {data && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="skin-type-modal-title"
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

          {/* 弹窗主体：移动端底部升起（与全站模态框一致），桌面端与护肤档案弹层同规格（1100 宽 / min(680, dvh-3rem) 高） */}
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full h-[85dvh] sm:h-[min(680px,calc(100dvh-3rem))] sm:max-w-[1100px] bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[2.5rem] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 背景纹理：80% 透明度（opacity-20）的丝绸质感图，铺在底色之上、内容之下 */}
            <Image
              src="/images/silk-texture.png"
              alt=""
              fill
              sizes="(min-width: 640px) 1100px, 100vw"
              aria-hidden="true"
              className="pointer-events-none select-none object-cover opacity-20"
            />
            {/* 关闭按钮：移动端加大触摸区域并避开刘海 */}
            <button
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.04] transition-colors"
            >
              <X size={17} strokeWidth={1.5} />
            </button>

            {/* 可滚动内容区：内容铺满弹层宽度（与护肤档案双列同宽的容器）；relative z-10 保持在背景纹理之上 */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] sm:pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
              {/* 头部：形象（衬派系主色圆形底） + 类型名 + 简介 */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="relative mb-4 flex items-center justify-center">
                  {/* 圆形背景：派系主色淡化，圆心与直径对齐人物像素的实际重心（画布内人物并不居中） */}
                  <span
                    aria-hidden="true"
                    className="absolute rounded-full opacity-30 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      backgroundColor: getFactionAccent(data.ipKey),
                      left: `${getFactionPortraitSpot(data.ipKey).x}%`,
                      top: `${getFactionPortraitSpot(data.ipKey).y}%`,
                      // 形象框固定 3:4（宽 = 高 × 0.75），宽高都显式给百分比，避免依赖 aspect-ratio 推算出椭圆
                      height: `${getFactionPortraitSpot(data.ipKey).d}%`,
                      width: `${(getFactionPortraitSpot(data.ipKey).d * 4) / 3}%`,
                    }}
                  />
                  <Image
                    src={`/images/character/${data.ipKey}/${data.ipKey}_female.webp`}
                    alt={`${data.typeName} 形象`}
                    width={180}
                    height={240}
                    className="relative h-44 md:h-56 w-auto object-contain"
                  />
                </div>
                <h2
                  id="skin-type-modal-title"
                  className="text-2xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-3 inline-flex items-center justify-center gap-2"
                >
                  {createElement(getFactionIcon(data.ipKey), { className: "w-6 h-6 text-brand-charcoal/60 shrink-0", strokeWidth: 1.5 })}
                  {data.typeName}
                </h2>
                <p className="text-[13px] md:text-sm text-brand-charcoal/70 font-light leading-[1.8] tracking-[0.06em] max-w-3xl mx-auto">
                  {data.m1.intro || data.m1.persona}
                </p>
              </div>

              {/* 优势高光：白底圆角卡片，序号为灰底圆角方块徽章 */}
              {(data.m5?.advantages?.length ?? 0) > 0 && (
                <section className="mb-8">
                  <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-[#FCFAF4] p-6 md:p-8">
                    <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">
                      {data.m5?.title || "优势高光"}
                    </h3>
                    <div className="divide-y divide-brand-charcoal/[0.06]">
                      {data.m5!.advantages.map((adv, i) => (
                        <div key={i} className="flex gap-3.5 py-4">
                          <span className="shrink-0 w-9 h-9 rounded-xl bg-brand-charcoal/[0.05] flex items-center justify-center text-[13px] font-serif text-brand-charcoal/50 leading-none select-none">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <h4 className="pt-1.5 mb-2 text-[14px] md:text-[15px] font-medium text-brand-charcoal">{adv.title}</h4>
                            <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                              {adv.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* 护肤日常（晨/夜）：日出/月亮图标 + 文本，标题在卡片外；左右留白与卡片内边距一致，文字与卡片内文字左对齐 */}
              {(data.m4?.morning || data.m4?.night) && (
                <section className="mb-8 px-6 md:px-8">
                  <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4">
                    {data.m4?.title || "我们建议的护肤日常"}
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: "morning", content: data.m4?.morning, Icon: Sunrise },
                      { key: "night", content: data.m4?.night, Icon: MoonStar },
                    ].map((item) =>
                      item.content ? (
                        <div key={item.key} className="flex gap-3.5">
                          <item.Icon aria-hidden="true" strokeWidth={1.5} className="shrink-0 w-7 h-7 mt-0.5 text-brand-charcoal/70" />
                          <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                            {item.content}
                          </p>
                        </div>
                      ) : null
                    )}
                  </div>
                  {/* 节奏备注：与晨/夜图标左缘对齐，不缩进 */}
                  {data.m4?.note && (
                    <p className="mt-3 text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                      {data.m4.note}
                    </p>
                  )}
                </section>
              )}

              {/* 护肤公式：白底圆角卡片，序号为大号浅灰数字 */}
              {data.m7 && (
                <section className="mb-8">
                  <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-[#FCFAF4] p-6 md:p-8">
                    <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4">
                      {data.m7.title || `${data.typeName}的精准护肤公式`}
                    </h3>
                    {data.m7.formulaCore && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {data.m7.formulaCore.split(/\s*[·・]\s*/).filter(Boolean).map((keyword, i) => (
                          <span
                            key={i}
                            className="text-[11px] tracking-[0.12em] text-brand-charcoal/65 border border-brand-charcoal/12 rounded-full px-3 py-1 font-light"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="divide-y divide-brand-charcoal/[0.06]">
                      {(data.m7.suggestions ?? []).map((sug, i) => (
                        <div key={i} className="py-4">
                          <div className="flex items-baseline gap-3 mb-2">
                            <span className="text-xl font-serif font-light text-brand-charcoal/20 leading-none select-none">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <h4 className="text-[14px] md:text-[15px] font-medium text-brand-charcoal">{sug.title}</h4>
                          </div>
                          <p className="pl-9 text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                            {sug.content}
                          </p>
                        </div>
                      ))}
                    </div>
                    {data.m7.onlyOneSet && (
                      <div className="mt-2 border-l-[3px] border-brand-charcoal/20 pl-4">
                        <span className="inline-block text-[11px] tracking-[0.15em] text-brand-charcoal/60 bg-brand-charcoal/[0.05] rounded-full px-3 py-1 mb-2">
                          参考护理组合
                        </span>
                        <p className="text-[13px] text-brand-charcoal/90 font-light leading-[1.8] tracking-[0.06em]">
                          {data.m7.onlyOneSet}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* CTA（分析等待期复用时隐藏，防止用户被导离进行中的分析） */}
              {!hideTestCTA && (
                <div className="flex justify-center">
                  <Link
                    href="/"
                    onClick={onClose}
                    className="group inline-flex items-center justify-center gap-2 h-11 px-8 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[13px] font-normal tracking-[0.08em] transition-colors duration-300 hover:bg-[#4a3a2c]"
                  >
                    <span>完成肌肤状态检测，查看你的专属肌肤派系</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                </div>
              )}
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
    </LazyMotion>
  );
}
