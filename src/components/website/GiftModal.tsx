"use client";

import Image from "next/image";
import Link from "next/link";
import { m, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

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

  const steps = [
    { title: "完成测肤或护肤习惯问卷", desc: "获取您的肌智派测肤结果及所属派系形象海报" },
    { title: "分享小红书", desc: "发布海报并 @NIHPLOD" },
    { title: "赢取好礼", desc: "参与活动即有机会获得 NIHPLOD 精选护肤好礼" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gift-modal-title"
        >
          {/* 背景遮罩 */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* 弹窗主体 */}
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg max-h-[85dvh] bg-[#FDFBF7] rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-5 right-5 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* 可滚动内容区 */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-6 md:px-8 pt-10 pb-8">
              <h2
                id="gift-modal-title"
                className="text-2xl font-serif font-light text-brand-charcoal text-center tracking-[0.08em] mb-8"
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
                        <span className="shrink-0 w-8 h-8 rounded-full bg-transparent border border-brand-charcoal/60 flex items-center justify-center text-sm font-medium text-brand-charcoal">
                          {i + 1}
                        </span>
                        {i < steps.length - 1 && <div className="w-px flex-1 bg-brand-charcoal/15 my-2" />}
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
                    className="w-full group relative inline-flex items-center justify-center gap-3 px-8 py-4 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] focus-visible:outline-none focus-visible:border-brand-charcoal focus-visible:bg-brand-charcoal/[0.05] active:translate-y-0 active:shadow-none"
                  >
                    <span>前往测试，看看你的肌肤形象</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="w-full group relative inline-flex items-center justify-center gap-3 px-8 py-4 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] focus-visible:outline-none focus-visible:border-brand-charcoal focus-visible:bg-brand-charcoal/[0.05] active:translate-y-0 active:shadow-none"
                  >
                    <span>前往测试，看看你的肌肤形象</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                  </Link>
                )}
                <Link
                  href="/skin-types"
                  onClick={onClose}
                  className="w-full group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer text-brand-charcoal/60 transition-colors duration-500 hover:text-brand-charcoal focus-visible:outline-none focus-visible:text-brand-charcoal"
                >
                  <span>查看全部肌智派类型</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
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
  );
}
