"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Loader2, X, Menu, Sparkles, Gift, CircleHelp, House } from "lucide-react";

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
const SkinTypesModal = dynamic(() => import("@/components/website/SkinTypesModal").then((mod) => mod.SkinTypesModal), { ssr: false });

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

/** ?start=1 检测组件：从站外页面（如活动弹窗）点"开始测肤"进来时，
 *  自动拉起与首页 CTA 完全相同的 handleStart 流程（限额检查 → 隐私授权），并清理 URL。
 *  firedRef 防 StrictMode 双跑导致重复触发。
 *  authReady（会话初始化完成）前不触发：刚登录回跳时 /api/auth/me 尚未落地，
 *  立即触发会让 handleStart 拿 user=null 的旧快照把已登录用户误判成游客。 */
function StartParamDetector({ onStart, authReady }: { onStart: () => void; authReady: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || firedRef.current || !authReady) return;
    if (searchParams.get("start") === "1") {
      firedRef.current = true;
      router.replace("/", { scroll: false });
      onStart();
    }
  }, [searchParams, onStart, router, authReady]);
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
  const { user, isInitialized, refresh: refreshUser } = useAuth();

  // 最新登录态镜像：handleStart/checkTestLimit 的异步流程跨越多个 await，
  // 闭包里的 user 可能仍是点击时的旧快照（刚登录回跳时 /api/auth/me 尚未落地），
  // 决策点必须读 ref 里的最新值，否则会把已登录用户误判成游客走昵称流程
  const userRef = useRef(user);
  const isInitializedRef = useRef(isInitialized);
  useEffect(() => {
    userRef.current = user;
    isInitializedRef.current = isInitialized;
  }, [user, isInitialized]);

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
  // 顶栏汉堡菜单（收纳测肤有礼 / 常见问题 / 了解肌智派入口）
  const [showMenu, setShowMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // 了解肌智派弹窗（替代原 /skin-types 独立页）
  const [showSkinTypesModal, setShowSkinTypesModal] = useState(false);
  const [nickname, setNickname] = useState("");
  const [isHomeExiting, setIsHomeExiting] = useState(false);

  // 引导流程弹窗（称呼/位置/隐私三步）打开期间隐藏底部 Dock（卸载时兜底还原）
  useEffect(() => {
    document.body.classList.toggle("home-modal-open", showOnboardingModal);
    return () => document.body.classList.remove("home-modal-open");
  }, [showOnboardingModal]);

  // 兜底自愈：极端情况下弹窗已按游客流程打开（如 /api/auth/me 初次请求 429/超时，
  // user 保持 null），之后登录态由定时续期/visibilitychange 落地时，
  // 回填昵称让昵称屏自动收起（OnboardingFlowModal 会据 isLoggedIn/nickname 重算屏幕）。
  // 用户已手动输入昵称时不覆盖
  useEffect(() => {
    if (showOnboardingModal && user?.name && !nickname.trim()) {
      setNickname(user.name);
      safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, user.name);
    }
  }, [showOnboardingModal, user, nickname]);

  // 弹窗懒加载 latch：首次打开前不渲染 dynamic 组件（chunk 不下载），打开过后保持挂载以保留退场动画
  const shouldRenderAccount = useLazyOpen(showAccountModal);
  const shouldRenderGift = useLazyOpen(showGiftModal);
  const shouldRenderFaq = useLazyOpen(showFaqModal);
  const shouldRenderOnboarding = useLazyOpen(showOnboardingModal);
  const shouldRenderSkinTypes = useLazyOpen(showSkinTypesModal);

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

  const openSkinTypesModal = () => {
    setShowSkinTypesModal(true);
  };

  const openSkinTypesModalFromMenu = () => {
    setShowMenu(false);
    // 菜单项随菜单卸载，先把焦点还给汉堡按钮，弹层关闭后焦点才能正确归还
    menuButtonRef.current?.focus({ preventScroll: true });
    setShowSkinTypesModal(true);
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
        // 刷新用户态后重试一次。（读 userRef 最新值而非闭包快照）
        if (userRef.current && data.isGuest && canRefresh) {
          console.warn("[Auth Mismatch] Frontend has user but backend returned guest. Refreshing session...");
          await refreshUser();
          return runCheck(false);
        }

        // 反向错配：前端还是游客快照但后端识别为已登录（刚登录回跳后
        // /api/auth/me 尚未落地），刷新用户态后重试一次，
        // 避免已登录用户被当游客走昵称/隐私授权流程
        if (!userRef.current && !data.isGuest && canRefresh) {
          console.warn("[Auth Mismatch] Backend has session but frontend user not ready. Refreshing session...");
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
  }, [refreshUser]);


  // 防重复触发：限额检查是异步的，等待期间按钮仍可点，快速双击会并发跑两遍流程
  const startingRef = useRef(false);

  const handleStart = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    startCancelledRef.current = false;

    try {
      // 会话未初始化（如刚登录回跳、/api/auth/me 仍在途）时先等其完成：
      // refresh 有单飞机制，会并入挂载时发起的同一次请求，不产生额外流量。
      // 否则后续的登录态判断会拿 user=null 的旧快照，把已登录用户误判成游客
      if (!isInitializedRef.current) {
        await refreshUser();
      }

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

      // 决策点读最新登录态（前面 await 期间 /api/auth/me 可能刚落地），
      // 而非点击时的闭包快照；已登录且有名字时回填昵称，弹窗据此跳过昵称屏
      const latestUser = userRef.current;
      if (latestUser?.name) {
        setNickname(latestUser.name);
        safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, latestUser.name);
      }
      setIsHomeExiting(true);
      if (!showOnboardingModal) {
        setOnboardingOpenCount(prev => prev + 1);
      }
      setShowOnboardingModal(true);
    } finally {
      startingRef.current = false;
    }
  }, [checkTestLimit, refreshUser, showOnboardingModal]);

  const handleNicknameSubmit = () => {
    if (!nickname.trim()) {
      return;
    }
    // Save nickname to localStorage
    safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, nickname.trim());
  };

  // Hero CTA 组合（主按钮 + 「测肤有礼」入口）：由 <1440px 文字流与 ≥1440px 绝对定位区共用，
  // 两处容器互斥显示，避免样式漂移；
  // 「测肤有礼」保持文字链风格：移动端用品牌深蓝 #00263E（米色底），≥1440px 沿用蓝区白字
  const heroCta = (
    <>
      <button
        type="button"
        onClick={handleStart}
        disabled={isLoading || isNavigating}
        className="relative inline-flex items-center justify-center gap-2 h-12 min-[1440px]:h-14 px-10 min-[1440px]:px-12 rounded-full bg-white border border-[#22304E]/10 text-[#22304E] text-[16px] min-[1440px]:text-[18px] font-bold tracking-[0.18em] shadow-[4px_5px_0_0_rgba(34,48,78,0.85)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_3px_0_0_rgba(34,48,78,0.85)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {/* FREE 角标：按钮子元素，随按钮悬浮/点按位移一起动；纯装饰，不拦截点击。
            移动端 32px 骑角：-top-4/-right-4（两轴各露一半），≥1440px 保持 48px */}
        <Image
          src="/images/free.png"
          alt=""
          aria-hidden="true"
          width={512}
          height={512}
          className="absolute -top-4 -right-4 min-[1440px]:-top-6 min-[1440px]:-right-5 w-8 min-[1440px]:w-12 h-auto rotate-12 pointer-events-none select-none drop-shadow-[0_4px_8px_rgba(0,38,62,0.18)]"
        />
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        <span>{isLoading ? "正在连接" : "立刻体验"}</span>
      </button>

      <button
        type="button"
        onClick={openGiftModal}
        aria-haspopup="dialog"
        className="mt-4 min-[1440px]:mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] tracking-[0.1em] text-[#00263E]/85 min-[1440px]:text-white/85 transition-colors hover:text-[#00263E] min-[1440px]:hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/40 min-[1440px]:focus-visible:ring-white/50"
      >
        <Gift className="w-3.5 h-3.5 min-[1440px]:w-4 min-[1440px]:h-4" strokeWidth={1.75} />
        <span>测肤分享赢好礼</span>
      </button>
    </>
  );

  return (
    <LazyMotion features={domAnimation}>
      <Suspense fallback={null}>
        <RefCapture />
        <GiftParamDetector onOpen={openGiftModal} />
        <StartParamDetector onStart={handleStart} authReady={isInitialized} />
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

      {/* 顶部栏（设计稿版式）：左蓝色汉堡按钮 + 中肌智派徽章（相对顶栏整体居中，仅 ≥1440px）+ 右 NIHPLOD logo；
          淡奶油底固定定位（与底部栏同色），汉堡内收纳测肤有礼 / 常见问题 / 了解肌智派入口；
          <1440px 顶栏中央不放徽章，徽章移到 Hero 标题「觉醒」上方 */}
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
            className="relative z-50 flex h-[72px] w-28 min-[1440px]:h-[88px] min-[1440px]:w-40 items-center justify-center bg-[#5B7CAE] text-white transition-colors hover:bg-[#4E6C9C] active:bg-[#476390] cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CAE]/50 focus-visible:ring-offset-2"
          >
            {showMenu ? <X className="w-6 h-6" strokeWidth={2} /> : <Menu className="w-6 h-6" strokeWidth={2} />}
          </button>
          {/* 中：肌智派徽章，绝对定位相对顶栏整体居中，不受左右两侧宽度影响；<1440px 隐藏（改放 Hero 标题上方） */}
          <Link href="/" aria-label="回到首页" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden min-[1440px]:inline-flex items-center" onClick={() => setShowMenu(false)}>
            <Image
              src="/images/jzp-eyebrow.png"
              alt="肌智派"
              width={256}
              height={156}
              sizes="(min-width: 1440px) 92px, 72px"
              className="h-11 min-[1440px]:h-14 w-auto object-contain"
              priority
            />
          </Link>
          {/* 右：NIHPLOD 品牌 logo（容器定宽与左侧汉堡按钮一致，左右对称） */}
          <div className="w-28 min-[1440px]:w-40 pr-4 min-[1440px]:pr-8 flex items-center justify-end select-none">
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={30}
              sizes="(min-width: 1440px) 120px, 96px"
              className="h-6 min-[1440px]:h-8 w-auto object-contain"
              priority
            />
          </div>

          {/* 汉堡下拉菜单：遮罩点击关闭。<768px 为全宽贴边面板（上/左/右贴齐顶栏，仅底部 24px 圆角 + 下描边）；
              ≥768px 保持贴顶栏悬挂面板（240px 宽、右下圆角、右/下描边） */}
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
                className="absolute inset-x-0 top-full z-50 origin-top rounded-b-[24px] border-b border-black/[0.06] bg-[#F7F4EE] p-2 shadow-[0_16px_40px_-12px_rgba(0,38,62,0.25)] md:inset-x-auto md:left-0 md:w-60 md:origin-top-left md:rounded-bl-none md:rounded-br-2xl md:border-r"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); handleOpenFaq(); }}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-brand-charcoal transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <CircleHelp className="w-4 h-4 text-brand-charcoal/70" strokeWidth={1.75} />
                  常见问题
                </button>
                <button
                  type="button"
                  onClick={openSkinTypesModalFromMenu}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-brand-charcoal transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-brand-charcoal/70" strokeWidth={1.75} />
                  了解肌智派
                </button>
                <div aria-hidden="true" className="mx-3 my-1.5 border-t border-black/[0.06]" />
                {/* 返回官网：跳出测肤子站回 nihplod.cn 主站（同标签页返回，便于浏览器后退） */}
                <a
                  href="https://nihplod.cn"
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-brand-charcoal transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <House className="w-4 h-4 text-brand-charcoal/70" strokeWidth={1.75} />
                  返回 NIHPLOD
                </a>
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
          {/* 首屏 Hero（设计稿版式）：米白上区 + 蓝灰波浪下区，四个 IP 形象两两夹峙中央文案——
              每侧一后一前：后排水小、没入波浪（波浪层之下）；前排高大、立于波浪之上、抵到底部栏。
              <1440px 只显示前排两人（沙漠女左 / 沙漠男右成对站立）；≥1440px 四人同台 */}
          <div className="relative flex flex-1 flex-col w-full overflow-hidden bg-[#EFE9DA]">
            {/* 左后：极简派男性（银灰西装）：仅 ≥1440px 显示（z-10，波浪层之下）。
                PC 首页专属新素材 hero/back-left-male.webp（旧素材及其它页面不受影响）：
                960×1280 画幅、顶部透明边占图高 2.19%（实测），
                top = 56px − 2.19%×图高（图高 86vh，比右后大一档）= calc(56px-1.88vh) → 头顶落在顶栏下 56px（= 底部栏高度）；
                width/height/sizes 与右后同规格，两人头顶同高（顶部留白不同故 top 各自补偿）。
                水平：left-[12%] / right-[13%]。
                替换图片须保持 960×1280 画幅，顶部透明边比例变化需同步 top 公式 */}
            <m.div
              aria-hidden="true"
              className="absolute z-10 left-[12%] top-[calc(56px-1.88vh)] hidden min-[1440px]:block"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
            >
              <Image
                src="/images/character/hero/back-left-male.webp"
                alt=""
                width={960}
                height={1280}
                sizes="36vw"
                className="h-[86vh] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,38,62,0.16)]"
                priority
              />
            </m.div>

            {/* 左前：沙漠派女性（金发蓝缕）：立于波浪之上（z-30），脚部藏进底部栏（底栏 z-40 自然压盖）。
                手机端与右前沙漠男成对：保持 h-[36vh]，bottom-[6vh]，-left-[8%]，且 z-10 置于波浪层（z-20）之下——
                分界线以下的腿部被蓝色遮住（没入波浪），露出的上身约在 Hero 高度 55%~69% 之间（文字层 z-40 再压在她上面）；
                ≥1440px：z-30 站到波浪之上、h-[100vh]、bottom −44vh（宽屏下沉，与 h 同步加大以保持头部不过高）。
                素材：PC 首页专属新图 hero/front-left-female.webp（手机端同样使用，旧素材仅供派系弹窗） */}
            <m.div
              aria-hidden="true"
              className="absolute z-10 min-[1440px]:z-30 -left-[8%] min-[1440px]:-left-[4%] bottom-[6vh] min-[1440px]:-bottom-[44vh]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.3, duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
            >
              <Image
                src="/images/character/hero/front-left-female.webp"
                alt=""
                width={960}
                height={1280}
                sizes="(min-width: 1440px) 47vw, 44vw"
                className="h-[36vh] min-[1440px]:h-[100vh] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,38,62,0.18)]"
                priority
              />
            </m.div>

            {/* 波浪分界：米白 → 蓝灰，单一明显缓弧（一上一下：峰更鼓、谷更凹），整体自左向右微微上扬。
                viewBox 加高到 400 给峰顶留出头空间（贝塞尔控制点 -73 不出界，实际曲线最低点 >0）。
                窄屏横向压缩约 3.7 倍会让同一曲线显得过陡，故 <1440px 用平缓路径（振幅约减半）。
                蓝色区占 Hero 高度：<1440px 32%（下移 24%）、≥1440px 46%（下移 7%，相对 SVG 自身高度，随视口等比缩放） */}
            <svg
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 z-20 h-[60%] w-full translate-y-[24%] min-[1440px]:translate-y-[7%]"
              viewBox="0 0 1440 400"
              preserveAspectRatio="none"
            >
              {/* <1440px：平缓版（振幅约减半、控制点向端线收拢更平缓，均值不变故蓝色面积不变）
                  + 方向为「先凹再突」：左侧先下凹、右侧再上突 */}
              <path
                className="min-[1440px]:hidden"
                d="M0,100 C480,125 960,55 1440,90 L1440,400 L0,400 Z"
                fill="#93A5BE"
              />
              {/* ≥1440px：明显波幅版 */}
              <path
                className="hidden min-[1440px]:block"
                d="M0,87 C480,-73 960,197 1440,57 L1440,400 L0,400 Z"
                fill="#93A5BE"
              />
            </svg>

            {/* 右后：敏感派女性（紫发托腮）：仅 ≥1440px 显示（z-10，波浪层之下）。
                PC 首页专属新素材 hero/back-right-female.webp（派系弹窗仍用 sensitive/sensitive_female.webp 旧图）：
                960×1280 画幅、顶部透明边占图高 3.36%（实测），
                top = 56px − 3.36%×图高（图高 78vh）= calc(56px-2.62vh)；
                与左后极简男 width/height/sizes 同规格，图高比左后小一档；两人头顶同高（top 按各自留白补偿）、左右对称 */}
            <m.div
              aria-hidden="true"
              className="absolute z-10 right-[13%] top-[calc(56px-2.62vh)] hidden min-[1440px]:block"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.25, duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
            >
              <Image
                src="/images/character/hero/back-right-female.webp"
                alt=""
                width={960}
                height={1280}
                sizes="36vw"
                className="h-[78vh] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,38,62,0.16)]"
                priority
              />
            </m.div>

            {/* 右前：沙漠派男性：立于波浪之上（z-30），与左前沙漠女成对（手机端两个人物同屏）。
                手机端：h-[42vh]、-right-[15%]、bottom −4vh（放大于女、脚部沉进底栏、头部约在 Hero 高度 60%）；
                外层 home-male-dock-clip 是 Hero 通高裁切台：Dock 顶边以下整段裁掉（腿不外露，视觉上被 Dock 遮挡），
                裁切线与人物 bottom 解耦；≥1440px 裁切自动关闭，h-[108vh]（比左前大一档，下沉同步加大以保持头部位置）、-right-[8%]、bottom −52vh */}
            <div aria-hidden="true" className="home-male-dock-clip pointer-events-none absolute inset-0 z-30">
              <m.div
                className="absolute -right-[15%] -bottom-[4vh] min-[1440px]:-right-[8%] min-[1440px]:-bottom-[52vh]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.35, duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
              >
                <Image
                  src="/images/character/hero/front-right-male.webp"
                  alt=""
                  width={960}
                  height={1280}
                  sizes="(min-width: 1440px) 51vw, 40vw"
                  className="h-[42vh] min-[1440px]:h-[108vh] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,38,62,0.18)]"
                  priority
                />
              </m.div>
            </div>

            {/* 中央文案：
                <1440px：徽章 + 标题 + 副标题 + CTA（含测肤有礼）同处文字流，顶部对齐、整体居中；
                ≥1440px：CTA 独立绝对定位在内容区 69% 高处（蓝色区上部），与文字区互不联动 */}
            <section className="relative z-40 flex-1 w-full text-center">
              {/* 文字区：顶部对齐——顶部内边距抵消固定顶栏高度（72/88px），文字顶边紧贴顶栏下缘；
                  h-[55%] 仅作容器兜底，文字实际高度小于容器，不触及波浪线 */}
              <div className="absolute inset-x-0 top-0 flex h-[55%] flex-col items-center justify-start px-6 pt-[72px] min-[1440px]:pt-[88px] opacity-0 animate-fade-in-up">
                {/* 肌智派徽章：<1440px 从顶栏中央移入此处（顶栏只留汉堡 + NIHPLOD）；≥1440px 隐藏避免与顶栏重复。
                    mt-2 与顶栏下缘留 8px 呼吸；mb-8 与标题留 32px，和「副标题 → 立刻体验」间距（mt-8）同档 */}
                <Image
                  src="/images/jzp-eyebrow.png"
                  alt="肌智派"
                  width={256}
                  height={156}
                  sizes="80px"
                  className="mt-2 mb-8 h-12 w-auto object-contain min-[1440px]:hidden"
                  priority
                />
                <h1 className="leading-[1.12]">
                  {/* 移动端（<1440px）：觉醒 + 你的肌肤派系 同一行、同字号（clamp 24~28px 随屏宽自适应，小屏不换行），
                      仅颜色区分（觉醒品牌蓝 / 其余深灰）；≥1440px 恢复两行大标题（觉醒 96px / 其余 44px） */}
                  <span className="text-[clamp(24px,7.4vw,28px)] min-[1440px]:-mr-[0.1em] min-[1440px]:block min-[1440px]:text-[96px] font-bold tracking-[0.1em] text-[#2E4D9E]">觉醒</span>
                  <span className="min-[1440px]:block min-[1440px]:mt-2">
                    <span className="relative inline-flex items-center justify-center -mr-[0.1em] text-[clamp(24px,7.4vw,28px)] min-[1440px]:text-[44px] font-medium tracking-[0.1em] text-[#1c1c1c]">
                      你的肌肤派系
                      {/* 蓝色问号：打开「了解肌智派」弹窗（扩大触达区：移动端热区外扩 8px） */}
                      <button
                        type="button"
                        onClick={openSkinTypesModal}
                        aria-haspopup="dialog"
                        aria-label="了解肌智派"
                        className="absolute left-full top-[calc(50%+0.05em)] -translate-y-1/2 ml-1 min-[1440px]:ml-2 inline-flex w-6 h-6 min-[1440px]:w-8 min-[1440px]:h-8 items-center justify-center rounded-full bg-[#2E4D9E] text-white transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none cursor-pointer touch-manipulation before:absolute before:inset-0 before:content-[''] max-[1440px]:before:-inset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/50 focus-visible:ring-offset-2"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-[18px] h-[18px] min-[1440px]:w-[22px] min-[1440px]:h-[22px]"
                        >
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <path d="M12 17h.01" />
                        </svg>
                      </button>
                    </span>
                  </span>
                </h1>
                <p className="mt-4 min-[1440px]:mt-6 text-[14px] min-[1440px]:text-[16px] leading-[1.75] min-[1440px]:leading-[1.9] tracking-[0.05em] text-[#84817a]">
                  获得专业的面部分析报告
                  <br />
                  您口袋里的专属的护肤管家
                </p>
                {/* 移动端（<1440px）：CTA（主按钮 + 测肤有礼）接在副标题下方、随文字流居中对齐；
                    ≥1440px 由下方 69% 高处的绝对定位区渲染（两处互斥显示） */}
                <div className="mt-8 flex min-[1440px]:hidden flex-col items-center">
                  {heroCta}
                </div>
              </div>
              {/* CTA 区（仅 ≥1440px）：独立定位在内容区 69% 高处（蓝色区上部、留有余量），与文字区互不联动 */}
              <div className="absolute inset-x-0 top-[69%] -translate-y-1/2 hidden min-[1440px]:flex flex-col items-center px-6 opacity-0 animate-fade-in-up">
                {heroCta}
              </div>
            </section>
          </div>

          {/* 底部栏：淡奶油色通栏（比 Hero 上区的米色更浅），并入首屏；内容全宽，备案居左、链接与版权居右 */}
          <div className="relative z-40 bg-[#FBF9F3]">
            <div className="w-full px-6 min-[1440px]:px-10 h-16 min-[1440px]:h-14 flex items-center">
              <HomepageFooter />
            </div>
          </div>
        </m.div>

      {/* "测肤有礼"入口：PC 左下角宣传卡 + 移动端 CTA 下方文字链 + 顶栏汉堡菜单 */}

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
          onOpenSkinTypes={openSkinTypesModal}
        />
      )}
      {shouldRenderSkinTypes && (
        <SkinTypesModal
          isOpen={showSkinTypesModal}
          onClose={() => setShowSkinTypesModal(false)}
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
