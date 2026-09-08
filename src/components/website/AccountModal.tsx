"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ChevronRight, CircleUserRound, LogOut, NotebookPen, Settings2, Smartphone, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useDiaryModal } from "@/components/website/DiaryModalContext";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function maskPhone(phone?: string | null) {
  if (!phone) return "—";
  if (phone.length <= 7) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

// 四档会员徽章：中文名 + 配色（历史值 ADVANCED 按金卡兜底，与后端 normalizeMembershipLevel 一致）
const MEMBER_BADGES: Record<string, { label: string; className: string }> = {
  SILVER: { label: "银卡会员", className: "border-slate-400/70 text-slate-500" },
  GOLD: { label: "金卡会员", className: "border-[#C9A86C]/70 text-[#8B7355]" },
  DIAMOND: { label: "钻石会员", className: "border-sky-400/70 text-sky-600" },
  ADVANCED: { label: "金卡会员", className: "border-[#C9A86C]/70 text-[#8B7355]" },
};
const REGULAR_BADGE = { label: "普通会员", className: "border-brand-charcoal/15 text-brand-charcoal/50" };

function getMemberBadge(level?: string | null) {
  return (level && MEMBER_BADGES[level]) || REGULAR_BADGE;
}

/** /api/advisor/test-limit 的 usage 字段（登录用户） */
interface TestUsage {
  totalUsed: number;
  todayUsed: number;
  lifetimeLimit: number | null;
  dailyLimit: number | null;
  unlimited: boolean;
}

/**
 * AccountModal — 「我的」账户弹层（替代原 /profile 独立页）
 * 已登录：头像、昵称、手机号（纯展示；资料编辑统一到 NIHPLOD 主站账号中心）、护肤档案入口、退出登录。
 * 未登录：登录引导视图，点击按钮走 SSO 统一登录。
 * 容器/动效/关闭按钮与 GiftModal 等全站模态框对齐；测肤记录在护肤档案弹层查看。
 */
export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { user, logout, login } = useAuth();
  const { openDiaryModal } = useDiaryModal();
  const toast = useToast();

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // Portal 到 body：fixed 定位在带 transform/backdrop-filter 的祖先（如结果页顶部栏的毛玻璃底）
  // 内会被重新相对该祖先定位，导致弹窗"挂"在顶部栏上而不是视口居中
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 测肤用量（登录用户打开弹层时拉取；接口失败静默不展示该行）
  const [testUsage, setTestUsage] = useState<TestUsage | null>(null);
  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    fetch("/api/advisor/test-limit")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.usage) setTestUsage(data.usage as TestUsage);
      })
      .catch(() => { /* 静默失败 */ });
    return () => { cancelled = true; };
  }, [isOpen, user]);

  const handleLogout = async () => {
    onClose();
    // logout 内部已完成整页跳转，无需再处理路由
    await logout();
  };

  const handleLogin = () => {
    // 整页跳转到账号中心，弱网下需数秒——先给出即时反馈，避免用户误以为没点上而连点
    toast.info("正在前往 NIHPLOD 账号中心…");
    login();
  };

  if (!mounted) return null;

  return createPortal(
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            tabIndex={-1}
            className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            {/* 背景遮罩 */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* 弹窗主体：移动端底部升起，桌面端居中 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full sm:max-w-sm bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                aria-label="关闭"
                className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>

              <div className="px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8 flex flex-col items-center">
                <h2 id="account-modal-title" className="sr-only">
                  我的账户
                </h2>

                {!user ? (
                  <>
                    {/* 未登录引导视图 */}
                    <CircleUserRound className="w-20 h-20 text-brand-charcoal mb-6" strokeWidth={1} />
                    <h3 className="text-2xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-3">
                      登录肌智派
                    </h3>
                    <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] text-center mb-8">
                      登录后同步你的测肤记录与护肤档案
                      <br />
                      随时随地延续你的护肤旅程
                    </p>
                    <button
                      onClick={handleLogin}
                      className="inline-flex items-center justify-center px-10 py-3 rounded-full bg-[#5c4937] text-[#FDFBF7] text-[13px] tracking-[0.12em] font-light cursor-pointer transition-colors duration-300 hover:bg-[#4a3a2c]"
                    >
                      登录 / 注册
                    </button>
                  </>
                ) : (
                  <>
                {/* 头像（纯展示，更换请前往主站账号中心） */}
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-[#ECEBE6] shadow-md mb-4">
                  {user.avatar ? (
                    <Image src={user.avatar} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-medium text-[#8A8A8A]">
                      {(user.name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>

                {/* 昵称（纯展示）+ 会员徽章（REGULAR 普通 / SILVER 银卡 / GOLD 金卡 / DIAMOND 钻石，历史 ADVANCED 按金卡兜底） */}
                <p className="text-xl font-semibold text-[#1A1A1A] mb-1.5 flex items-center gap-2">
                  {user.name || "朋友"}
                  {(() => {
                    const badge = getMemberBadge(user.membershipLevel);
                    return (
                      <span className={`text-[10px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${badge.className}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </p>

                {/* 手机号 */}
                <div className={`flex items-center gap-1.5 text-[13px] text-[#5E5E5E] ${testUsage ? "mb-1.5" : "mb-8"}`}>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{maskPhone(user.phone)}</span>
                </div>

                {/* 测肤用量：普通/银卡显示终身用量，金卡/钻石不限次显示当日用量；接口失败不渲染 */}
                {testUsage && (
                  <p className="text-[12px] text-[#8A8A8A] font-light tracking-[0.05em] mb-6">
                    {testUsage.unlimited
                      ? `测肤不限次（今日已用 ${testUsage.todayUsed}/${testUsage.dailyLimit ?? 10}）`
                      : `测肤已用 ${testUsage.totalUsed} / 共 ${testUsage.lifetimeLimit ?? 10} 次`}
                  </p>
                )}

                {/* 护肤档案入口：打开全局护肤档案弹层 */}
                <button
                  onClick={() => {
                    onClose();
                    openDiaryModal();
                  }}
                  className="group w-full flex items-center justify-between px-4 py-3 mb-3 rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 text-[13px] tracking-[0.05em] text-[#5E5E5E] hover:text-brand-charcoal hover:border-brand-charcoal/20 transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <NotebookPen className="w-4 h-4" />
                    护肤档案
                  </span>
                  <ChevronRight className="w-4 h-4 text-brand-charcoal/30 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>

                {/* 资料编辑统一到主站账号中心：整行卡片式入口，与弱操作「退出登录」拉开层级 */}
                <a
                  href="https://nihplod.cn/account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-full flex items-center justify-between px-4 py-3 mb-6 rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 text-[13px] tracking-[0.05em] text-[#5E5E5E] hover:text-brand-charcoal hover:border-brand-charcoal/20 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    管理账号资料
                  </span>
                  <ChevronRight className="w-4 h-4 text-brand-charcoal/30 transition-transform duration-300 group-hover:translate-x-0.5" />
                </a>

                {/* 退出登录 */}
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-[#8A8A8A] hover:text-[#1A1A1A] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出登录
                </button>
                  </>
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
