"use client";

import { useEffect, useState, useCallback } from "react";
import { m, AnimatePresence } from "framer-motion";
import { X, UserCheck, TrendingUp, Bell, Gift } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useAuth } from "@/hooks/useAuth";

interface RegisterConversionModalProps {
  /** 结果页滚动容器 ref（用于监听滚动深度） */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

const SESSION_KEY = "advisor_register_modal_shown";
const SCROLL_THRESHOLD = 0.6; // 滚动超过 60%
const TIME_THRESHOLD = 30_000; // 停留超过 30s

/**
 * 注册转化弹窗
 *
 * 游客浏览结果页达到一定深度或时长后弹出，引导注册解锁完整功能。
 * 每个 session 仅触发一次（sessionStorage 标记）。
 */
export function RegisterConversionModal({ scrollContainerRef }: RegisterConversionModalProps) {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [show, setShow] = useState(false);

  // 检查是否已触发过
  const alreadyShown = useCallback(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      return false;
    }
  }, []);

  const markShown = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // 已登录用户不弹
    if (user) return;
    // 已触发过不弹
    if (alreadyShown()) return;

    let triggered = false;

    const trigger = () => {
      if (triggered) return;
      triggered = true;
      setShow(true);
      markShown();
    };

    // 方案 1：滚动深度检测
    const checkScroll = () => {
      if (triggered) return;
      const el = scrollContainerRef?.current ?? document.documentElement;
      const scrollTop = el.scrollTop || window.scrollY;
      const scrollHeight = el.scrollHeight || document.documentElement.scrollHeight;
      const clientHeight = el.clientHeight || window.innerHeight;

      if (scrollHeight <= clientHeight) return; // 内容不足一屏

      const ratio = (scrollTop + clientHeight) / scrollHeight;
      if (ratio >= SCROLL_THRESHOLD) {
        trigger();
      }
    };

    // 方案 2：停留时长检测（兜底，内容短于一屏时触发）
    const timeTimer = setTimeout(() => {
      if (!triggered) {
        trigger();
      }
    }, TIME_THRESHOLD);

    // 监听滚动
    const target = scrollContainerRef?.current ?? window;
    target.addEventListener("scroll", checkScroll, { passive: true });
    // 立即检查一次（页面可能已加载到深滚动位置）
    checkScroll();

    return () => {
      target.removeEventListener("scroll", checkScroll);
      clearTimeout(timeTimer);
    };
  }, [user, alreadyShown, markShown, scrollContainerRef]);

  const handleRegister = () => {
    setShow(false);
    openAuthModal("register");
  };

  const handleClose = () => {
    setShow(false);
  };

  const benefits = [
    {
      icon: UserCheck,
      title: "完整护肤档案",
      desc: "保存每次测肤报告，建立专属肌肤数据库",
    },
    {
      icon: TrendingUp,
      title: "历史趋势追踪",
      desc: "对比不同时期数据，直观看到你的肌肤改善",
    },
    {
      icon: Bell,
      title: "季节智能提醒",
      desc: "根据季节变化和你的肤质，推送精准护肤提醒",
    },
    {
      icon: Gift,
      title: "会员专属礼遇",
      desc: "参与肌智派抽奖活动，赢取精选护肤好礼",
    },
  ];

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <m.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-[420px] max-h-[85vh] overflow-y-auto bg-[#FDFBF7] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#3D4430]/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-[#8B7355] hover:bg-[#F0EBE3] transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-[18px] font-serif text-[#1A1A1A] mb-2">
                  注册解锁完整体验
                </h3>
                <p className="text-[13px] text-[#5E5E5E] leading-relaxed">
                  注册成为旎柏会员，解锁以下专属功能
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {benefits.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F2ED]/60 border border-[#E8E2D9]/50"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-[#8B7355]/10 flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-[#8B7355]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#3D4430] mb-0.5">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#8A8A8A] leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={handleRegister}
                className="w-full py-3 rounded-full bg-[#5c4937] text-white text-[14px] font-medium tracking-wide hover:bg-[#4a3a2c] transition-colors active:scale-[0.99]"
              >
                立即注册
              </button>

              <p className="text-center text-[11px] text-[#8A8A8A] mt-3 leading-relaxed">
                已有账号？
                <button
                  onClick={() => {
                    setShow(false);
                    openAuthModal("login");
                  }}
                  className="ml-1 text-[#8B7355] underline underline-offset-2 hover:text-[#5c4937] transition-colors font-medium"
                >
                  立即登录
                </button>
              </p>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
