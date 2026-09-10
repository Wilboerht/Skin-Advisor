"use client";

import Link from "next/link";
import { CircleUserRound, ScanFace, Smile, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";

/**
 * LoginGuide — 全站统一的"未登录 → 登录引导"视图（样式取自 AccountModal 未登录态）。
 * 使用方：AccountModal（Dock「我的」）、AuthModal（login/register/forgot_password 的 SSO 引导视图）。
 * 登录动作统一整页跳转 NIHPLOD 账号中心（login()）。
 */
export function LoginGuide({ onNavigateLogin }: { onNavigateLogin?: () => void }) {
  const { login } = useAuth();
  const toast = useToast();

  const handleLogin = () => {
    // 整页跳转到账号中心，弱网下需数秒——先给出即时反馈，避免用户误以为没点上而连点
    toast.info("正在前往 NIHPLOD 账号中心…");
    onNavigateLogin?.();
    login();
  };

  return (
    <div className="flex flex-col items-center text-center py-4">
      <CircleUserRound className="w-20 h-20 text-brand-charcoal mb-6" strokeWidth={1} />
      <h3 className="text-2xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-3">
        登录肌智派
      </h3>
      <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] text-center mb-5">
        登录后同步你的测肤记录与护肤档案
        <br />
        随时随地延续你的护肤旅程
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
        {[
          { icon: TrendingUp, label: "肌肤变化" },
          { icon: ScanFace, label: "里程碑记录" },
          { icon: Smile, label: "每日打卡" },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <span
              key={f.label}
              className="inline-flex h-[24px] px-2 items-center justify-center gap-1.5 rounded-full border border-[var(--color-brand-charcoal)]/15 bg-transparent text-xs font-bold text-[var(--color-brand-charcoal)] lg:h-[26px] lg:px-2.5 lg:text-xs lg:tracking-wide lg:rounded-lg lg:border lg:border-[var(--color-brand-charcoal)]/30 whitespace-nowrap"
            >
              <Icon className="w-3.5 h-3.5 text-brand-charcoal/45" strokeWidth={1.5} />
              {f.label}
            </span>
          );
        })}
      </div>
      <button
        onClick={handleLogin}
        className="inline-flex items-center justify-center px-10 py-3 rounded-full bg-[var(--color-brand-cocoa)] text-[#FDFBF7] text-[13px] tracking-[0.12em] font-light cursor-pointer transition-colors duration-300 hover:bg-[#4a3a2c] mb-4"
      >
        登录 / 注册
      </button>
      <Link
        href="/questions"
        className="text-[13px] text-brand-charcoal/60 font-light tracking-[0.06em] hover:text-brand-charcoal transition-colors"
      >
        先去测肤，稍后再登录 →
      </Link>
    </div>
  );
}
