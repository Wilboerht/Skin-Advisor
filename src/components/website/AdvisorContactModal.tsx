"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { MessageCircleHeart, QrCode, Sparkles, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useModalBackClose } from "@/hooks/use-modal-back-close";
import { LoginGuide } from "@/components/website/LoginGuide";

interface AdvisorContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 银卡及以上可联系专属 AI 护肤顾问（历史值 ADVANCED 按金卡兜底，与后端 normalizeMembershipLevel 一致） */
const ADVISOR_MEMBER_LEVELS = new Set(["SILVER", "GOLD", "DIAMOND", "ADVANCED"]);

const LEVEL_LABELS: Record<string, string> = {
  REGULAR: "普通会员",
  SILVER: "银卡会员",
  GOLD: "金卡会员",
  DIAMOND: "钻石会员",
  ADVANCED: "金卡会员",
};

/** 二维码图片：放到 public/images/advisor-qr.png 即自动生效；缺图时展示占位框 */
const ADVISOR_QR_SRC = "/images/advisor-qr.png";

/**
 * AdvisorContactModal — 「联系专属 AI 护肤顾问」弹层（Dock「专属顾问」入口）。
 * 银卡及以上：展示企业微信二维码；普通会员：文案引导升级；未登录：登录引导。
 * 容器/动效/关闭按钮与 AccountModal/GiftModal 等全站模态框对齐。
 */
export function AdvisorContactModal({ isOpen, onClose }: AdvisorContactModalProps) {
  const { user } = useAuth();

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });
  // 移动端返回键/返回手势：先关弹层（再按返回才离开页面）
  useModalBackClose(isOpen, onClose);

  // 遮罩防误触：打开后 350ms 内忽略遮罩点击关闭（入口双击第二下会落在遮罩上）
  const openSinceRef = useRef(0);
  useEffect(() => {
    if (isOpen) openSinceRef.current = Date.now();
  }, [isOpen]);

  const handleBackdropClick = () => {
    if (Date.now() - openSinceRef.current < 350) return;
    onClose();
  };

  // Portal 到 body：避免受 Dock 的 pointer-events/层叠样式影响
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 二维码加载失败（素材未就位）时降级为占位框；每次打开重试，素材补齐后无需改代码
  const [qrFailed, setQrFailed] = useState(false);
  useEffect(() => {
    if (isOpen) setQrFailed(false);
  }, [isOpen]);

  const hasAccess = !!user && ADVISOR_MEMBER_LEVELS.has(user.membershipLevel ?? "");

  if (!mounted) return null;

  return createPortal(
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="advisor-modal-title"
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

            {/* 弹窗主体：移动端底部升起，桌面端居中 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-h-[85dvh] sm:max-h-none sm:max-w-sm bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                aria-label="关闭"
                className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>

              <div className="max-h-[85dvh] sm:max-h-none overflow-y-auto overscroll-y-contain no-scrollbar px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8 flex flex-col items-center">
                <h2 id="advisor-modal-title" className="sr-only">
                  联系专属 AI 护肤顾问
                </h2>

                {!user ? (
                  <LoginGuide onNavigateLogin={onClose} />
                ) : hasAccess ? (
                  /* 银卡及以上：展示专属顾问二维码 */
                  <div className="w-full flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-brand-charcoal/[0.04] flex items-center justify-center mb-4">
                      <MessageCircleHeart className="w-6 h-6 text-brand-charcoal/65" strokeWidth={1.4} />
                    </div>
                    <h3 className="text-xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-2">
                      联系专属 AI 护肤顾问
                    </h3>
                    <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] mb-6">
                      微信扫码添加您的专属顾问
                      <br />
                      获取报告深度解读与一对一护理建议
                    </p>

                    <div className="w-full max-w-[240px] rounded-2xl border border-brand-charcoal/[0.08] bg-white p-3">
                      {qrFailed ? (
                        <div className="aspect-square w-full rounded-xl border border-dashed border-brand-charcoal/20 bg-brand-charcoal/[0.02] flex flex-col items-center justify-center text-brand-charcoal/45">
                          <QrCode className="w-10 h-10 mb-2" strokeWidth={1.25} />
                          <p className="text-[12px] font-light tracking-[0.04em]">二维码占位</p>
                          <p className="mt-1 text-[10px] font-light text-brand-charcoal/35 tracking-[0.02em]">
                            public/images/advisor-qr.png
                          </p>
                        </div>
                      ) : (
                        <Image
                          src={ADVISOR_QR_SRC}
                          alt="专属 AI 护肤顾问二维码"
                          width={240}
                          height={240}
                          unoptimized
                          className="w-full h-auto rounded-xl"
                          onError={() => setQrFailed(true)}
                        />
                      )}
                      <p className="mt-3 mb-1 text-center text-[12px] text-brand-charcoal/60 font-light tracking-[0.05em]">
                        微信扫码添加
                      </p>
                    </div>

                    <p className="mt-5 text-[11px] text-brand-charcoal/45 font-light leading-relaxed tracking-[0.04em]">
                      添加后可发送测肤报告截图，顾问将结合档案为您解读
                    </p>
                  </div>
                ) : (
                  /* 普通会员：文案引导升级（不跳转） */
                  <div className="w-full flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-brand-charcoal/[0.04] flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6 text-brand-charcoal/65" strokeWidth={1.4} />
                    </div>
                    <h3 className="text-xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-2">
                      专属 AI 护肤顾问
                    </h3>
                    <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] mb-5">
                      银卡及以上会员可添加专属 AI 护肤顾问
                      <br />
                      获得报告解读、护理方案与产品搭配的一对一建议
                    </p>

                    <span className="inline-flex h-[26px] px-3 items-center rounded-full border border-brand-charcoal/[0.12] bg-transparent text-[11px] font-light text-brand-charcoal/55 tracking-[0.04em] mb-5">
                      当前等级 · {LEVEL_LABELS[user.membershipLevel ?? ""] || "普通会员"}
                    </span>

                    <div className="w-full rounded-2xl border border-[var(--color-brand-cocoa)]/20 bg-[var(--color-brand-cocoa)]/[0.04] px-5 py-4">
                      <p className="text-[13px] text-[var(--color-brand-cocoa)] font-light tracking-[0.06em] leading-relaxed">
                        升级银卡及以上会员即可解锁
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body
  );
}
