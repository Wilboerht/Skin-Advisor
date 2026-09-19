"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useModalBackClose } from "@/hooks/use-modal-back-close";
import { LoginGuide } from "@/components/website/LoginGuide";
import { AccountRootView } from "@/components/website/AccountRootView";
import { AccountMyTab } from "@/components/website/AccountMyTab";
import { AccountMembershipTab } from "@/components/website/AccountMembershipTab";
import { AccountMallTab } from "@/components/website/AccountMallTab";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AccountTab = "my" | "membership" | "mall";

const ACCOUNT_TABS: { key: AccountTab; label: string }[] = [
  { key: "my", label: "我的" },
  { key: "membership", label: "会员" },
  { key: "mall", label: "积分商城" },
];

/**
 * AccountModal — 用户面板弹层（替代原 /profile 独立页），两级视图：
 * 根视图（最早样式）：身份展示 +「护肤档案」「会员中心」两个入口 + 退出登录；
 * 会员中心视图：「我的 / 会员 / 积分商城」三个 tab（我的=资料可编辑走 BFF、
 * 会员=等级权益 /api/account/membership、积分商城=官网 embed iframe），
 * 根视图 ⇄ 会员中心 淡入淡出切换，会员中心内返回键/Escape 先回根视图。
 * 未登录：登录引导视图，点击按钮走 SSO 统一登录。
 * 容器/动效/关闭按钮与 GiftModal 等全站模态框对齐。
 */
export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { user, logout } = useAuth();

  // 两级视图：root = 根视图（简洁入口），center = 会员中心（三个 tab）
  const [view, setView] = useState<"root" | "center">("root");

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
    }
  }, [isOpen]);
  useEffect(() => {
    setView("root");
    setActiveTab("my");
    setVisitedTabs(["my"]);
  }, [user?.id]);

  const activateTab = (tab: AccountTab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
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

  const handleLogoutConfirm = async () => {
    const global = logoutGlobal;
    setShowLogoutConfirm(false);
    onClose();
    // logout 内部已完成整页跳转，无需再处理路由
    await logout({ global });
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
              onClick={handleBackdropClick}
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
                className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>

              {/* 会员中心视图：左上角返回根视图 */}
              {user && view === "center" && (
                <button
                  onClick={() => setView("root")}
                  aria-label="返回"
                  className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] left-3 sm:top-5 sm:left-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </button>
              )}

              <div className="max-h-[85vh] sm:max-h-[80vh] overflow-y-auto px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8 flex flex-col items-center">
                <h2 id="account-modal-title" className="sr-only">
                  我的账户
                </h2>

                {!user ? (
                  <LoginGuide onNavigateLogin={onClose} />
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    {view === "root" ? (
                      <m.div
                        key="root"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="w-full flex flex-col items-center"
                      >
                        <AccountRootView
                          user={user}
                          onClose={onClose}
                          onOpenCenter={() => setView("center")}
                          onRequestLogout={handleLogout}
                        />
                      </m.div>
                    ) : (
                      <m.div
                        key="center"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="w-full flex flex-col items-center"
                      >
                        {/* tab 栏：胶囊分段（与全站 tabs 规范一致） */}
                        <div
                          role="tablist"
                          aria-label="会员中心"
                          className="inline-flex rounded-full border border-brand-espresso/[0.12] bg-white p-1 mb-6"
                        >
                          {ACCOUNT_TABS.map((t) => (
                            <button
                              key={t.key}
                              type="button"
                              role="tab"
                              aria-selected={activeTab === t.key}
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

                        {/* tab 面板：首次激活才挂载，之后保持挂载仅隐藏 */}
                        {visitedTabs.includes("my") && (
                          <div role="tabpanel" hidden={activeTab !== "my"} className="w-full flex flex-col items-center">
                            <AccountMyTab user={user} />
                          </div>
                        )}
                        {visitedTabs.includes("membership") && (
                          <div role="tabpanel" hidden={activeTab !== "membership"} className="w-full">
                            <AccountMembershipTab />
                          </div>
                        )}
                        {visitedTabs.includes("mall") && (
                          <div role="tabpanel" hidden={activeTab !== "mall"} className="w-full">
                            <AccountMallTab onClose={onClose} />
                          </div>
                        )}
                      </m.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
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
              className="relative z-10 w-full max-w-xs bg-[#FDFBF7] rounded-[24px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] px-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="logout-confirm-title" className="text-base font-semibold text-[#1A1A1A] mb-2">
                退出登录
              </h3>
              <p className="text-[13px] font-light text-[#6B5E50] leading-relaxed mb-4">
                默认仅退出本站；勾选后将同时退出主站及所有 NIHPLOD 平台。
              </p>
              <label className="flex items-center gap-2 mb-6 cursor-pointer select-none text-[13px] text-[#5E5E5E] tracking-[0.03em]">
                <input
                  type="checkbox"
                  checked={logoutGlobal}
                  onChange={(e) => setLogoutGlobal(e.target.checked)}
                  className="w-4 h-4 accent-[#3D4430]"
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
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-[13px] tracking-[0.05em] hover:bg-red-700 transition-colors cursor-pointer"
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
