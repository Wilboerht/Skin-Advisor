"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ScanFace, NotebookPen, Sparkles, CircleUserRound } from "lucide-react";
import { useUser } from "@/components/auth/UserProvider";
import { AccountModal } from "@/components/website/AccountModal";
import { useDiaryModal } from "@/components/website/DiaryModalContext";

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
  /** 拦截跳转、改为打开弹层：account=账户弹层（未登录引导登录），diary=护肤档案弹层 */
  panel?: "account" | "diary";
}

const TABS: DockTab[] = [
  { label: "在线测肤", href: "/", icon: ScanFace, exact: true },
  { label: "护肤档案", href: "/diary", icon: NotebookPen, panel: "diary" },
  { label: "了解肌智派", href: "/skin-types", icon: Sparkles },
  { label: "我的", href: "/profile", icon: CircleUserRound, panel: "account" },
];

export function BottomDock() {
  const pathname = usePathname();
  const { user } = useUser();
  const { openDiaryModal } = useDiaryModal();
  // 「我的」账户弹层（未登录时弹层内展示登录引导）
  const [showAccountModal, setShowAccountModal] = useState(false);
  // Portal 需等客户端挂载（SSR 期无 document）
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const isActive = (tab: DockTab) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  const tabClass = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-1 flex-1 min-w-[48px] min-h-[48px] rounded-xl text-[11px] tracking-[0.05em] transition-colors duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:bg-brand-charcoal/5 ${
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
      {tab.panel === "account" && user?.avatar ? (
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
        className="dock-panel relative mx-auto flex items-stretch h-[var(--dock-height)] px-2 bg-[#FDFBF7]/90 backdrop-blur-md border-t border-brand-charcoal/[0.08] pb-[env(safe-area-inset-bottom,0px)] md:mb-8 md:max-w-md md:rounded-full md:border md:shadow-[0_8px_30px_rgba(0,38,62,0.10)] box-content pointer-events-auto"
      >
        {TABS.map((tab) => {
          const active = isActive(tab);
          // 「我的」/「护肤档案」是按钮：统一打开对应弹层（未登录由弹层展示登录引导）
          if (tab.panel) {
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => (tab.panel === "diary" ? openDiaryModal() : setShowAccountModal(true))}
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

      {/* 账户弹层：Portal 到 body，避免受 Dock 容器样式影响 */}
      {mounted && createPortal(
        <AccountModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />,
        document.body
      )}
    </nav>
  );
}
