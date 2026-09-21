"use client";

import { Component, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ArrowLeft, Gift, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useModalBackClose } from "@/hooks/use-modal-back-close";
import { LoginGuide } from "@/components/website/LoginGuide";
import { ACCOUNT_SHELL } from "@/components/website/account-styles";
import { AccountRootView } from "@/components/website/AccountRootView";
import { AccountMyTab } from "@/components/website/AccountMyTab";
import { AccountMembershipTab } from "@/components/website/AccountMembershipTab";
import { AccountMallTab } from "@/components/website/AccountMallTab";

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

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AccountTab = "my" | "mall";

const ACCOUNT_TABS: { key: AccountTab; label: string }[] = [
  { key: "my", label: "我的" },
  { key: "mall", label: "积分商城" },
];

/** 移动端底部 Tab 栏图标（与主站用户中心的底部导航形态对齐） */
const TAB_ICONS: Record<AccountTab, typeof User> = {
  my: User,
  mall: Gift,
};

/** 移动端断点与 Tailwind sm（640px）一致：<640 用底部 Tab 栏，≥640 用顶部胶囊 tab */
const MOBILE_QUERY = "(max-width: 639px)";

/**
 * AccountModal — 用户面板弹层（替代原 /profile 独立页），两级视图：
 * 根视图（最早样式）：身份展示 +「护肤档案」「会员中心」两个入口 + 退出登录；
 * 会员中心视图：「我的 / 积分商城」两个 tab（我的=身份与资料（BFF /api/account/profile）
 * + 会员等级权益（/api/account/membership）合并展示；积分商城=官网 embed iframe），
 * 根视图 ⇄ 会员中心保持挂载淡入切换（中心视图首次进入后不卸载），返回键/Escape 先回根视图。
 * 未登录：登录引导视图，点击按钮走 SSO 统一登录。
 * 容器/动效/关闭按钮与 GiftModal 等全站模态框对齐。
 */
