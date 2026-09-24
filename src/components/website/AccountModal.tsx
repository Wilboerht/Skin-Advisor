"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AnimatePresence, LazyMotion, domMax, m, useDragControls, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { Crown, Gift, LogOut, NotebookPen, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useModalBackClose } from "@/hooks/use-modal-back-close";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { LoginGuide } from "@/components/website/LoginGuide";
import { ACCOUNT_SHELL } from "@/components/website/account-styles";
import { AccountRootView } from "@/components/website/AccountRootView";
import { PointsMallPanel } from "@/components/website/user-center/PointsMallPanel";
import { VipPanel } from "@/components/website/user-center/VipPanel";

// 护肤档案面板：合并进账户弹层后按需加载（首次切到档案 tab 才下载其整串子组件）
const DiaryPanel = dynamic(() => import("@/components/website/DiaryPanel").then((mod) => mod.DiaryPanel), { ssr: false });

/** 弹层内容错误边界：单个 tab 渲染异常只降级本区域，不波及整页（结果页/弹层外壳仍可用） */
class AccountPanelErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[AccountModal] panel render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full flex flex-col items-center py-10">
          <p className="text-[13px] text-brand-charcoal/60 mb-4">内容出错了，请重试</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-brand-charcoal border border-brand-charcoal/20 hover:bg-brand-charcoal/[0.04] transition-colors cursor-pointer"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export type AccountTab = "profile" | "diary" | "vip" | "mall";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 打开瞬间定位的 tab（默认个人信息）；仅在打开时生效，中途变化不触发复位 */
  initialTab?: AccountTab;
  /** tab 切换上报（外部入口如底部 Dock 的高亮状态用） */
  onTabChange?: (tab: AccountTab) => void;
}

/** 侧边栏 / 底部 Tab 的一级菜单（不含安全中心） */
const MENU_ITEMS: { key: AccountTab; label: string; icon: typeof Crown }[] = [
  { key: "profile", label: "个人信息", icon: User },
  { key: "diary", label: "护肤档案", icon: NotebookPen },
  { key: "vip", label: "会员中心", icon: Crown },
  { key: "mall", label: "积分商城", icon: Gift },
];

/** 侧边栏等级徽标样式（四档，与主站用户中心一致） */
const LEVEL_PILL_STYLES: Record<string, string> = {
  REGULAR: "border-stone-200 bg-stone-100 text-stone-500",
  SILVER: "border-zinc-200 bg-zinc-50 text-zinc-600",
  GOLD: "border-amber-200 bg-amber-50 text-amber-700",
  DIAMOND: "border-indigo-200 bg-indigo-50 text-indigo-700",
  ADVANCED: "border-amber-200 bg-amber-50 text-amber-700",
};

/** 侧边栏等级文案（钻石档统一为「钻石卡会员」，与主站口径一致） */
const LEVEL_LABELS: Record<string, string> = {
  REGULAR: "普通会员",
  SILVER: "银卡会员",
  GOLD: "金卡会员",
  DIAMOND: "钻石卡会员",
  ADVANCED: "金卡会员",
};

/**
 * AccountModal — 用户面板弹层（样式对齐主站用户中心）：
 * 登录后为「左侧边栏 + 右侧内容区」：
 * - 侧边栏：头像/昵称/等级徽标 + 菜单（个人信息/护肤档案/会员中心/积分商城）+ 退出登录
 * - 移动端：顶部 Header + 底部 Tab 栏（4 项，无侧边栏）
 * 内容面板：个人信息 = AccountRootView；护肤档案 = DiaryPanel（2026-09 由独立弹层合并，dynamic 按需加载）；
 * 会员中心 = VipPanel（主站同款）；积分商城 = PointsMallPanel（原生，BFF 代理官网 OAuth 资源端点）。
 * 未登录：登录引导视图，点击按钮走 SSO 统一登录（原护肤档案弹层的未登录态也由这里承接）。
 */
