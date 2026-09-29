"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { m, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useFocusTrap } from "@/hooks/use-focus-trap";

/** 彩带配色：品牌金/可可/藏蓝 + 派系点缀色 */
const CONFETTI_COLORS = ["#C9A86C", "#5c4937", "#00263E", "#E4A6B5", "#A8C6DF", "#E0A75E"];

/** 确定性伪随机（渲染期不允许 Math.random）：按种子生成 0-1 的稳定散列 */
function seededRandom(seed: number): number {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 打开弹窗时的彩带雨：48 片品牌色纸屑从弹层顶部飘落，约 3-4s 内落完淡出。
 * 组件随弹窗挂载而 mount（AnimatePresence 内），每次打开自动重播一次。
 */
function GiftConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        x: seededRandom(i * 7 + 1) * 100,
        delay: seededRandom(i * 13 + 2) * 0.5,
        duration: 2.6 + seededRandom(i * 17 + 3) * 1.6,
        size: 5 + seededRandom(i * 23 + 5) * 5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: seededRandom(i * 29 + 7) * 360,
        spin: 240 + seededRandom(i * 31 + 11) * 360,
        drift: (seededRandom(i * 37 + 13) - 0.5) * 60,
        round: seededRandom(i * 41 + 17) > 0.6,
      })),
    []
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-t-[28px] sm:rounded-[2.5rem]">
      {pieces.map((p) => (
        <m.span
          key={p.id}
          initial={{ top: "-4%", x: 0, opacity: 0, rotate: p.rotate }}
          animate={{ top: "104%", x: p.drift, opacity: [0, 1, 1, 0.9, 0], rotate: p.rotate + p.spin }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.8,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : 1,
          }}
        />
      ))}
    </div>
  );
}

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
            {/* 打开时的彩带雨（一次性，随弹窗挂载自动播放） */}
            <GiftConfetti />

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
              <div className="mb-4 flex justify-center">
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
                className="text-xl font-serif font-light text-brand-charcoal text-center tracking-[0.08em] mb-6"
              >
                肌智派送好礼
              </h2>

              {/* 礼物盒插画：素材自带透明底，四周留白已裁掉（1195×1002）；
                  底下垫柔和品牌金光晕 + 白芯，增加温度与悬浮感 */}
              <div className="relative mb-8 flex justify-center">
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

              {/* 玩法步骤：浅色卡片分组（与派系详情弹窗卡片同规格），序号圆角徽章 + 细分割线 */}
              <div className="w-full max-w-sm mx-auto mb-8 rounded-3xl border border-brand-charcoal/[0.08] bg-[#FCFAF4] p-6">
                <div className="divide-y divide-brand-charcoal/[0.06]">
                  {steps.map((item, i) => (
                    <div key={i} className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
                      <span className="shrink-0 w-9 h-9 rounded-xl bg-brand-charcoal/[0.05] flex items-center justify-center text-[13px] font-serif text-brand-charcoal/50 leading-none select-none">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <h3 className="pt-1.5 mb-2 text-[14px] md:text-[15px] font-medium text-brand-charcoal tracking-[0.06em]">{item.title}</h3>
                        <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA：实心主按钮（唯一行动点，视觉最重），样式与派系详情弹窗一致 */}
              <div className="w-full max-w-xs mx-auto mb-6">
                {onStartTest ? (
                  <button
                    type="button"
                    onClick={onStartTest}
                    className="group w-full inline-flex items-center justify-center gap-2 px-8 h-11 rounded-full border border-[#00263E]/25 bg-[#00263E]/[0.08] backdrop-blur-md text-[#00263E] text-[13px] font-normal tracking-[0.08em] transition-colors duration-300 hover:bg-[#00263E]/[0.12] hover:border-[#00263E]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2 cursor-pointer"
                  >
                    <span>开始测肤</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="group w-full inline-flex items-center justify-center gap-2 px-8 h-11 rounded-full border border-[#00263E]/25 bg-[#00263E]/[0.08] backdrop-blur-md text-[#00263E] text-[13px] font-normal tracking-[0.08em] transition-colors duration-300 hover:bg-[#00263E]/[0.12] hover:border-[#00263E]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2"
                  >
                    <span>开始测肤</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                )}
              </div>

              {/* 官方声明：脚注与小节间用细分割线区隔，行高 1.8 便于中文小字阅读 */}
              <p className="border-t border-brand-charcoal/[0.08] pt-5 text-center text-[11px] leading-[1.8] text-brand-charcoal/55 font-light tracking-[0.06em]">
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
