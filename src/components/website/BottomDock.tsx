"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ScanFace, NotebookPen, Sparkles, CircleUserRound } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useUser } from "@/components/auth/UserProvider";
import { STORAGE_KEYS } from "@/lib/storage-keys";

/**
 * BottomDock — 全端统一底部导航（移动端贴底通栏 / 桌面端悬浮胶囊）
 *
 * 挂载于根 layout（<main> 之外），通过 usePathname 自我排除沉浸式页面：
 * "默认接入、显式排除"，新增沉浸式页面只需往 HIDDEN_PREFIXES 加一行前缀。
 */

// 不渲染 Dock 的路由前缀：测评流程、微信回调、管理后台、认证全屏页
const HIDDEN_PREFIXES = [
  "/questions",
  "/face-scan",
  "/result",
  "/reports",
  "/wechat", // 同时覆盖 /wechat/*
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

interface DockTab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** 首页需精确匹配，其余前缀匹配 */
  exact?: boolean;
  /** 未登录时拦截跳转、改为打开登录弹窗 */
  requiresAuth?: boolean;
}

const TABS: DockTab[] = [
  { label: "素颜测肤", href: "/", icon: ScanFace, exact: true },
  { label: "护肤日记", href: "/diary", icon: NotebookPen },
  { label: "了解肌智派", href: "/skin-types", icon: Sparkles },
  { label: "我的", href: "/profile", icon: CircleUserRound, requiresAuth: true },
];

export function BottomDock() {
  const pathname = usePathname();
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const isActive = (tab: DockTab) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  // 未登录点"我的"：先记下目标页，SSO 登录完成后由 AuthUrlDetector（根 layout）消费并回跳
  const handleAuthRequired = (href: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_REDIRECT, href);
    } catch {
      // sessionStorage 不可用时退化为停留在当前页
    }
  };

  const tabClass = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-1 flex-1 min-w-[48px] min-h-[48px] rounded-xl text-[10px] tracking-[0.05em] transition-colors duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:bg-brand-charcoal/5 ${
      active
        ? "text-brand-charcoal"
        : "text-brand-charcoal/50 hover:text-brand-charcoal/80 active:text-brand-charcoal"
    }`;

  // 点击当前已激活 tab：不重复导航，平滑回顶部（移动端用户习惯）
  const handleActiveClick = (active: boolean) => (e: React.MouseEvent) => {
    if (active) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderContent = (tab: DockTab, active: boolean) => (
    <>
      {tab.href === "/profile" && user?.avatar ? (
        <span className="relative block w-[22px] h-[22px] rounded-full overflow-hidden">
          <Image src={user.avatar} alt="" fill unoptimized className="object-cover" />
        </span>
      ) : (
        <tab.icon
          className="w-[22px] h-[22px]"
          strokeWidth={active ? 2 : 1.5}
        />
      )}
      <span className={active ? "font-medium" : "font-light"}>{tab.label}</span>
    </>
  );

  return (
    <nav
      aria-label="主导航"
      className="fixed bottom-0 left-0 right-0 z-[var(--z-dock)] pointer-events-none"
    >
      {/* 移动端：贴底通栏；桌面端：居中悬浮胶囊（仅胶囊响应点击，透明区域放行下方内容） */}
      <div
        className="relative mx-auto flex items-stretch h-[var(--dock-height)] px-2 bg-[#FDFBF7]/90 backdrop-blur-md border-t border-brand-charcoal/[0.08] pb-[env(safe-area-inset-bottom,0px)] md:mb-8 md:max-w-md md:rounded-full md:border md:shadow-[0_8px_30px_rgba(0,38,62,0.10)] box-content pointer-events-auto"
      >
        {TABS.map((tab) => {
          const active = isActive(tab);
          if (tab.requiresAuth && !user) {
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => {
                  handleAuthRequired(tab.href);
                  openAuthModal("login");
                }}
                className={`${tabClass(active)} cursor-pointer`}
              >
                {renderContent(tab, active)}
              </button>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              onClick={handleActiveClick(active)}
              className={tabClass(active)}
            >
              {renderContent(tab, active)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
