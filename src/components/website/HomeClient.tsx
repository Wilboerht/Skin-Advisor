"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2, X, Menu, Sparkles, Gift, CircleHelp, CircleUserRound, House } from "lucide-react";

import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";

import { useAuthModal } from "@/components/auth/AuthModalContext";
import { hasPrivacyConsent, savePrivacyConsent } from "@/lib/consent-storage";
import { fetchConsentState, recordClientConsent } from "@/lib/consent-client";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Button } from "@/components/ui/Button";
import { useLazyOpen } from "@/hooks/use-lazy-open";
import { useNavPush } from "@/hooks/use-nav-push";
import dynamic from "next/dynamic";
const OnboardingFlowModal = dynamic(() => import("@/components/advisor/OnboardingFlowModal").then((mod) => mod.OnboardingFlowModal), { ssr: false });
import { HomepageFooter } from "@/components/website/HomepageFooter";
import { HomeFeatureCards } from "@/components/website/HomeFeatureCards";
import { HomeMobileHero } from "@/components/website/HomeMobileHero";
import { HeroDoodles } from "@/components/website/HeroDoodles";
import type { AccountTab } from "@/components/website/AccountModal";
import { normalizeAccountTab } from "@/lib/account-tab";
const GiftModal = dynamic(() => import("@/components/website/GiftModal").then((mod) => mod.GiftModal), { ssr: false });
const FaqModal = dynamic(() => import("@/components/website/FaqModal").then((mod) => mod.FaqModal), { ssr: false });
const AccountModal = dynamic(() => import("@/components/website/AccountModal").then((mod) => mod.AccountModal), { ssr: false });
const AdvisorContactModal = dynamic(() => import("@/components/website/AdvisorContactModal").then((mod) => mod.AdvisorContactModal), { ssr: false });
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

/**
 * ?account=<tab> / ?tab=<tab> 深链接：打开账户弹层对应 tab。
 * 与主站 /?account=<tab> 约定一致；未登录时记录回跳目标并展示登录引导，
 * SSO 回跳后由 AuthUrlDetector 消费 AUTH_REDIRECT 再回到本页打开弹层。
 * URL 参数在读取后清理，避免关闭弹层后刷新又自动打开。
 */
