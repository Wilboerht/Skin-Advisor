"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ScanFace, NotebookPen, MessageCircleHeart, CircleUserRound } from "lucide-react";
import { useUser } from "@/components/auth/UserProvider";
import { useLazyOpen } from "@/hooks/use-lazy-open";
import { useDiaryModal } from "@/components/website/DiaryModalContext";

// 账户弹层懒加载：挂在全站 Dock 上，但只有用户点「我的」才需要
const AccountModal = dynamic(() => import("@/components/website/AccountModal").then((mod) => mod.AccountModal), { ssr: false });
// 专属顾问弹层懒加载：只有用户点「专属顾问」才下载 chunk
const AdvisorContactModal = dynamic(() => import("@/components/website/AdvisorContactModal").then((mod) => mod.AdvisorContactModal), { ssr: false });

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
  /** 拦截跳转、改为打开弹层：account=账户弹层（未登录引导登录），diary=护肤档案弹层，advisor=专属顾问弹层 */
  panel?: "account" | "diary" | "advisor";
}

const TABS: DockTab[] = [
  { label: "在线测肤", href: "/", icon: ScanFace, exact: true },
  { label: "护肤档案", href: "/diary", icon: NotebookPen, panel: "diary" },
  { label: "专属顾问", href: "/advisor", icon: MessageCircleHeart, panel: "advisor" },
  { label: "我的", href: "/profile", icon: CircleUserRound, panel: "account" },
];

export function BottomDock() {
  const pathname = usePathname();
  const { user } = useUser();
  const { openDiaryModal, isOpen: diaryOpen } = useDiaryModal();
  // 「我的」账户弹层（未登录时弹层内展示登录引导）
  const [showAccountModal, setShowAccountModal] = useState(false);
  // 「专属顾问」弹层（银卡及以上展示二维码，普通会员展示升级引导）
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  // 账户弹层入口防抖：250ms 内忽略重复打开（前缘节流，双击第二下会被遮罩防误触拦截）
  const accountLastOpenRef = useRef(0);
  const openAccountModal = () => {
    // 仅在点击事件中调用（非渲染期），Date.now 用于前缘节流
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (now - accountLastOpenRef.current < 250) return;
    accountLastOpenRef.current = now;
    setShowAccountModal(true);
  };
  // Portal 需等客户端挂载（SSR 期无 document）
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // 账户弹层懒加载 latch：首次打开前不渲染（chunk 不下载），打开过后保持挂载以保留退场动画
  const shouldRenderAccountModal = useLazyOpen(showAccountModal);
  // 专属顾问弹层懒加载 latch：同上
  const shouldRenderAdvisorModal = useLazyOpen(showAdvisorModal);

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const isActive = (tab: DockTab) => {
    // 面板 tab：弹层打开期间也视为激活（dock 在弹层打开时会随滚动锁下移隐藏，
    // 这里主要用于 aria/状态正确性与过渡阶段的高亮）
    if (tab.panel === "diary") return diaryOpen || pathname.startsWith(tab.href);
    // 专属顾问无独立路由，仅弹层打开期间激活
    if (tab.panel === "advisor") return showAdvisorModal;
    if (tab.panel === "account") return showAccountModal || pathname.startsWith(tab.href);
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  };

  const tabClass = (active: boolean) =>
    `group relative flex flex-col items-center justify-center gap-1.5 flex-1 min-w-[48px] min-h-[48px] rounded-xl text-[11px] tracking-[0.02em] select-none touch-manipulation [-webkit-tap-highlight-color:transparent] transition duration-300 active:scale-[0.97] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 ${
      active
        ? "text-[var(--color-brand-cocoa)]"
        : "text-brand-charcoal/70 hover:text-brand-charcoal/90 active:text-brand-charcoal"
    }`;

  // 打开面板类 tab 对应的弹层
  const openPanel = (panel: DockTab["panel"]) => {
    if (panel === "diary") openDiaryModal();
    else if (panel === "advisor") setShowAdvisorModal(true);
    else if (panel === "account") openAccountModal();
  };

  // 面板弹层是否已打开（aria-expanded）
  const isPanelOpen = (panel: DockTab["panel"]) =>
    panel === "diary" ? diaryOpen : panel === "advisor" ? showAdvisorModal : showAccountModal;

  // 点击当前已激活 tab：不重复导航；仅移动端保留"平滑回顶部"习惯（PC 端点击不产生滚动副作用）
  const handleActiveClick = (active: boolean) => (e: React.MouseEvent) => {
    if (active) {
      e.preventDefault();
      if (window.innerWidth < 768) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const renderContent = (tab: DockTab) => (
    <>
      {tab.panel === "account" && user?.avatar ? (
        <span className="relative block w-[22px] h-[22px] rounded-full overflow-hidden">
          <Image src={user.avatar} alt="" fill unoptimized className="object-cover" />
        </span>
      ) : (
        <tab.icon
          className="w-[22px] h-[22px] transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
          strokeWidth={1.75}
        />
      )}
      <span className="font-light">{tab.label}</span>
    </>
  );

  return (
    <nav
      aria-label="主导航"
      className="fixed bottom-0 left-0 right-0 z-[var(--z-dock)] pointer-events-none px-3"
    >
      {/* 全端统一悬浮胶囊：移动端实色（全宽磨砂在低端机上合成开销高）+ 上浮 8px；桌面端磨砂 + 更宽定宽 */}
      <div
        className="dock-panel relative mx-auto flex items-stretch h-[var(--dock-height)] px-2 max-w-[420px] md:max-w-md bg-[#FDFBF7] md:bg-[#FDFBF7]/90 md:backdrop-blur-md rounded-full border border-brand-charcoal/[0.08] shadow-[0_8px_30px_rgba(61,47,37,0.12)] mb-[calc(env(safe-area-inset-bottom,0px)+var(--dock-bottom-offset))] md:mb-8 pointer-events-auto"
      >
        {TABS.map((tab) => {
          const active = isActive(tab);
          // 面板类 tab（护肤档案/专属顾问/我的）是按钮：统一打开对应弹层（未登录由弹层展示登录引导）
          if (tab.panel) {
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => openPanel(tab.panel)}
                aria-haspopup="dialog"
                aria-expanded={isPanelOpen(tab.panel)}
                className={`${tabClass(active)} cursor-pointer`}
              >
                {renderContent(tab)}
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
              {renderContent(tab)}
            </Link>
          );
        })}
      </div>

      {/* 账户弹层：Portal 到 body，避免受 Dock 容器样式影响；首次打开才加载 chunk */}
      {mounted && shouldRenderAccountModal && createPortal(
        <AccountModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />,
        document.body
      )}

      {/* 专属顾问弹层：组件内部已 Portal 到 body；首次打开才加载 chunk */}
      {mounted && shouldRenderAdvisorModal && (
        <AdvisorContactModal isOpen={showAdvisorModal} onClose={() => setShowAdvisorModal(false)} />
      )}
    </nav>
  );
}
