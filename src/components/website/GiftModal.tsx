"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { m, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 点击"开始测肤"：关闭弹窗并触发首页测肤流程；未提供时退化为跳首页的链接 */
  onStartTest?: () => void;
}

/**
 * 测肤有礼活动弹窗（替代原独立 /gift 页面）。
 *
 * 轻量静态版：不拉取活动数据，仅展示固定玩法说明，
 * 具体活动以官方媒体发布的实际内容为准。
 * /gift 旧链接已 308 重定向到 /?gift=1，由首页检测参数后打开本弹窗。
 */
export function GiftModal({ isOpen, onClose, onStartTest }: GiftModalProps) {
  // 打开弹窗时锁定背景滚动（首页自身也有一把 iosSafe 锁，引用计数保证嵌套安全）
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });
  // 焦点圈定 + Escape 关闭
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

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

  const steps = [
    { title: "登录完成测肤", desc: "获取您的肌智派测肤结果及所属派系形象海报" },
    {
      title: "分享肌智派形象海报",
      desc: (
        <>
          发布海报并 <span className="text-brand-charcoal/80">@NIHPLOD</span>
        </>
      ),
    },
    { title: "赢取好礼", desc: "参与活动即可获得抽奖机会" },
  ];

  return (
    <LazyMotion features={domAnimation}>
    <AnimatePresence>
      {isOpen && (
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gift-modal-title"
        >
          {/* 背景遮罩 */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* 弹窗主体：移动端底部升起（与用户面板一致），桌面端居中卡片 */}
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-h-[85dvh] sm:max-h-none sm:max-w-lg sm:h-auto bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[2.5rem] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* 关闭按钮：移动端加大触摸区域并避开刘海 */}
            <button
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* 可滚动内容区：移动端适配上下安全区 */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
              {/* 品牌 logo：标题上方居中 */}
              <div className="mb-3 flex justify-center">
                <Image
                  src="/NIHPLOD-logo.svg"
                  alt="NIHPLOD"
                  width={136}
                  height={34}
                  className="h-[34px] w-auto object-contain"
                />
              </div>
              <h2
                id="gift-modal-title"
                className="text-xl font-serif font-light text-brand-charcoal text-center tracking-[0.08em] mb-5"
              >
                肌智派送好礼
              </h2>

              {/* 礼物盒插画：素材自带透明底，四周留白已裁掉（1195×1002）；
                  底下垫柔和品牌金光晕 + 白芯，增加温度与悬浮感 */}
              <div className="relative mb-6 sm:mb-7 flex justify-center">
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-36 sm:h-28 sm:w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold/15 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-24 sm:h-16 sm:w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-2xl"
                />
                <Image
                  src="/images/gift-package.webp"
                  alt=""
                  aria-hidden="true"
                  width={1195}
                  height={1002}
                  className="relative h-20 sm:h-24 w-auto object-contain"
                />
              </div>

              {/* 玩法步骤 */}
              <div className="w-full max-w-sm mx-auto mb-7">
                {steps.map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center self-stretch">
                      <span className="shrink-0 w-8 h-8 rounded-full bg-brand-charcoal/[0.08] flex items-center justify-center text-sm font-medium tabular-nums text-brand-charcoal">
                        {i + 1}
                      </span>
                      {i < steps.length - 1 && <div className="flex-1 my-2 border-l border-dashed border-brand-charcoal/20" />}
                    </div>
                    {/* 文字列 mt-1 让标题行与 32px 序号圆心视觉对齐；标题行高 1.6、正文 1.8，中文阅读更稳 */}
                    <div className={`flex-1 text-left mt-1 ${i < steps.length - 1 ? "pb-6" : ""}`}>
                      <h3 className="text-[15px] leading-[1.6] font-medium text-brand-charcoal tracking-[0.06em] mb-1.5">{item.title}</h3>
                      <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA：实心主按钮（唯一行动点，视觉最重） */}
              <div className="w-full max-w-xs mx-auto mb-6">
                {onStartTest ? (
                  <button
                    type="button"
                    onClick={onStartTest}
                    className="group w-full inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full bg-brand-charcoal text-white text-sm font-medium shadow-[0_14px_30px_-14px_rgba(0,38,62,0.6)] transition-colors duration-200 hover:bg-[#0d3b5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2 cursor-pointer"
                  >
                    <span>开始测肤</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="group w-full inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full bg-brand-charcoal text-white text-sm font-medium shadow-[0_14px_30px_-14px_rgba(0,38,62,0.6)] transition-colors duration-200 hover:bg-[#0d3b5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2"
                  >
                    <span>开始测肤</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                )}
              </div>

              {/* 官方声明：脚注与小节间用细分割线区隔，行高 1.8 便于中文小字阅读 */}
              <p className="border-t border-brand-charcoal/[0.08] pt-4 text-center text-[11px] leading-[1.8] text-brand-charcoal/55 font-light tracking-[0.06em]">
                具体活动时间、奖品与规则以 NIHPLOD 官方媒体账号发布的实际活动内容为准
              </p>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
    </LazyMotion>
  );
}