export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { user, logout } = useAuth();
  const { openAuthModal } = useAuthModal();

  // 两级视图：root = 根视图（简洁入口），center = 会员中心（两个 tab）
  const [view, setView] = useState<"root" | "center">("root");
  // 中心视图首次进入后保持挂载（仅用 hidden 切换）：root ⇄ center 往返、切 tab 不再重载
  // iframe/会员数据/折叠状态；账号切换时重置卸载，避免残留上一账号内容
  const [centerVisited, setCenterVisited] = useState(false);
  useEffect(() => {
    if (view === "center") setCenterVisited(true);
  }, [view]);

  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 返回分层：会员中心视图先回根视图，根视图才关闭弹层
  const handleBackRequest = view === "center" ? () => setView("root") : onClose;
  // 移动端返回键/返回手势
  useModalBackClose(isOpen, handleBackRequest);

  // tab 状态（会员中心内）：关闭弹层后复位到「我的」，但已激活过的 tab 保持挂载（避免商城
  // iframe 与会员数据每次重开都重新加载）；账号切换时全部重置，防止展示上一账号的残留数据
  const [activeTab, setActiveTab] = useState<AccountTab>("my");
  const [visitedTabs, setVisitedTabs] = useState<AccountTab[]>(["my"]);
  useEffect(() => {
    if (!isOpen) {
      setView("root");
      setActiveTab("my");
      // 关闭时复位：下次打开先进入根视图，中心视图内容保持懒挂载（不在隐藏态提前拉取/加载 iframe）
      setCenterVisited(false);
    }
  }, [isOpen]);
  useEffect(() => {
    setView("root");
    setActiveTab("my");
    setVisitedTabs(["my"]);
    setCenterVisited(false);
  }, [user?.id]);

  const activateTab = (tab: AccountTab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
  };

  // WAI-ARIA tabs 键盘模式：左右方向键在 tab 间移动并聚焦（Home/End 可选，暂不启用）
  const handleTabListKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = ACCOUNT_TABS.findIndex((t) => t.key === activeTab);
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = ACCOUNT_TABS[(idx + step + ACCOUNT_TABS.length) % ACCOUNT_TABS.length];
    activateTab(next.key);
    document.getElementById(`account-tab-${next.key}`)?.focus();
  };

  // 移动端形态：底部 Tab 栏（桌面端为顶部胶囊 tab）；用 matchMedia 条件渲染保证按钮 id 唯一
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  // 退出确认框状态：global = 勾选「同时退出所有 NIHPLOD 平台」
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutGlobal, setLogoutGlobal] = useState(false);

  // Escape 分层：确认框打开时优先关确认框，其次会员中心回根视图，最后才关主弹层
  const modalRef = useFocusTrap<HTMLDivElement>(
    isOpen,
    showLogoutConfirm ? () => setShowLogoutConfirm(false) : handleBackRequest
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

  // 会员中心视图使用固定壳尺寸（移动端 86dvh / 桌面端与护肤档案弹层同规格：1100 宽 /
  // min(680, dvh-3rem) 高，内容区独立滚动），避免切换 tab 时弹层高度随内容跳变；
  // 根视图/登录引导保持原有内容自适应样式（窄卡片）
  const shellFixed = !!user && view === "center";

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
              onClick={handleBackdropClick}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* 弹窗主体：移动端底部升起，桌面端居中 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative z-10 w-full ${ACCOUNT_SHELL} overflow-hidden flex flex-col ${
                shellFixed
                  ? "h-[86dvh] sm:h-[min(680px,calc(100dvh-3rem))] sm:max-w-[1100px]"
                  : "sm:max-w-sm max-h-[85vh] sm:max-h-[80vh]"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮：桌面端会员中心视图并入下方顶栏，其余场景悬浮右上角 */}
              {!(shellFixed && !isMobile) && (
                <button
                  onClick={onClose}
                  aria-label="关闭"
                  className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              )}

              {/* 会员中心视图：左上角返回根视图（桌面端并入下方顶栏） */}
              {user && view === "center" && !(shellFixed && !isMobile) && (
                <button
                  onClick={() => setView("root")}
                  aria-label="返回"
                  className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] left-3 sm:top-5 sm:left-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </button>
              )}

              {/* 桌面端固定 tab 栏（会员中心视图）：壳内顶栏（返回 / tab / 关闭），位于滚动区外，
                  不遮挡内容；三组元素在栏内统一垂直居中（items-center） */}
              {shellFixed && !isMobile && (
                <div className="shrink-0 w-full px-6 md:px-8 py-4 border-b border-brand-espresso/[0.08] grid grid-cols-[1fr_auto_1fr] items-center">
                  <button
                    onClick={() => setView("root")}
                    aria-label="返回"
                    className="justify-self-start w-8 h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={16} strokeWidth={2.5} />
                  </button>
                  <div
                    role="tablist"
                    aria-label="会员中心"
                    onKeyDown={handleTabListKeyDown}
                    className="inline-flex rounded-full border border-brand-espresso/[0.12] bg-white p-1"
                  >
                    {ACCOUNT_TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        id={`account-tab-${t.key}`}
                        aria-controls={`account-tabpanel-${t.key}`}
                        aria-selected={activeTab === t.key}
                        tabIndex={activeTab === t.key ? 0 : -1}
                        onClick={() => activateTab(t.key)}
                        className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] transition-colors cursor-pointer ${
                          activeTab === t.key
                            ? "bg-brand-charcoal/[0.08] text-brand-charcoal font-medium"
                            : "text-brand-charcoal/60 hover:text-brand-charcoal"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="关闭"
                    className="justify-self-end w-8 h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              )}

              <div
                data-account-scroll
                className={`flex-1 min-h-0 overflow-y-auto px-6 md:px-8 flex flex-col items-center ${
                  shellFixed && !isMobile
                    ? "pt-3"
                    : "pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10"
                } ${
                  shellFixed && isMobile
                    ? "pb-6"
                    : "pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8"
                }`}
              >
                <h2 id="account-modal-title" className="sr-only">
                  我的账户
                </h2>

                {!user ? (
                  <LoginGuide onNavigateLogin={onClose} />
                ) : (
                  <AccountPanelErrorBoundary>
                    {/* 根视图：轻量入口，常驻挂载（从中心返回时数据即时呈现） */}
                    <m.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={view === "root" ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className={`w-full sm:max-w-md sm:mx-auto flex flex-col items-center ${view === "root" ? "" : "hidden"}`}
                    >
                      <AccountRootView
                        user={user}
                        onClose={onClose}
                        onOpenCenter={() => setView("center")}
                        onRequestLogout={handleLogout}
                      />
                    </m.div>

                    {/* 会员中心视图：首次进入后保持挂载（仅隐藏），iframe/会员数据/折叠状态不重载 */}
                    {centerVisited && (
                      <m.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={view === "center" ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                        transition={{ duration: 0.18 }}
                        className={`w-full flex flex-col items-center ${view === "center" ? "" : "hidden"}`}
                      >
                        {/* tab 面板：首次激活才挂载，之后保持挂载仅隐藏；aria-labelledby 随端切换指向可见 tab */}
                        {visitedTabs.includes("my") && (
                          <div
                            role="tabpanel"
                            id="account-tabpanel-my"
                            aria-labelledby={isMobile ? "account-tab-mobile-my" : "account-tab-my"}
                            hidden={activeTab !== "my"}
                            className="w-full flex flex-col items-center"
                          >
                            {/* 桌面端（lg+）双列：左身份/资料/安全，右会员等级/进度/权益；移动端单列堆叠 */}
                            <div className="w-full grid grid-cols-1 lg:grid-cols-2 lg:gap-10 lg:items-start">
                              <AccountMyTab user={user} onRequestLogin={requestLogin} />
                              <AccountMembershipTab onRequestLogin={requestLogin} />
                            </div>
                          </div>
                        )}
                        {visitedTabs.includes("mall") && (
                          <div
                            role="tabpanel"
                            id="account-tabpanel-mall"
                            aria-labelledby={isMobile ? "account-tab-mobile-mall" : "account-tab-mall"}
                            hidden={activeTab !== "mall"}
                            className="w-full"
                          >
                            <AccountMallTab onClose={onClose} />
                          </div>
                        )}
                      </m.div>
                    )}
                  </AccountPanelErrorBoundary>
                )}
              </div>

              {/* 移动端底部 Tab 栏（会员中心视图）：拇指可达，safe-area 适配 */}
              {shellFixed && isMobile && (
                <nav
                  aria-label="会员中心导航"
                  className="shrink-0 border-t border-brand-espresso/[0.08] bg-[#FDFBF7] px-3 pt-1.5"
                  style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))" }}
                >
                  <div className="grid grid-cols-2">
                    {ACCOUNT_TABS.map((t) => {
                      const Icon = TAB_ICONS[t.key];
                      const active = activeTab === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          id={`account-tab-mobile-${t.key}`}
                          onClick={() => activateTab(t.key)}
                          aria-current={active ? "page" : undefined}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors cursor-pointer ${
                            active ? "text-brand-espresso" : "text-brand-charcoal/45 hover:text-brand-charcoal"
                          }`}
                        >
                          <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                          <span className="text-[11px] leading-none">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </nav>
              )}
            </m.div>

            {/* 退出登录确认框：默认仅退出本站，勾选后同时退出所有 NIHPLOD 平台（global）。
                渲染在 focus-trap 容器内（fixed 定位不受嵌套影响），键盘焦点可达 */}
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
