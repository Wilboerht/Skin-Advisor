"use client";

import { CalendarCheck, CircleUserRound, ScanFace, TrendingUp } from "lucide-react";
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
      <CircleUserRound className="w-16 h-16 text-brand-charcoal/70 mb-5" strokeWidth={1} />
      <h3 className="text-2xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-2.5">
        登录肌智派
      </h3>
      <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] text-center mb-6">
        登录后同步你的测肤记录与护肤档案
        <br />
        随时随地延续你的护肤旅程
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
        {[
          { icon: TrendingUp, label: "护肤档案" },
          { icon: ScanFace, label: "专业在线测肤" },
          { icon: CalendarCheck, label: "专属顾问" },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <span
              key={f.label}
              className="inline-flex h-[26px] px-2.5 items-center justify-center gap-1.5 rounded-full border border-brand-charcoal/[0.12] bg-transparent text-[11px] font-light text-brand-charcoal/60 tracking-[0.04em] whitespace-nowrap"
            >
              <Icon className="w-3.5 h-3.5 text-brand-charcoal/45" strokeWidth={1.5} />
              {f.label}
            </span>
          );
        })}
      </div>
      <button
        onClick={handleLogin}
        className="inline-flex items-center justify-center h-11 px-8 min-w-[200px] rounded-full bg-[var(--color-brand-cocoa)] text-[#FDFBF7] text-[13px] font-normal tracking-[0.08em] cursor-pointer transition-colors duration-300 hover:bg-[#4a3a2c]"
      >
        登录 / 注册
      </button>
    </div>
  );
}