function AccountParamDetector({
  onOpen,
  authReady,
  userId,
}: {
  onOpen: (tab: AccountTab) => void;
  authReady: boolean;
  userId?: string;
}) {
  const searchParams = useSearchParams();
  const firedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || firedRef.current || !authReady) return;
    const raw = searchParams.get("account") ?? searchParams.get("tab");
    if (!raw) return;
    firedRef.current = true;
    const tab = normalizeAccountTab(raw);

    if (!userId) {
      try {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_REDIRECT, `/?account=${tab}`);
      } catch {
        /* ignore */
      }
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("account");
    url.searchParams.delete("tab");
    window.history.replaceState({}, "", url.toString());

    onOpen(tab);
  }, [searchParams, authReady, userId, onOpen]);
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

  // Capture ref parameter: moved to <RefCapture /> rendered in JSX (useSearchParams needs Suspense boundary)

  // 限额弹窗的滚动锁在其 state 声明后单独处理

  // Nickname state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  // 测肤有礼活动弹窗（替代原独立 /gift 页面）
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountInitialTab, setAccountInitialTab] = useState<AccountTab>("profile");
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  // 本次账户弹层是否由「开始测肤」打开：只有该场景登录成功后才自动续跑
  const accountStartFlowRef = useRef(false);
  // 区分“关闭登录引导”与“点击登录后整页跳转”：后者不能清掉待续跑意图
  const loginIntentRef = useRef(false);
  const openAccountModal = useCallback((tab: AccountTab = "profile") => {
    accountStartFlowRef.current = false;
    loginIntentRef.current = false;
    setAccountInitialTab(tab);
    setShowAccountModal(true);
  }, []);
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
  // 当前版本隐私同意是否已存在：决定引导流程是否展示 legal 屏（登录用户同样适用）
  const [privacyConsentPresent, setPrivacyConsentPresent] = useState(false);
  useEffect(() => {
    setPrivacyConsentPresent(hasPrivacyConsent());
    void import("@/lib/advisor-storage")
      .then(({ clearExpiredData }) => clearExpiredData())
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void fetchConsentState().then((state) => {
      if (!cancelled && state) {
        setPrivacyConsentPresent(state.missing.length === 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
  const shouldRenderAdvisor = useLazyOpen(showAdvisorModal);
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
    safeStorage.remove(STORAGE_KEYS.ADVISOR_FACE_IMAGES_IDB);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_RESULT);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_FREE_RETRY);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_STEP);
    // 分析中/失败暂存/锁必须一并清理：否则新测试会复用旧 session，
    // 服务端命中已完成缓存后直接返回上一份报告。
    safeStorage.remove(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_LOCAL);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_FAILED_ANALYSIS);
    // 新测试重置拍摄状态，避免沿用上一次的“带妆/防晒”选择
    safeStorage.remove(STORAGE_KEYS.ADVISOR_SKIN_STATE);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_FACE_ERROR);
    safeStorage.remove(STORAGE_KEYS.ADVISOR_PENDING_START);
    // 预处理图可能尚未被异步 clearFaceImages 清掉，先同步移除，防止新测试复用旧照片
    safeStorage.remove("advisor_processed_images");
    try {
      sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID);
      sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT);
      sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
      sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_FACE_ERROR);
    } catch { /* ignore */ }
    // 面部照片存 IndexedDB + advisor_processed_images：startNewTest 必须清掉，
    // 避免上一次的照片被当作本次输入，也避免共享设备残留。
    void import("@/lib/advisor-storage")
      .then(({ advisorStorage }) => advisorStorage.clearFaceImages())
      .catch((err) => console.warn("clearFaceImages failed", err));
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
    try {
      if (!("geolocation" in navigator)) {
        throw new Error("No geolocation support");
      }
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      // Ignore stale result if user has already moved past the location step
      if (requestId !== locationRequestId.current) {
        return false;
      }

      safeStorage.set("userRegion", JSON.stringify({
        lat: position.coords.latitude,
        lon: position.coords.longitude
      }));
      safeStorage.setSession("locationConsent", "granted");
      return true;
    } catch (error) {
      // 已被跳过/选地区/关闭弹窗/新请求取代：不作为本次定位失败处理
      if (requestId !== locationRequestId.current) {
        return false;
      }
      console.warn("Geolocation failed", error);
      throw error; // Let OnboardingFlowModal handle the fallback
    } finally {
      if (requestId === locationRequestId.current) {
        setIsLocating(false);
      }
    }
  };

  const handleRegionSelect = (region: string) => {
    locationRequestId.current += 1;
    setIsLocating(false);
    safeStorage.setSession("locationConsent", "granted");
    safeStorage.set("userRegion", JSON.stringify({ province: region, city: region }));
    // Do not close or start test here, let legal step handle it
  };

  const handleSkipRegionSelect = async (): Promise<boolean> => {
    // This is now repurposed as the FINAL completion handler from the Legal step
    locationRequestId.current += 1;
    setIsLocating(false);

    // Ensure consent is recorded if not already set by location/region steps
    if (!safeStorage.getSession("locationConsent")) {
        safeStorage.setSession("locationConsent", "declined");
    }

    if (user?.id) {
      const recorded = await recordClientConsent();
      if (!recorded || recorded.missing.length > 0) {
        setIsLoading(false);
        return false;
      }
    } else {
      // 游客只写本机记录；登录后由 ensureClientConsent 做服务端迁移。
      savePrivacyConsent();
    }

    setPrivacyConsentPresent(true);
    setShowOnboardingModal(false);
    setIsLoading(true);

    // 提交前确保昵称已保存：用户手写优先，登录用户回退到账号昵称
    if (nickname.trim()) {
      safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, nickname.trim());
    } else if (user?.name && !safeStorage.get(STORAGE_KEYS.ADVISOR_NICKNAME)) {
      safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, user.name);
    }
    
    startNewTest();
    return true;
  };

  const handleLocationDecline = () => {
    // Declining loc will naturally open Region Select, but handled by OnboardingFlowModal now implicitly via callback
    locationRequestId.current += 1;
    setIsLocating(false);
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
    loginIntentRef.current = false;

    try {
      // 会话未初始化（如刚登录回跳、/api/auth/me 仍在途）时先等其完成：
      // refresh 有单飞机制，会并入挂载时发起的同一次请求，不产生额外流量。
      // 否则后续的登录态判断会拿 user=null 的旧快照，把已登录用户误判成游客
      if (!isInitializedRef.current) {
        await refreshUser();
      }

      // 未登录：记录“待开始”，SSO 回跳后自动续跑；同时打开登录引导
      if (!userRef.current) {
        safeStorage.set(STORAGE_KEYS.ADVISOR_PENDING_START, String(Date.now()));
        openAccountModal();
        accountStartFlowRef.current = true;
        return;
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
          safeStorage.set(STORAGE_KEYS.ADVISOR_PENDING_START, String(Date.now()));
          openAccountModal();
          accountStartFlowRef.current = true;
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
      if (!showOnboardingModal) {
        setOnboardingOpenCount(prev => prev + 1);
      }
      setShowOnboardingModal(true);
    } finally {
      startingRef.current = false;
    }
  }, [checkTestLimit, openAccountModal, refreshUser, showOnboardingModal]);

  // SSO 回跳后自动续跑：只有用户此前点击「开始测肤」才置位，关闭登录引导会清除
  useEffect(() => {
    if (!isInitialized || !user) return;
    const raw = safeStorage.get(STORAGE_KEYS.ADVISOR_PENDING_START);
    if (!raw) return;
    const startedAt = Number(raw);
    // 只续跑最近 10 分钟内的意图，避免很久以后登录被意外拉起
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > 10 * 60 * 1000) {
      safeStorage.remove(STORAGE_KEYS.ADVISOR_PENDING_START);
      return;
    }
    if (showOnboardingModal) return;
    safeStorage.remove(STORAGE_KEYS.ADVISOR_PENDING_START);
    void handleStart();
  }, [isInitialized, user, showOnboardingModal, handleStart]);

  const handleNicknameSubmit = () => {
    if (!nickname.trim()) {
      return;
    }
    // Save nickname to localStorage
    safeStorage.set(STORAGE_KEYS.ADVISOR_NICKNAME, nickname.trim());
  };

  const openAdvisorModal = () => {
    if (!isInitialized) return;
    if (!user) {
      // 未登录统一走「我的」账户弹层的登录拦截视图，不展示顾问标题
      openAccountModal("profile");
      return;
    }
    setShowAdvisorModal(true);
  };

  const heroCta = (
    <>
      <button
        type="button"
        onClick={handleStart}
        disabled={isLoading || isNavigating}
        className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-[#22304E]/10 bg-card px-8 text-[17px] font-semibold tracking-[0.08em] text-[#22304E] shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 pc:h-[clamp(52px,4.53vw,58px)] pc:min-w-[clamp(212px,20vw,256px)] pc:px-[clamp(32px,3.75vw,48px)] pc:text-[clamp(18px,1.5625vw,20px)] 2k:h-[clamp(58px,5.37vh,77px)] 2k:min-w-[clamp(256px,23.7vh,341px)] 2k:px-[clamp(48px,4.44vh,64px)] 2k:text-[clamp(20px,1.85vh,27px)] cursor-pointer"
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>{isLoading ? "正在连接" : "开始测肤"}</span>
        {!isLoading && <ArrowRight className="h-5 w-5" strokeWidth={1.8} />}
      </button>

      {isInitialized && !user && (
        <p className="mt-2 text-[12px] font-light tracking-[0.04em] text-[#00263E]/55">
          登录后开始测肤 · 注册即享 10 次免费测肤
        </p>
      )}

      <button
        type="button"
        onClick={openGiftModal}
        aria-haspopup="dialog"
        className="mt-3 inline-flex items-center gap-2 rounded-full py-1.5 pl-0 pr-2 text-[15px] leading-[1.8] tracking-[0.02em] text-[#00263E]/60 transition-colors hover:text-[#00263E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/40 pc:mt-3 pc:text-[clamp(15px,1.328vw,17px)] 2k:text-[clamp(17px,1.574vh,22px)] cursor-pointer"
      >
        <Gift className="h-[18px] w-[18px] 2k:h-[clamp(18px,1.67vh,24px)] 2k:w-[clamp(18px,1.67vh,24px)]" strokeWidth={1.6} />
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
        <AccountParamDetector
          onOpen={openAccountModal}
          authReady={isInitialized}
          userId={user?.id}
        />
      </Suspense>

      {/* Full Screen Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-brand-canvas flex flex-col items-center justify-center"
          >
            <Loader2 className="w-10 h-10 text-[var(--color-brand-charcoal)] animate-spin mb-6" />
            <p className="text-foreground/75 text-[15px] font-medium tracking-wide">即将进入 AI 问卷...</p>
          </m.div>
        )}
      </AnimatePresence>

      {/* 左侧菜单与账户入口，中央肌智派徽章，右侧 NIHPLOD 标志 */}
      <header className="fixed inset-x-0 top-0 z-40 bg-[#FBF9F3] pt-[env(safe-area-inset-top,0px)] border-b border-black/[0.06]">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center">
            <button
              type="button"
              ref={menuButtonRef}
              onClick={() => setShowMenu((v) => !v)}
              aria-label={showMenu ? "关闭菜单" : "打开菜单"}
              aria-expanded={showMenu}
              aria-controls="home-menu"
              className="relative z-50 flex h-[72px] w-20 items-center justify-center bg-[#5B7CAE] text-white transition-colors hover:bg-[#4E6C9C] active:bg-[#476390] cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7CAE]/50 focus-visible:ring-offset-2 max-pc:h-16 max-pc:w-14 max-pc:bg-transparent max-pc:text-[#22304E] max-pc:hover:bg-[#22304E]/[0.04] max-pc:active:bg-[#22304E]/[0.06] max-pc:focus-visible:ring-inset pc:h-[88px] pc:w-40"
            >
              {showMenu ? <X className="h-6 w-6" strokeWidth={2} /> : <Menu className="h-6 w-6" strokeWidth={2} />}
            </button>
            <button
              type="button"
              onClick={() => openAccountModal()}
              aria-label="打开我的账户"
              aria-haspopup="dialog"
              className="relative z-50 flex h-[72px] w-14 items-center justify-center text-[#22304E]/75 transition-colors hover:bg-[#22304E]/[0.04] hover:text-[#22304E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B7CAE]/50 max-pc:hidden pc:h-[88px] pc:w-20 cursor-pointer"
            >
              <CircleUserRound className="h-6 w-6 pc:h-7 pc:w-7" strokeWidth={1.5} />
            </button>
          </div>
          <Link href="/" aria-label="回到首页" className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center max-pc:hidden" onClick={() => setShowMenu(false)}>
            <Image
              src="/images/jzp-eyebrow.png"
              alt="肌智派"
              width={256}
              height={156}
              sizes="(min-width: 1280px) 92px, 64px"
              className="h-10 w-auto object-contain pc:h-14"
              priority
            />
          </Link>
          {/* 右：NIHPLOD 品牌 logo（容器定宽与左侧汉堡按钮一致，左右对称） */}
          <div className="w-28 pc:w-40 pr-4 pc:pr-8 flex items-center justify-end select-none max-pc:hidden">
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={30}
              sizes="(min-width: 1280px) 120px, 96px"
              className="h-6 pc:h-8 w-auto object-contain"
              priority
            />
          </div>

          {/* 移动端顶栏：居中 NIHPLOD 标志，右侧账户入口 */}
          <Link
            href="/"
            aria-label="回到首页"
            className="absolute left-1/2 top-1/2 z-40 inline-flex -translate-x-1/2 -translate-y-1/2 items-center pc:hidden"
            onClick={() => setShowMenu(false)}
          >
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={30}
              sizes="120px"
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={() => openAccountModal()}
            aria-label="打开我的账户"
            aria-haspopup="dialog"
            className="absolute right-0 top-0 z-50 flex h-16 w-14 items-center justify-center text-[#22304E]/75 transition-colors hover:bg-[#22304E]/[0.04] hover:text-[#22304E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B7CAE]/50 pc:hidden cursor-pointer"
          >
            <CircleUserRound className="h-6 w-6" strokeWidth={1.5} />
          </button>

          {/* 汉堡下拉菜单：遮罩点击关闭。<1024px 为全宽贴边面板（上/左/右贴齐顶栏，仅底部 24px 圆角 + 下描边）；
              ≥1024px 保持贴顶栏悬挂面板（240px 宽、右下圆角、右/下描边） */}
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
                className="absolute inset-x-0 top-full z-50 origin-top rounded-b-[24px] border-b border-black/[0.06] bg-[#FAF7F1] p-2 shadow-card pc:inset-x-auto pc:left-0 pc:w-60 pc:origin-top-left pc:rounded-bl-none pc:rounded-br-2xl pc:border-r"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); handleOpenFaq(); }}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-foreground transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <CircleHelp className="w-4 h-4 text-foreground/75" strokeWidth={1.75} />
                  常见问题
                </button>
                <button
                  type="button"
                  onClick={openSkinTypesModalFromMenu}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-foreground transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-foreground/75" strokeWidth={1.75} />
                  了解肌智派
                </button>
                <div aria-hidden="true" className="mx-3 my-1.5 border-t border-black/[0.06]" />
                {/* 返回官网：跳出测肤子站回 nihplod.cn 主站（同标签页返回，便于浏览器后退） */}
                <a
                  href="https://nihplod.cn"
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14px] text-foreground transition-colors hover:bg-brand-charcoal/[0.05] focus-visible:outline-none focus-visible:bg-brand-charcoal/[0.08] cursor-pointer"
                >
                  <House className="w-4 h-4 text-foreground/75" strokeWidth={1.75} />
                  返回 NIHPLOD
                </a>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* 顶栏 + 主视觉 + 页脚；窄屏内容超高时允许页面自然滚动 */}
      <m.div
        className="home-shell relative z-20 flex flex-col min-h-dvh"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      >
          <div className="relative flex flex-1 overflow-hidden bg-[#F3F1EB]">
            <HeroDoodles />
            <HomeMobileHero
              onStartTest={handleStart}
              onOpenProfile={() => openAccountModal("diary")}
              onOpenAdvisor={openAdvisorModal}
            />
            <div className="mx-auto grid w-full max-w-[clamp(1600px,83.33vw,3200px)] flex-1 grid-cols-1 items-center gap-2 px-6 py-8 max-pc:hidden sm:px-10 sm:py-10 pc:max-w-[clamp(1600px,83.33vw,3200px)] pc:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] pc:gap-6 pc:pl-[8%] pc:pr-[1%] pc:py-6 2k:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <section className="home-hero-copy relative z-20 flex flex-col items-start text-left opacity-0 animate-fade-in-up">
                <h1 className="leading-[1.12]">
                  <span className="block text-[56px] font-bold tracking-[0.08em] text-[#2E4D9E] sm:text-[68px] pc:text-[clamp(72px,7.1875vw,92px)] 2k:text-[clamp(92px,8.52vh,122px)]">觉醒</span>
                  <span className="mt-2 flex items-center text-[33px] font-medium tracking-[0.06em] text-[#1c1c1c] sm:text-[39px] pc:text-[clamp(38px,3.75vw,48px)] 2k:text-[clamp(48px,4.44vh,64px)]">
                    <span>你的肌肤派系</span>
                    <button
                      type="button"
                      onClick={openSkinTypesModal}
                      aria-haspopup="dialog"
                      aria-label="了解肌智派"
                      className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E4D9E] text-white transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/50 focus-visible:ring-offset-2 pc:ml-[clamp(8px,0.94vw,12px)] pc:h-[clamp(26px,2.5vw,32px)] pc:w-[clamp(26px,2.5vw,32px)] 2k:ml-[clamp(12px,1.11vh,16px)] 2k:h-[clamp(32px,2.96vh,43px)] 2k:w-[clamp(32px,2.96vh,43px)] cursor-pointer"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] pc:h-[clamp(18px,1.72vw,22px)] pc:w-[clamp(18px,1.72vw,22px)] 2k:h-[clamp(22px,2.04vh,29px)] 2k:w-[clamp(22px,2.04vh,29px)]">
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                      </svg>
                    </button>
                  </span>
                </h1>
                <p className="mt-4 max-w-[470px] text-[15px] leading-[1.8] tracking-[0.02em] text-[#77766F] pc:mt-4 pc:whitespace-nowrap pc:text-[15px] xl:text-[17px] 2k:max-w-none 2k:text-[clamp(17px,1.574vh,22px)]">
                  获得专业的面部分析报告，你口袋里的专属护肤管家
                </p>
                <div className="mt-7 flex flex-col items-start pc:mt-7">
                  {heroCta}
                </div>
              </section>

              <div className="hero-fan-wrap relative z-10 flex items-center justify-center pc:justify-end">
                <HomeFeatureCards
                  onStartTest={handleStart}
                  onOpenProfile={() => openAccountModal("diary")}
                  onOpenAdvisor={openAdvisorModal}
                />
              </div>
            </div>
          </div>

          <div className="relative z-40 bg-[#FBF9F3]">
            <div className="flex min-h-16 w-full items-center px-6 py-2 max-pc:min-h-12 max-pc:py-1 pc:h-12 pc:min-h-0 pc:px-10 pc:py-0">
              <HomepageFooter onOpenFaq={handleOpenFaq} />
            </div>
          </div>
        </m.div>

      {/* Modals：首次打开才加载对应 chunk（见上方 shouldRender* latch） */}
      {shouldRenderAccount && (
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => {
            setShowAccountModal(false);
            if (!loginIntentRef.current) {
              safeStorage.remove(STORAGE_KEYS.ADVISOR_PENDING_START);
            }
            accountStartFlowRef.current = false;
          }}
          onLoginIntent={() => {
            // 只有「开始测肤 → 登录」才续跑；普通「我的」入口登录不应自动开测
            if (!accountStartFlowRef.current) return;
            loginIntentRef.current = true;
            safeStorage.set(STORAGE_KEYS.ADVISOR_PENDING_START, String(Date.now()));
          }}
          initialTab={accountInitialTab}
        />
      )}
      {shouldRenderAdvisor && (
        <AdvisorContactModal isOpen={showAdvisorModal} onClose={() => setShowAdvisorModal(false)} />
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
            locationRequestId.current += 1;
            setIsLocating(false);
            setShowOnboardingModal(false);
            setIsLoading(false);
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
          hasConsent={privacyConsentPresent}
        />
      )}

            <ResponsiveDialog
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        title={
          testLimitInfo?.quotaPeriod === "lifetime"
            ? "免费测肤次数已用完"
            : "今日测试次数已用完"
        }
        size="md"
        footer={
          <>
            {!user && (
              <Button
                type="button"
                onClick={() => {
                  setShowLimitModal(false);
                  openAuthModal("login");
                }}
              >
                登录 / 注册
              </Button>
            )}
            <Button
              type="button"
              variant={user ? "default" : "outline"}
              onClick={() => setShowLimitModal(false)}
            >
              我知道了
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          {(() => {
            const info = testLimitInfo;
            const dailyLimit = info?.dailyLimit ?? 10;
            const remaining = info?.remaining ?? 0;
            if (remaining > 0) {
              return <>{info?.error || "当前暂时无法开始测肤，请稍后再试"}</>;
            }
            if (info?.quotaPeriod === "lifetime") {
              return (
                <>
                  免费测肤次数已用完（共 {dailyLimit} 次）
                  <br />
                  升级金卡会员，享不限次测肤
                </>
              );
            }
            return (
              <>
                今日测试次数已用完（共 {dailyLimit} 次）
                {!user && (
                  <>
                    <br />
                    注册即享 10 次免费测肤，会员升级可获更多次数，金卡及以上不限次
                  </>
                )}
              </>
            );
          })()}
        </div>
      </ResponsiveDialog>


    </LazyMotion>
  );
}
