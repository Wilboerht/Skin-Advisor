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
  /** 点击"前往测试"：关闭弹窗并触发首页测肤流程；未提供时退化为跳首页的链接 */
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
    { title: "在社交平台分享您的肌智派形象海报", desc: "发布海报并 @NIHPLOD" },
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
            className="relative z-10 w-full max-h-[85dvh] sm:max-h-none sm:max-w-lg sm:h-auto bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
              <h2
                id="gift-modal-title"
                className="text-xl font-serif font-light text-brand-charcoal text-center tracking-[0.08em] mb-6"
              >
                肌智派送好礼
              </h2>

              {/* 玩法步骤 */}
              <div className="flex flex-col items-center mb-8">
                <Image
                  src="/images/gift-badge.png"
                  alt="肌智派送好礼"
                  width={200}
                  height={150}
                  className="w-52 h-auto object-contain mb-8"
                  unoptimized
                />
                <div className="w-full max-w-sm">
                  {steps.map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex flex-col items-center self-stretch">
                        <span className="shrink-0 w-8 h-8 rounded-full bg-transparent border border-brand-charcoal/[0.25] flex items-center justify-center text-sm font-light text-brand-charcoal/70">
                          {i + 1}
                        </span>
                        {i < steps.length - 1 && <div className="w-px flex-1 bg-brand-charcoal/10 my-2" />}
                      </div>
                      <div className={`flex-1 text-left ${i < steps.length - 1 ? "pb-6" : ""}`}>
                        <h3 className="text-sm font-light text-brand-charcoal tracking-[0.06em] mb-1">{item.title}</h3>
                        <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto mb-6">
                {onStartTest ? (
                  <button
                    onClick={onStartTest}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full border border-[#00263E]/40 bg-transparent text-[#00263E] text-sm font-medium transition-colors duration-200 hover:border-[#00263E] hover:bg-[#00263E]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/30 focus-visible:ring-offset-2 cursor-pointer"
                  >
                    <span>开始测肤</span>
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full border border-[#00263E]/40 bg-transparent text-[#00263E] text-sm font-medium transition-colors duration-200 hover:border-[#00263E] hover:bg-[#00263E]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/30 focus-visible:ring-offset-2"
                  >
                    <span>前往测试，看看你的肌肤形象</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                )}
                <Link
                  href="/skin-types"
                  onClick={onClose}
                  className="w-full inline-flex items-center justify-center gap-3 h-11 text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer text-brand-charcoal/60 transition-colors duration-300 hover:text-brand-charcoal focus-visible:outline-none focus-visible:text-brand-charcoal"
                >
                  <span>查看全部肌智派类型</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </div>

              {/* 官方声明 */}
              <p className="text-center text-[11px] leading-relaxed text-brand-charcoal/40 font-light tracking-[0.06em]">
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