export function AccountModal({ isOpen, onClose, initialTab, onTabChange }: AccountModalProps) {
  const { user, logout } = useAuth();
  const { openAuthModal } = useAuthModal();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  // 移动端 sheet 下滑关闭：手势只在头部触发（内容滚动不受影响）
  const dragControls = useDragControls();

  // 一级菜单状态：首次进入后保持挂载（仅隐藏），iframe/会员数据不重载
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab ?? "profile");
  const [visitedTabs, setVisitedTabs] = useState<AccountTab[]>(initialTab ? [initialTab] : ["profile"]);

  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 移动端返回键/返回手势：单级视图，直接关闭弹层
  useModalBackClose(isOpen, onClose);

  // 打开瞬间的目标 tab：用 ref 捕获（打开时先更新 ref 再应用），避免 initialTab 变化引发中途复位
  const initialTabOnOpenRef = useRef(initialTab);
  useEffect(() => {
    initialTabOnOpenRef.current = initialTab;
  }, [initialTab]);
  useEffect(() => {
    if (isOpen) {
      const target = initialTabOnOpenRef.current ?? "profile";
      setActiveTab(target);
      setVisitedTabs([target]);
    }
  }, [isOpen]);
  // 账号切换：回到个人信息（跳过首次挂载，避免覆盖 initialTab）
  const prevUserIdRef = useRef(user?.id);
  useEffect(() => {
    if (prevUserIdRef.current === user?.id) return;
    prevUserIdRef.current = user?.id;
    setActiveTab("profile");
    setVisitedTabs(["profile"]);
  }, [user?.id]);

  const activateTab = (tab: AccountTab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
    onTabChange?.(tab);
  };

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

  // Portal 到 body：fixed 定位在带 transform/backdrop-filter 的祖先（如结果页顶部栏的毛玻璃底）
  // 内会被重新相对该祖先定位，导致弹窗"挂"在顶部栏上而不是视口居中
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 路由变化（如档案内点击报告/去测肤等跳转）时自动关闭弹层：
  // 弹层是页面组件状态，客户端导航不会卸载组件，不处理会盖在新页面上（原 DiaryModal 同款保护）
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      if (isOpen) onClose();
    }
  }, [pathname, isOpen, onClose]);

  // 退出确认框状态：global = 勾选「同时退出所有 NIHPLOD 平台」
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutGlobal, setLogoutGlobal] = useState(false);

  // Escape 分层：确认框打开时优先关确认框，否则关闭弹层。
  // 注意必须带上 mounted：首次打开时 Portal 内容尚未渲染（mounted=false → 提前 return null），
  // 若此时注册 focus trap 会因容器为空而失败，且 hook 以传入值为依赖不会自动补注册（首开 Esc 失效的历史 bug）
  const modalRef = useFocusTrap<HTMLDivElement>(
    isOpen && mounted,
    showLogoutConfirm ? () => setShowLogoutConfirm(false) : onClose
  );

  const handleLogout = () => {
    setLogoutGlobal(false);
    setShowLogoutConfirm(true);
  };

  // 会话过期的登录引导：先关账户弹层再开 AuthModal——AuthModal 层级（100002/100003）低于弹层层
  // （--z-modal = 100100），叠加会被遮挡；且两个 focus trap 同时激活会导致 Escape 双触发
  const requestLogin = () => {
    onClose();
    openAuthModal("login");
  };

  const handleLogoutConfirm = async () => {
    const global = logoutGlobal;
    setShowLogoutConfirm(false);
    onClose();
    // logout 内部已完成整页跳转，无需再处理路由
    await logout({ global });
  };

  if (!mounted) return null;

  const levelLabel = LEVEL_LABELS[user?.membershipLevel ?? ""] ?? "普通会员";
  const levelPillClass = LEVEL_PILL_STYLES[user?.membershipLevel ?? "REGULAR"] ?? LEVEL_PILL_STYLES.REGULAR;
  const displayName = user?.name?.trim() || (user?.phone ? `用户${user.phone.slice(-4)}` : "用户");

  return createPortal(
    <LazyMotion features={domMax}>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            tabIndex={-1}
            className={`fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-0 ${
              user ? "md:items-center md:p-4" : "sm:items-center sm:p-4"
            }`}
          >
            {/* 背景遮罩 */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />

            {/* 弹窗主体：登录后为主站同款「侧边栏 + 内容」壳；未登录为窄卡片 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={
                isMobile
                  ? { type: "spring", damping: 25, stiffness: 300 }
                  : { duration: 0.25, ease: "easeOut" }
              }
              drag={isMobile ? "y" : false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (isMobile && (info.offset.y > 120 || info.velocity.y > 700)) {
                  onClose();
                }
              }}
              className={`relative z-10 w-full outline-none ${
                user
                  ? "flex h-[calc(100vh-4rem)] items-stretch overflow-hidden rounded-t-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] md:h-[min(680px,calc(100dvh-3rem))] md:max-w-[1100px] md:rounded-[2.5rem] md:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]"
                  : `${ACCOUNT_SHELL} flex flex-col overflow-hidden sm:max-w-sm max-h-[85vh] sm:max-h-[80vh]`
              }`}
              style={
                user && isMobile
                  ? {
                      height: "calc(100dvh - max(4rem, env(safe-area-inset-top) + 0.75rem))",
                      // 不支持 dvh 的浏览器回退到 100vh
                      minHeight: 0,
                    }
                  : undefined
              }
              onClick={(e) => e.stopPropagation()}
            >
              {user ? (
                <>
                  {/* 底层基础色 */}
                  <div className="absolute inset-0 z-0 bg-[#FBF8F0]" />

                  {/* 背景动态装饰层（仅桌面端，移动端纯色底保低端机性能） */}
                  <div className="pointer-events-none absolute inset-0 z-10 hidden overflow-hidden md:block">
                    <m.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              x: ["-30%", "40%", "10%", "-30%"],
                              y: ["-30%", "20%", "40%", "-30%"],
                              rotate: [0, 180, 360],
                              scale: [1, 1.4, 1.2, 1],
                            }
                      }
                      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                      style={{ willChange: "transform" }}
                      className="absolute h-[120%] w-[120%] rounded-full bg-brand-charcoal/10 blur-[150px]"
                    />
                    <m.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              x: ["40%", "-20%", "30%", "40%"],
                              y: ["40%", "10%", "-30%", "40%"],
                              rotate: [0, -180, -360],
                              scale: [1, 1.3, 1.1, 1],
                            }
                      }
                      transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                      style={{ willChange: "transform" }}
                      className="absolute h-[110%] w-[110%] rounded-full bg-stone-400/15 blur-[130px]"
                    />
                  </div>

                  {/* 模糊盖层（其下内容被模糊，仅桌面端） */}
                  <div className="absolute inset-0 z-20 hidden bg-white/5 backdrop-blur-[40px] md:block" />

                  {/* 内容区域容器：桌面 flex-row（侧边栏 + 内容），移动 flex-col（头 + 内容 + 底部 Tab） */}
                  <div className="relative z-30 flex h-full w-full flex-col items-stretch md:flex-row">
                    {/* 桌面侧边栏（移动端由底部 Tab 栏替代） */}
                    {!isMobile && (
                      <div className="flex w-full shrink-0 flex-col border-r border-stone-200/60 md:w-72">
                        {/* 用户头像区域 */}
                        <div className="px-16 pb-4 pt-12">
                          <div className="flex flex-col items-start gap-4 text-left">
                            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FBF8F0]/40">
                              {user.avatar ? (
                                <Image
                                  src={user.avatar}
                                  alt="Avatar"
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <User className="h-6 w-6 text-stone-500" strokeWidth={1.5} />
                              )}
                            </div>
                            <div className="flex flex-col justify-center">
                              <p className="truncate text-[15px] font-medium text-stone-800">
                                {displayName}
                              </p>
                              <button
                                type="button"
                                onClick={() => activateTab("vip")}
                                className={`mt-1.5 inline-flex w-fit cursor-pointer items-center rounded-full border px-2 py-0.5 text-[11px] font-light transition-colors hover:opacity-80 ${levelPillClass}`}
                              >
                                {levelLabel}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 菜单列表 */}
                        <nav className="scrollbar-hide relative flex w-full flex-1 flex-col items-start justify-start space-y-1 overflow-y-auto px-16 py-2">
                          {MENU_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.key;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => activateTab(item.key)}
                                className={`group relative -mx-4 flex w-full items-center justify-start gap-5 rounded-2xl px-4 py-3.5 transition-all cursor-pointer ${
                                  isActive
                                    ? "font-medium text-stone-800"
                                    : "font-light text-stone-400 hover:bg-white/30 hover:text-stone-800"
                                }`}
                              >
                                {isActive && (
                                  <div className="pointer-events-none absolute inset-y-0 left-0 hidden items-center md:flex">
                                    <m.div
                                      layoutId="activeSideMenu"
                                      className="h-[18px] w-[2px] rounded-full bg-stone-800"
                                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                  </div>
                                )}
                                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                                <span className="text-[13px] font-light">{item.label}</span>
                              </button>
                            );
                          })}
                        </nav>

                        <div className="mt-auto px-12 py-8">
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="group -mx-4 flex w-full items-center justify-start gap-5 rounded-2xl px-4 py-3.5 text-stone-600 transition-all hover:bg-white/40 hover:text-stone-900 cursor-pointer"
                          >
                            <LogOut className="h-[18px] w-[18px] transition-colors" strokeWidth={1.5} />
                            <span className="text-[13px] font-medium tracking-wide">退出登录</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 右侧内容区（移动端：Header + 面板 + 底部 Tab） */}
                    <div className="relative flex h-full min-w-0 flex-1 flex-col">
                      {/* 移动端 Header：把手 + 标题 + 关闭；header 为下滑关闭手势触发区 */}
                      {isMobile && (
                        <div
                          onPointerDown={(e) => {
                            if (e.button !== undefined && e.button !== 0) return;
                            dragControls.start(e);
                          }}
                          className="shrink-0 select-none border-b border-stone-200/40 bg-[#FBF8F0] md:hidden"
                        >
                          <div aria-hidden className="flex justify-center pt-2">
                            <div className="h-1 w-9 rounded-full bg-stone-300/70" />
                          </div>
                          <div className="grid h-14 grid-cols-[3.5rem_1fr_3.5rem] items-center">
                            <div aria-hidden />
                            <h2 className="truncate text-center text-[15px] font-medium tracking-wide text-stone-800">
                              {MENU_ITEMS.find((i) => i.key === activeTab)?.label || "个人信息"}
                            </h2>
                            <div className="flex h-full w-full items-center justify-center">
                              <button
                                type="button"
                                onClick={onClose}
                                onPointerDown={(e) => e.stopPropagation()}
                                aria-label="关闭用户中心"
                                className="flex h-11 w-11 items-center justify-center text-stone-500 transition-colors hover:text-stone-800 active:opacity-60 cursor-pointer"
                              >
                                <X className="h-5 w-5" strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <h2 id="account-modal-title" className="sr-only">
                        我的账户
                      </h2>

                      <div className="min-h-0 flex-1 overflow-hidden">
                        <AccountPanelErrorBoundary>
                          {visitedTabs.includes("profile") && (
                            <div
                              role="tabpanel"
                              id="account-tabpanel-profile"
                              hidden={activeTab !== "profile"}
                              className="h-full"
                            >
                              {/* 面板自带标题与滚动区（与官网 ProfilePanel 同构） */}
                              <AccountRootView
                                user={user}
                                onRequestLogout={handleLogout}
                                onRequestLogin={requestLogin}
                                onOpenDiary={() => activateTab("diary")}
                              />
                            </div>
                          )}

                          {visitedTabs.includes("diary") && (
                            <div
                              role="tabpanel"
                              id="account-tabpanel-diary"
                              hidden={activeTab !== "diary"}
                              className="h-full"
                            >
                              <DiaryPanel
                                active={activeTab === "diary"}
                                onRequestLogin={requestLogin}
                              />
                            </div>
                          )}

                          {visitedTabs.includes("vip") && (
                            <div
                              role="tabpanel"
                              id="account-tabpanel-vip"
                              hidden={activeTab !== "vip"}
                              className="h-full"
                            >
                              <VipPanel
                                onRequestLogin={requestLogin}
                                onNavigateMall={() => activateTab("mall")}
                              />
                            </div>
                          )}

                          {visitedTabs.includes("mall") && (
                            <div
                              role="tabpanel"
                              id="account-tabpanel-mall"
                              hidden={activeTab !== "mall"}
                              className="h-full"
                            >
                              {/* 面板自带标题与滚动区（与官网 PointsMallPanel 同构） */}
                              <PointsMallPanel />
                            </div>
                          )}
                        </AccountPanelErrorBoundary>
                      </div>

                      {/* 移动端底部 Tab 栏（safe-area 适配手势条） */}
                      {isMobile && (
                        <nav
                          aria-label="用户中心导航"
                          className="shrink-0 border-t border-stone-200/40 bg-[#FBF8F0]/95 backdrop-blur-md md:hidden"
                          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                        >
                          <div className="grid h-16 grid-cols-4">
                            {MENU_ITEMS.map(({ key, label, icon: Icon }) => {
                              const isActive = activeTab === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => activateTab(key)}
                                  aria-current={isActive ? "page" : undefined}
                                  className={`flex flex-col items-center justify-center gap-1 transition-colors active:opacity-60 cursor-pointer ${
                                    isActive
                                      ? "text-[#00263e]"
                                      : "text-stone-400 hover:text-stone-800"
                                  }`}
                                >
                                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
                                  <span className="text-[11px] leading-none">{label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </nav>
                      )}
                    </div>

                    {/* 桌面端关闭按钮 */}
                    {!isMobile && (
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="关闭用户中心"
                        className="absolute right-10 top-10 z-50 hidden h-9 w-9 items-center justify-center text-stone-400 transition-colors hover:text-stone-800 md:flex cursor-pointer"
                      >
                        <X className="h-5 w-5" strokeWidth={1} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="relative flex h-full w-full flex-col items-center overflow-y-auto px-6 pt-[calc(3rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pt-10 sm:pb-8">
                  <button
                    onClick={onClose}
                    aria-label="关闭"
                    className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                  <h2 id="account-modal-title" className="sr-only">
                    我的账户
                  </h2>
                  <LoginGuide onNavigateLogin={onClose} />
                </div>
              )}
            </m.div>

            {/* 退出登录确认框：默认仅退出本站，勾选后同时退出所有 NIHPLOD 平台（global） */}
            <AnimatePresence>
              {showLogoutConfirm && (
                <div
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="logout-confirm-title"
                  className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
                >
                  <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowLogoutConfirm(false)}
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
                  />
                  <m.div
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative z-10 w-full max-w-xs bg-[#F7F4EE] rounded-[24px] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] px-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="logout-confirm-title" className="text-base font-semibold text-brand-charcoal mb-2">
                      退出登录
                    </h3>
                    <p className="text-[13px] font-light text-brand-charcoal/60 leading-relaxed mb-4">
                      默认仅退出本站；勾选后将同时退出主站及所有 NIHPLOD 平台。
                    </p>
                    <label className="flex items-center gap-2 mb-6 cursor-pointer select-none text-[13px] text-brand-charcoal/70 tracking-[0.03em]">
                      <input
                        type="checkbox"
                        checked={logoutGlobal}
                        onChange={(e) => setLogoutGlobal(e.target.checked)}
                        className="w-4 h-4 accent-brand-charcoal"
                      />
                      同时退出所有 NIHPLOD 平台
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-brand-charcoal/10 bg-brand-charcoal/5 text-[13px] tracking-[0.05em] text-brand-charcoal/70 hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleLogoutConfirm}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-danger)] text-white text-[13px] tracking-[0.05em] transition-opacity hover:opacity-90 cursor-pointer"
                      >
                        {logoutGlobal ? "退出所有平台" : "退出本站"}
                      </button>
                    </div>
                  </m.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body
  );
}
