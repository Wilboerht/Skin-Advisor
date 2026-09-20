"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useLazyOpen } from "@/hooks/use-lazy-open";

// 账户弹层懒加载：只有点自己的头像才需要——结果页首屏包体优化（AccountModal 内含三个 tab 与上传逻辑）
const AccountModal = dynamic(() => import("@/components/website/AccountModal").then((mod) => mod.AccountModal), { ssr: false });

/**
 * UserBadge — 顶部栏用户身份区：头像 + 用户名（极简）。
 * 登录态点击打开账户弹层（AccountModal）；未登录显示登录引导。
 * compact：小屏顶栏用紧凑形态（隐藏昵称，避免与居中 logo 拥挤）
 */
export default function UserBadge({ compact = false }: { compact?: boolean }) {
  const { user, isInitialized } = useAuth();
  const { openAuthModal } = useAuthModal();
  // 登录态点击打开账户弹层（AccountModal，替代原 /profile 页；该页已重定向到首页）
  const [showAccount, setShowAccount] = useState(false);
  const shouldRenderAccount = useLazyOpen(showAccount);
  const [avatarFailed, setAvatarFailed] = useState(false);
  // 用户/头像变化时重置失败标记（避免换账号后沿用上一个头像的失败态）
  useEffect(() => { setAvatarFailed(false); }, [user?.avatar]);

  const nickname = user?.name?.trim() || "我的档案";
  const initial = nickname.slice(0, 1).toUpperCase();

  // 未初始化：骨架占位（宽度与登录态实际占用接近，避免挂载后跳动）
  if (!isInitialized) {
    return (
      <div
        aria-hidden="true"
        className={`${compact ? "w-9 md:w-[140px]" : "w-[140px]"} h-8 rounded-full bg-brand-charcoal/5 animate-pulse`}
      />
    );
  }

  // 未登录：登录引导位（结果页注册转化高点）
  if (!user) {
    return (
      <button
        onClick={() => openAuthModal("login")}
        className="inline-flex items-center justify-center h-8 px-3.5 rounded-full border border-brand-charcoal/20 text-[12px] font-light tracking-[0.08em] text-brand-charcoal/70 hover:text-brand-charcoal hover:border-brand-charcoal/40 transition-colors whitespace-nowrap"
      >
        登录 / 注册
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowAccount(true)}
        className="group flex items-center gap-2 rounded-full py-1 pl-1 pr-2 lg:pr-3 hover:bg-brand-charcoal/5 transition-colors"
        aria-label={`${nickname}的账户`}
      >
        {/* 头像 */}
        <span className="relative shrink-0">
          {user.avatar && !avatarFailed ? (
            <Image
              src={user.avatar}
              alt=""
              width={28}
              height={28}
              unoptimized
              className="w-7 h-7 lg:w-8 lg:h-8 rounded-full object-cover border border-brand-charcoal/10"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <span className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-[var(--color-brand-cocoa)]/15 border border-brand-charcoal/10 flex items-center justify-center text-[12px] lg:text-[13px] font-medium text-[var(--color-brand-cocoa)]">
              {initial}
            </span>
          )}
        </span>

        {/* 用户名（compact 小屏隐藏，避免与居中 logo 拥挤） */}
        <span
          className={`${compact ? "hidden md:inline" : ""} max-w-[110px] lg:max-w-[160px] truncate text-[13px] lg:text-[14px] font-medium text-brand-charcoal group-hover:text-[var(--color-brand-cocoa)] transition-colors`}
        >
          {nickname}
        </span>
      </button>

      {shouldRenderAccount && (
        <AccountModal isOpen={showAccount} onClose={() => setShowAccount(false)} />
      )}
    </>
  );
}
