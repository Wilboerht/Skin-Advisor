"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Loader2, X, Menu, Sparkles, Gift, CircleHelp } from "lucide-react";

import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";

import { useAuthModal } from "@/components/auth/AuthModalContext";
import { CONSENT_VERSION } from "@/components/advisor/PrivacyConsent";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useLazyOpen } from "@/hooks/use-lazy-open";
import { useNavPush } from "@/hooks/use-nav-push";
import dynamic from "next/dynamic";
const OnboardingFlowModal = dynamic(() => import("@/components/advisor/OnboardingFlowModal").then((mod) => mod.OnboardingFlowModal), { ssr: false });
import { HomepageFooter } from "@/components/website/HomepageFooter";
const GiftModal = dynamic(() => import("@/components/website/GiftModal").then((mod) => mod.GiftModal), { ssr: false });
const FaqModal = dynamic(() => import("@/components/website/FaqModal").then((mod) => mod.FaqModal), { ssr: false });
const AccountModal = dynamic(() => import("@/components/website/AccountModal").then((mod) => mod.AccountModal), { ssr: false });

// Safe storage helper to prevent QuotaExceededError or Privacy Mode crashes
const safeStorage = {
  get: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch (e) { console.warn("Failed to write to localStorage", e); }
  },
  remove: (key: string) => {
    try { localStorage.removeItem(key); } catch (e) { console.warn("Failed to remove from localStorage", e); }
  },
  getSession: (key: string) => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  setSession: (key: string, value: string) => {
    try { sessionStorage.setItem(key, value); } catch (e) { console.warn("Failed to write to sessionStorage", e); }
  }
};

/** Ref 归因捕获组件：监听 URL ?ref=xxx，写入 sessionStorage 供 analytics 上报。
 *  独立组件是因 useSearchParams 需要 Suspense 边界（Next.js SSR 要求）。 */
function RefCapture() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = searchParams.get("ref");
    if (ref) {
      safeStorage.setSession("advisor_ref_source", ref);
    }
  }, [searchParams]);
  return null;
}

/** ?gift=1 检测组件：从 /gift 旧链接（308 重定向）或全站"测肤有礼"入口进来时，
 *  自动打开活动弹窗并清理 URL。独立组件是因 useSearchParams 需要 Suspense 边界。 */
function GiftParamDetector({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams.get("gift") === "1") {
      onOpen();
      router.replace("/", { scroll: false });
    }
  }, [searchParams, onOpen, router]);
  return null;
}

/** ?start=1 检测组件：从站外页面（如 /skin-types 活动弹窗）点"开始测肤"进来时，
 *  自动拉起与首页 CTA 完全相同的 handleStart 流程（限额检查 → 隐私授权），并清理 URL。
 *  firedRef 防 StrictMode 双跑导致重复触发。 */
function StartParamDetector({ onStart }: { onStart: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || firedRef.current) return;
    if (searchParams.get("start") === "1") {
      firedRef.current = true;
      router.replace("/", { scroll: false });
      onStart();
    }
  }, [searchParams, onStart, router]);
  return null;
}

// Region options
const regionOptions = [
  { group: "华北/东北", regions: ["北京", "天津", "河北", "山西", "内蒙古", "黑龙江", "吉林", "辽宁"] },
  { group: "华东", regions: ["上海", "江苏", "浙江", "山东", "安徽", "江西"] },
  { group: "华南", regions: ["广东", "广西", "海南", "福建", "台湾", "香港", "澳门"] },
  { group: "华中/西南", regions: ["湖北", "湖南", "河南", "四川", "重庆", "贵州", "云南"] },
  { group: "西北", regions: ["陕西", "甘肃", "宁夏", "新疆"] },
  { group: "高原", regions: ["西藏", "青海"] },
  { group: "海外", regions: ["其它"] },
];

export default function HomeClient() {
  // 预取问卷页路由，点击跳转近乎即时；isNavigating 用于 CTA 按钮禁用/反馈
  // （不再使用 next-view-transitions 的 useTransitionRouter：iOS 18.2+ 上 view transition 快照会冻结 loading 画面）
  const { push: navPush, isPending: isNavigating } = useNavPush(["/questions"]);
  const { openAuthModal } = useAuthModal();
  const [isLoading, setIsLoading] = useState(false);
  const { initSession } = useAdvisorAnalytics();
  const { user, refresh: refreshUser } = useAuth();

  const prefersReducedMotion = useReducedMotion();

  // Initialize session
  useEffect(() => {
    initSession();
  }, [initSession]);

  // 首页一屏布局含米色底部栏：给 body 打标，CSS 中据此上浮 Dock 避开底部栏（卸载时还原）
  useEffect(() => {
    document.body.classList.add("home-dock-raised");
    return () => document.body.classList.remove("home-dock-raised");
  }, []);

  // Capture ref parameter: moved to <RefCapture /> rendered in JSX (useSearchParams needs Suspense boundary)

  // 首页为一屏布局（h-dvh 不滚动），无需整页锁定 body 滚动；
  // 限额弹窗的滚动锁在其 state 声明后单独处理

  // Nickname state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  // 测肤有礼活动弹窗（替代原独立 /gift 页面）
  const [showGiftModal, setShowGiftModal] = useState(false);
  // 「我的」账户弹层：游客点击「立即开始」时打开其未登录视图（与 Dock「我的」一致）
  const [showAccountModal, setShowAccountModal] = useState(false);
  // 活动弹窗入口防抖：250ms 内忽略重复打开（前缘节流，双击第二下会被遮罩防误触拦截）
  const giftLastOpenRef = useRef(0);
  const openGiftModal = useCallback(() => {
    const now = Date.now();
    if (now - giftLastOpenRef.current < 250) return;
    giftLastOpenRef.current = now;
    setShowGiftModal(true);
  }, []);
  // FAQ 模态框（首页"常见问题"描边胶囊入口）
  const [showFaqModal, setShowFaqModal] = useState(false);
  // 顶栏汉堡菜单（测肤有礼 / 常见问题 / 了解肌智派入口收纳其中）
  const [showMenu, setShowMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [nickname, setNickname] = useState("");
  const [isHomeExiting, setIsHomeExiting] = useState(false);

  // 弹窗懒加载 latch：首次打开前不渲染 dynamic 组件（chunk 不下载），打开过后保持挂载以保留退场动画
  const shouldRenderAccount = useLazyOpen(showAccountModal);
  const shouldRenderGift = useLazyOpen(showGiftModal);
  const shouldRenderFaq = useLazyOpen(showFaqModal);
  const shouldRenderOnboarding = useLazyOpen(showOnboardingModal);

  // 防止用户在 checkTestLimit 进行过程中关闭弹窗后，异步回调又重新打开弹窗
  const startCancelledRef = useRef(false);

  // FAQ 入口防抖：打开后 250ms 内忽略重复点击——双击第二下会落在弹层遮罩上导致"秒关"，
  // 前缘节流不延迟首次响应
  const faqLastOpenRef = useRef(0);
  const handleOpenFaq = () => {
    const now = Date.now();
    if (now - faqLastOpenRef.current < 250) return;
    faqLastOpenRef.current = now;
    setShowFaqModal(true);
  };

  useEffect(() => {
    if (!showMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowMenu(false);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showMenu]);

  // Location/Region states
  const [isLocating, setIsLocating] = useState(false);
  const locationRequestId = useRef(0);

  // Region options moved outside component

  /* --- Handlers --- */

  const startNewTest = useCallback(() => {
    // Clear previous advisor state to ensure fresh start
    safeStorage.remove(STORAGE_KEYS.ADVISOR_ANSWERS);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_GENDER);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_FACE_IMAGES);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_RESULT);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_FREE_RETRY);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_STEP);
    // 保留 ADVISOR_NICKNAME：昵称是用户资料而非本次测试数据，清空会导致结果页显示"您"
    // 若当前没有保存昵称且用户已登录，自动回填 user.name
    if (user?.name && !safeStorage.get(STORAGE_KEYS.ADVISOR_NICKNAME)) {
      safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, user.name);
    }

    // 修复 iOS 从首页 modal 进入 questions 页面时滚动位置异常：
    // 跳转前恢复 body overflow 并把页面滚动重置到顶部
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";

      // 临时禁用平滑滚动，确保 scrollTo(0,0) 立即生效，不会被动画中断
      const html = document.documentElement;
      const originalScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      html.style.scrollBehavior = originalScrollBehavior;
    }
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }

    setIsLoading(true);
    navPush("/questions");
  }, [navPush, user]);

  const handleLocationAccept = async () => {
    setIsLocating(true);
    const requestId = ++locationRequestId.current;
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
          });
        });

        // Ignore stale result if user has already moved past the location step
        if (requestId !== locationRequestId.current) {
          return;
        }

        safeStorage.set("userRegion", JSON.stringify({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }));
        safeStorage.setSession("locationConsent", "granted");
        setIsLocating(false);
      } catch (error) {
        console.warn("Geolocation failed", error);
        setIsLocating(false);
        throw error; // Let OnboardingFlowModal handle the fallback
      }
    } else {
      setIsLocating(false);
      throw new Error("No geolocation support");
    }
  };

  const handleRegionSelect = (region: string) => {
    locationRequestId.current += 1;
    safeStorage.setSession("locationConsent", "granted");
    safeStorage.set("userRegion", JSON.stringify({ province: region, city: region }));
    // Do not close or start test here, let legal step handle it
  };

  const handleSkipRegionSelect = () => {
    // This is now repurposed as the FINAL completion handler from the Legal step
    locationRequestId.current += 1;
    setShowOnboardingModal(false);
    setIsLoading(true);
    
    // Ensure consent is recorded if not already set by location/region steps
    if (!safeStorage.getSession("locationConsent")) {
        safeStorage.setSession("locationConsent", "declined");
    }

    // Record privacy consent from the legal step
    safeStorage.set(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT, JSON.stringify({
        version: CONSENT_VERSION,
        consentedAt: new Date().toISOString()
    }));

    // 最终提交前确保昵称已保存：用户填写优先，否则已登录用户回退到官网昵称
    if (nickname.trim()) {
      safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, nickname.trim());
    } else if (user?.name && !safeStorage.get(STORAGE_KEYS.ADVISOR_NICKNAME)) {
      safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, user.name);
    }
    
    startNewTest();
  };

  const handleLocationDecline = () => {
    // Declining loc will naturally open Region Select, but handled by OnboardingFlowModal now implicitly via callback
    locationRequestId.current += 1;
    safeStorage.setSession("locationConsent", "declined");
  };

  // Test limit state（与 /api/advisor/test-limit 返回结构对齐）
  const [testLimitInfo, setTestLimitInfo] = useState<{
    canTest: boolean;
    dailyLimit: number;
    remaining: number;
    quotaPeriod?: 'day' | 'lifetime';
    isGuest?: boolean;
    error?: string | null;
    /** 游客拒绝时后端置 true：测肤需登录，弹层展示登录引导而非次数信息 */
    requireLogin?: boolean;
    message?: string | null;
  } | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  // 限额弹窗打开时锁定背景滚动（整页锁定已随改版移除）
  useBodyScrollLock({ enabled: showLimitModal, iosSafe: true });
  // 限额弹窗焦点圈定 + Escape 关闭
  const limitModalRef = useFocusTrap<HTMLDivElement>(showLimitModal, () => setShowLimitModal(false));
  const [onboardingOpenCount, setOnboardingOpenCount] = useState(0);

  // Check test limit（后端按登录态判额，无需前端指纹参数）
  // 返回完整判定而非仅 boolean：requireLogin 必须取接口返回值，
  // 不能读 testLimitInfo state（setState 异步，handleStart 拿到的仍是旧值）
  const checkTestLimit = useCallback(async (
    allowRefresh = true
  ): Promise<{ canTest: boolean; requireLogin?: boolean }> => {
    const runCheck = async (canRefresh: boolean): Promise<{ canTest: boolean; requireLogin?: boolean }> => {
      try {
        const res = await fetch(`/api/advisor/test-limit`);
        if (!res.ok) {
          const errorText = await res.text().catch(() => "未知错误");
          console.error("Test limit check failed:", res.status, errorText);
          return { canTest: true }; // Allow on error so the user is not blocked by a transient server issue
        }

        const data = await res.json();
        setTestLimitInfo(data);

        // 前端认为已登录但后端按游客处理时，可能 JWT 已失效，
        // 刷新用户态后重试一次。
        if (user && data.isGuest && canRefresh) {
          console.warn("[Auth Mismatch] Frontend has user but backend returned guest. Refreshing session...");
          await refreshUser();
          return runCheck(false);
        }

        return { canTest: !!data.canTest, requireLogin: !!data.requireLogin };
      } catch (err) {
        console.error("Failed to check test limit:", err);
        return { canTest: true }; // Allow on error so the user is not blocked by a transient network issue
      }
    };

    return runCheck(allowRefresh);
  }, [user, refreshUser]);


  // 防重复触发：限额检查是异步的，等待期间按钮仍可点，快速双击会并发跑两遍流程
  const startingRef = useRef(false);

  const handleStart = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    startCancelledRef.current = false;

    try {
      // Check test limit first
      const limit = await checkTestLimit();

      // 用户在等待限额检查时已主动关闭弹窗/返回首页：中止后续流程并清理 loading 状态
      if (startCancelledRef.current) {
        return;
      }

      if (!limit.canTest) {
        // 需登录：打开「我的」账户弹层的未登录视图（紧凑卡片 + LoginGuide），
        // 与 Dock「我的」/护肤档案未登录态保持全站一致；不再使用整屏 AuthModal 面板
        if (limit.requireLogin) {
          setShowAccountModal(true);
          return;
        }
        setShowLimitModal(true);
        return;
      }

      // 用户在 checkTestLimit 完成后、打开弹窗前又关闭了：清理状态并中止
      if (startCancelledRef.current) {
        return;
      }

      // If user is logged in and has a name, pre-fill it and let the modal handle skipping the step
      if (user?.name) {
        setNickname(user.name);
        safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, user.name);
      }
      setIsHomeExiting(true);
      if (!showOnboardingModal) {
        setOnboardingOpenCount(prev => prev + 1);
      }
      setShowOnboardingModal(true);
    } finally {
      startingRef.current = false;
    }
  }, [checkTestLimit, user, showOnboardingModal]);

  const handleNicknameSubmit = () => {
    if (!nickname.trim()) {
      return;
    }
    // Save nickname to localStorage
    safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, nickname.trim());
  };



  return (
    <LazyMotion features={domAnimation}>
      <Suspense fallback={null}>
        <RefCapture />
        <GiftParamDetector onOpen={openGiftModal} />
        <StartParamDetector onStart={handleStart} />
      </Suspense>

      {/* Full Screen Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#FDFBF7] flex flex-col items-center justify-center"
          >
            <Loader2 className="w-10 h-10 text-[var(--color-brand-charcoal)] animate-spin mb-6" />
            <p className="text-brand-charcoal/70 text-[15px] font-medium tracking-wide">即将进入 AI 问卷...</p>
          </m.div>
        )}
      </AnimatePresence>

      {/* 顶部栏（设计稿版式）：左蓝色汉堡按钮 + 中肌智派徽章（相对顶栏整体居中）+ 右 NIHPLOD logo；
          淡奶油底固定定位（与底部栏同色），汉堡内收纳测肤有礼 / 常见问题 / 了解肌智派入口 */}
      <header className="fixed inset-x-0 top-0 z-40 bg-[#FBF9F3] border-b border-black/[0.06]">
        <div className="relative flex items-center justify-between">
          {/* 左：汉堡按钮（宽度与右侧 logo 区一致：logo 96/128 + 右内边距 16/32 = 112/160） */}
          <button
            type="button"
            ref={menuButtonRef}
            onClick={() => setShowMenu((v) => !v)}
            aria-label={showMenu ? "关闭菜单" : "打开菜单"}
            aria-expanded={showMenu}
            aria-controls="home-menu"
            className="relative z-50 flex h-[72px] w-28 md:h-[88px] md:w-40 items-center justify-center bg-[#5B7CAE] text-white transition-colors hover:bg-[#4E6C9C] active:bg-[#476390] cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CAE]/50 focus-visible:ring-offset-2"
          >
            {showMenu ? <X className="w-6 h-6" strokeWidth={2} /> : <Menu className="w-6 h-6" strokeWidth={2} />}
          </button>
          {/* 中：肌智派徽章，绝对定位相对顶栏整体居中，不受左右两侧宽度影响 */}
          <Link href="/" aria-label="回到首页" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center" onClick={() => setShowMenu(false)}>
            <Image
              src="/images/jzp-eyebrow.png"
              alt="肌智派"
              width={256}
              height={156}
              sizes="(min-width: 768px) 112px, 88px"
              className="h-14 md:h-[68px] w-auto object-contain"
              priority
            />
          </Link>
          {/* 右：NIHPLOD 品牌 logo（容器定宽与左侧汉堡按钮一致，左右对称） */}
          <div className="w-28 md:w-40 pr-4 md:pr-8 flex items-center justify-end select-none">
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={30}
              sizes="(min-width: 768px) 120px, 96px"
              className="h-6 md:h-8 w-auto object-contain"
              priority
            />
          </div>

          {/* 汉堡下拉菜单：遮罩点击关闭 */}
          <AnimatePresence>
            {showMenu && (
              <m.div
                key="menu-backdrop"
                aria-hidden="true"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowMenu(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
              />
            )}
            {showMenu && (
              <m.div
                key="menu-panel"
                id="home-menu"
                className="absolute left-3 md:left-5 top-[calc(100%+8px)] z-50 w-60 origin-top rounded-2xl border border-black/[0.06] bg-white p-2 shadow-[0_16px_40px_-12px_rgba(0,38,62,0.25)]"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); openGiftModal(); }}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-brand-charcoal transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <Gift className="w-4 h-4 text-brand-bronze" strokeWidth={1.75} />
                  测肤有礼 · 参与赢好礼
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); handleOpenFaq(); }}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-brand-charcoal transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <CircleHelp className="w-4 h-4 text-brand-charcoal/70" strokeWidth={1.75} />
                  常见问题
                </button>
                <Link
                  href="/skin-types"
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-brand-charcoal transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08]"
                >
                  <Sparkles className="w-4 h-4 text-brand-charcoal/70" strokeWidth={1.75} />
                  了解肌智派
                </Link>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* 内容区域 - 一屏布局：顶栏 + Hero + 米色底部栏恰好一屏，Dock 悬浮于 Hero 蓝色区域之上；
          矮屏/横屏放不下时页面可滚动兜底 */}
      <m.div
        className="home-shell relative z-20 flex flex-col min-h-dvh"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={isHomeExiting ? (prefersReducedMotion ? { opacity: 0 } : { y: "-100%" }) : { opacity: 1, scale: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      >
          {/* 首屏 Hero（设计稿版式）：米白上区 + 蓝灰波浪下区，左右 IP 形象夹峙中央文案。
              男性 IP 置于波浪层之下（下身没入蓝色区域），女性 IP 立于波浪层之上、裙摆抵到底部栏 */}
          <div className="relative flex flex-1 flex-col w-full overflow-hidden bg-[#EFE9DA]">
            {/* 左侧男性 IP（极简派 · 手持几何晶体）：移动端空间不足时隐藏 */}
            <m.div
              aria-hidden="true"
              className="absolute z-10 left-[2%] lg:left-[5%] bottom-[34%] hidden md:block"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
            >
              <Image
                src="/images/character/minimalist/minimalist_male.webp"
                alt=""
                width={960}
                height={1280}
                sizes="(min-width: 1024px) 34vw, 26vw"
                className="h-[44vh] lg:h-[58vh] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,38,62,0.16)]"
                priority
              />
            </m.div>

            {/* 波浪分界：米白 → 蓝灰，缓弧自左向右微微上扬。
                蓝色面积 ≈ 内容区的 48%：曲线平均上缘约在 SVG 内 20% 深处（蓝色占 SVG 的 79.7%），
                SVG 高 60% × 79.7% ≈ 48% */}
            <svg
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 z-20 h-[60%] w-full"
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
            >
              <path
                d="M0,84 C240,56 480,100 720,72 C960,44 1200,60 1440,32 L1440,320 L0,320 Z"
                fill="#93A5BE"
              />
            </svg>

            {/* 右侧女性 IP（沙漠派 · 金发蓝缕捧水滴）：立于波浪之上，下身抵底部栏 */}
            <m.div
              aria-hidden="true"
              className="absolute z-30 -right-[6%] md:right-[1%] lg:right-[4%] bottom-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.3, duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
            >
              <Image
                src="/images/character/desert/desert_female.webp"
                alt=""
                width={960}
                height={1280}
                sizes="(min-width: 1024px) 32vw, 44vw"
                className="h-[36vh] md:h-[60vh] lg:h-[76vh] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,38,62,0.18)]"
                priority
              />
            </m.div>

            {/* 中央文案：按色块分区放置——文字（主标题 + 副标题含蓝色问号 = 常见问题）在米色区居中，
                CTA 按钮（硬投影白胶囊）在蓝色区居中。波浪最高点约在内容区 46% 高处，文字区取上 44%，按钮区取剩余 56% */}
            <section className="relative z-40 mx-auto flex flex-1 w-full flex-col items-center px-6 text-center">
              {/* 文字区：米色区域（上 44%）垂直居中 */}
              <div className="flex h-[44%] flex-col items-center justify-center opacity-0 animate-fade-in-up">
                <h1 className="leading-[1.12]">
                  <span className="block -mr-[0.1em] text-[54px] md:text-[80px] lg:text-[96px] font-bold tracking-[0.1em] text-[#2E4D9E]">觉醒</span>
                  <span className="block mt-1.5 md:mt-2">
                    <span className="relative inline-flex items-center justify-center -mr-[0.14em] text-[26px] md:text-[38px] lg:text-[44px] font-medium tracking-[0.14em] text-[#1c1c1c]">
                      你的肌肤派系
                      <button
                        type="button"
                        onClick={handleOpenFaq}
                        aria-label="常见问题"
                        aria-haspopup="dialog"
                        aria-expanded={showFaqModal}
                        className="absolute left-full top-[calc(50%+0.05em)] -translate-y-1/2 ml-1 md:ml-2 inline-flex w-6 h-6 md:w-8 md:h-8 items-center justify-center rounded-full bg-[#2E4D9E] text-white transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none cursor-pointer touch-manipulation before:absolute before:inset-0 before:content-[''] max-md:before:-inset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/50 focus-visible:ring-offset-2"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-[18px] h-[18px] md:w-[22px] md:h-[22px]"
                        >
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <path d="M12 17h.01" />
                        </svg>
                      </button>
                    </span>
                  </span>
                </h1>
                <p className="mt-4 md:mt-6 text-[13px] md:text-[16px] leading-[1.9] tracking-[0.05em] text-[#84817a]">
                  获得专业的面部分析报告
                  <br />
                  您口袋里的专属的护肤管家
                </p>
              </div>
              {/* CTA 区：蓝色区域（下 56%）垂直居中 */}
              <div className="flex flex-1 flex-col items-center justify-center opacity-0 animate-fade-in-up">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={isLoading || isNavigating}
                  className="inline-flex items-center justify-center gap-2 h-12 md:h-14 px-10 md:px-12 rounded-full bg-white border border-[#22304E]/10 text-[#22304E] text-[16px] md:text-[18px] font-bold tracking-[0.18em] shadow-[4px_5px_0_0_rgba(34,48,78,0.85)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_3px_0_0_rgba(34,48,78,0.85)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isLoading ? "正在连接" : "立刻体验"}</span>
                </button>
              </div>
            </section>
          </div>

          {/* 底部栏：淡奶油色通栏（比 Hero 上区的米色更浅），并入首屏；内容全宽，备案居左、链接与版权居右 */}
          <div className="relative z-40 bg-[#FBF9F3]">
            <div className="w-full px-6 lg:px-10 h-16 md:h-14 flex items-center">
              <HomepageFooter />
            </div>
          </div>
        </m.div>

      {/* "测肤有礼"入口已收纳进顶栏汉堡菜单，不再使用右下角悬浮卡片 */}

      {/* Modals：首次打开才加载对应 chunk（见上方 shouldRender* latch） */}
      {shouldRenderAccount && (
        <AccountModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
      )}
      {shouldRenderGift && (
        <GiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          onStartTest={() => {
            setShowGiftModal(false);
            handleStart();
          }}
        />
      )}
      {shouldRenderFaq && (
        <FaqModal
          isOpen={showFaqModal}
          onClose={() => setShowFaqModal(false)}
        />
      )}
      {shouldRenderOnboarding && (
        <OnboardingFlowModal
          key={onboardingOpenCount}        isOpen={showOnboardingModal}
          onClose={() => {
            // 标记用户已主动取消，防止 handleStart 中待完成的异步回调重新打开弹窗或恢复 loading
            startCancelledRef.current = true;
            setShowOnboardingModal(false);
            setIsLoading(false);
            setIsHomeExiting(false);
          }}
          nickname={nickname}
          setNickname={setNickname}
          onNicknameSubmit={handleNicknameSubmit}
          isLocating={isLocating}
          onLocationAccept={handleLocationAccept}
          onLocationDecline={handleLocationDecline}
          onSkipLocation={handleSkipRegionSelect}
          onRegionSelect={handleRegionSelect}
          regionOptions={regionOptions}
          isLoggedIn={!!user}
        />
      )}

      <AnimatePresence>
        {showLimitModal && (
          <div
            ref={limitModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="limit-modal-title"
            tabIndex={-1}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
          >
            {/* Backdrop with Blur */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLimitModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* Modal Content */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-[420px] bg-[#FDFBF7] rounded-[28px] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Close Button：与全站弹层规范一致（移动端 44px 触达） */}
              <button
                onClick={() => setShowLimitModal(false)}
                aria-label="关闭"
                className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors cursor-pointer"
              >
                <X size={16} strokeWidth={2.5} />
              </button>

              {/* Header */}
              <div className="p-10 pt-14 text-center pb-2">
                <div className="mb-7 flex justify-center">
                  <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={136}
                    height={34}
                    className="h-[34px] w-auto object-contain"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="px-10 pb-10 pt-2 flex flex-col items-center gap-6">
                <div className="text-center space-y-2">
                  <h2 id="limit-modal-title" className="text-base font-semibold text-brand-charcoal">
                    {testLimitInfo?.quotaPeriod === 'lifetime' ? '免费测肤次数已用完' : '今日测试次数已用完'}
                  </h2>
                  <p className="text-sm leading-relaxed text-brand-charcoal/75">
                    {(() => {
                      const info = testLimitInfo;
                      const dailyLimit = info?.dailyLimit ?? 10;
                      const remaining = info?.remaining ?? 0;
                      // 被封禁/限制但仍有剩余次数：展示限制原因而非次数信息
                      if (remaining > 0) {
                        return <>{info?.error || "当前暂时无法开始测肤，请稍后再试"}</>;
                      }
                      if (info?.quotaPeriod === 'lifetime') {
                        return (
                          <>
                            免费测肤次数已用完（共 {dailyLimit} 次）
                            <br />升级金卡会员，享不限次测肤
                          </>
                        );
                      }
                      return (
                        <>
                          今日测试次数已用完（共 {dailyLimit} 次）
                          {!user && (
                            <><br />注册即享 10 次免费测肤，会员升级可获更多次数，金卡及以上不限次</>
                          )}
                        </>
                      );
                    })()}
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  {!user && (
                    <button
                      onClick={() => {
                        setShowLimitModal(false);
                        openAuthModal('login');
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-charcoal)] py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95 hover:bg-[var(--color-brand-charcoal)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 cursor-pointer"
                    >
                      登录 / 注册
                    </button>
                  )}
                  <button
                    onClick={() => setShowLimitModal(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-charcoal/15 bg-white py-3 text-sm font-medium text-brand-charcoal transition-colors hover:bg-brand-charcoal/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 cursor-pointer"
                  >
                    我知道了
                  </button>
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

    </LazyMotion>
  );
}
