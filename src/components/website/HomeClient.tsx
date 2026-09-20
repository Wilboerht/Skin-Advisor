"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Loader2, X, ScanFace, Sparkles, FileText, Gift, CircleHelp } from "lucide-react";

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
import { KineticBackground } from "@/components/website/KineticBackground";
import UserBadge from "@/components/advisor/UserBadge";
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

      {/* 首页 Kinetic 背景：米白底 + 点阵 + N 水印（共享组件，样式类见 globals.css） */}
      <KineticBackground />

      {/* 顶部栏：与结果页/问卷页同规格（左空 + 中 logo + 右用户区），移动端同样显示；
          固定定位 + 毛玻璃底，logo 可点回首页 */}
      <header className="fixed inset-x-0 top-0 z-40 pt-[calc(1.75rem+env(safe-area-inset-top,0px))] pb-5 bg-[#f3efe6]/85 backdrop-blur-md border-b border-brand-charcoal/[0.06] md:border-b-0">
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full px-4 xl:px-20">
          {/* 左槽：活动/常见问题入口（移动端圆形图标版，md+ 描边胶囊；h-9 为 border-box，不撑高顶栏） */}
          <div className="justify-self-start flex items-center gap-1 md:gap-1.5">
            <button
              type="button"
              onClick={openGiftModal}
              aria-label="测肤有礼 · 参与赢好礼"
              aria-haspopup="dialog"
              aria-expanded={showGiftModal}
              className="group inline-flex h-9 w-9 -my-0.5 items-center justify-center rounded-full border border-brand-gold/50 bg-brand-gold/[0.08] text-brand-bronze shadow-[0_2px_10px_-6px_rgba(201,168,108,0.6)] transition-colors hover:border-brand-gold/80 hover:bg-brand-gold/[0.14] active:opacity-80 md:-my-0 md:w-auto md:gap-1.5 md:px-3.5 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2"
            >
              <Gift className="w-[18px] h-[18px] md:w-3.5 md:h-3.5" strokeWidth={1.75} />
              <span className="hidden md:inline text-[13px] font-light tracking-[0.08em] whitespace-nowrap">
                测肤有礼 · 参与赢好礼
              </span>
            </button>
            <button
              type="button"
              onClick={handleOpenFaq}
              aria-label="常见问题"
              aria-haspopup="dialog"
              aria-expanded={showFaqModal}
              className="group inline-flex h-9 w-9 -my-0.5 items-center justify-center rounded-full border border-brand-charcoal/15 text-brand-charcoal/70 transition-colors hover:border-brand-charcoal/35 hover:bg-brand-charcoal/[0.04] hover:text-brand-charcoal active:opacity-80 md:-my-0 md:w-auto md:gap-1.5 md:px-3.5 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2"
            >
              <CircleHelp className="w-[18px] h-[18px] md:w-3.5 md:h-3.5" strokeWidth={1.75} />
              <span className="hidden md:inline text-[13px] font-light tracking-[0.08em] whitespace-nowrap">
                常见问题
              </span>
            </button>
          </div>
          <Link href="/" aria-label="回到首页" className="justify-self-center inline-flex items-center">
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={30}
              sizes="(min-width: 768px) 108px, 96px"
              className="h-7 md:h-9 w-auto object-contain"
              priority
            />
          </Link>
          <div className="justify-self-end flex items-center">
            <UserBadge compact />
          </div>
        </div>
      </header>

      {/* 内容区域 - 一屏布局（min-h-dvh + .home-shell 为顶栏预留高度；矮屏/横屏放不下时可滚动）；pb-dock 为底部 Dock 留白 */}
      <m.div
        className="home-shell relative z-20 flex flex-col min-h-dvh pb-dock"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={isHomeExiting ? (prefersReducedMotion ? { opacity: 0 } : { y: "-100%" }) : { opacity: 1, scale: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      >
          {/* 首屏 Hero：左文右图分栏（一屏垂直居中，矮屏/横屏放不下时可滚动） */}
          <div className="flex-1 w-full flex items-center">
            <div className="w-full max-w-6xl mx-auto px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] items-center gap-4 lg:gap-10">
              {/* 左列：品牌 / 标题 / 卖点 / 操作 */}
              <section className="relative z-10 flex flex-col items-center text-center lg:items-start lg:text-left">
                <div className="opacity-0 animate-fade-in-up flex flex-col items-center lg:items-start">
                  {/* 印章徽标：素材自带透明通道，无需混合模式/降透明；下边距按"留白 ≥ 0.5×标高"取 16/24 */}
                  <m.div
                    className="mb-4 md:mb-6 inline-flex items-center"
                    initial={{ opacity: 0, scale: 1.5, y: -10, filter: "blur(2px)" }}
                    animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }}
                  >
                    <Image
                      src="/images/jzp-eyebrow.png"
                      alt="肌智派"
                      width={256}
                      height={156}
                      sizes="(min-width: 768px) 86px, 66px"
                      className="h-10 md:h-[52px] w-auto"
                      priority
                    />
                  </m.div>

                  {/* 说明胶囊：AI 护肤顾问 · 预计时长（字阶 caption 档：12px / 0.1em） */}
                  <span className="mb-3 md:mb-5 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-brand-charcoal/[0.06] text-brand-charcoal/70 text-[12px] font-light tracking-[0.1em] whitespace-nowrap">
                    AI 护肤顾问 · 约 3 分钟
                  </span>

                  {/* 标题：两段式排版，第二行弱化；行高放宽到 1.18 让两行更透气 */}
                  <h1 className="home-hero-title font-serif text-brand-charcoal font-light leading-[1.18] tracking-[0.04em] mb-4 md:mb-6">
                    三分钟，
                    <br />
                    <span className="text-brand-charcoal/55">读懂你的肌肤。</span>
                  </h1>

                  <p className="text-[14px] md:text-[16px] leading-[1.8] tracking-[0.01em] text-brand-charcoal/70 font-light max-w-md lg:max-w-[500px] mb-6 md:mb-8">以 AI 之眼完成面部扫描，结合专业问卷测出你的专属肌智派系，<br className="hidden lg:block" />匹配科学护肤方案与好物推荐。</p>

                  {/* 操作区：主按钮（藏青 + 圆形箭头章，悬停箭头旋转）+ 次级入口（窄屏并排省高度） */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleStart}
                      disabled={isLoading || isNavigating}
                      className="group/cta inline-flex flex-1 sm:flex-none items-center justify-center gap-3 h-12 pl-7 pr-2 rounded-full bg-[var(--color-brand-charcoal)] text-white text-[15px] font-normal tracking-[0.08em] shadow-[0_10px_30px_-10px_rgba(0,38,62,0.45)] transition-colors duration-300 hover:bg-[var(--color-brand-charcoal)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>{isLoading ? "正在连接" : "开始测肤"}</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover/cta:rotate-45 motion-reduce:transition-none" />
                        )}
                      </span>
                    </button>
                    <Link
                      href="/skin-types"
                      className="inline-flex flex-1 sm:flex-none items-center justify-center h-12 px-7 rounded-full border border-brand-charcoal/20 text-brand-charcoal/80 text-[15px] font-light tracking-[0.08em] transition-colors duration-300 hover:border-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.03]"
                    >
                      了解肌智派
                    </Link>
                  </div>

                  {/* 三步预告：caption 档 12px；与正文→按钮同间距（24/32），上下完全一致 */}
                  <div className="mt-6 md:mt-8 flex items-center gap-x-1.5 md:gap-x-2 whitespace-nowrap text-brand-charcoal/60 text-[12px] font-light tracking-[0.06em]">
                    <span className="flex items-center gap-1.5">
                      <ScanFace className="w-3.5 h-3.5" strokeWidth={1.5} />
                      问卷及面部扫描
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-brand-charcoal/30" strokeWidth={1.5} />
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                      AI 分析
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-brand-charcoal/30" strokeWidth={1.5} />
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                      专属报告
                    </span>
                  </div>
                </div>
              </section>

              {/* 右列：Hero 配图（临时占位：来自 Myskin.Today 参考项目，自有素材就绪后替换；
                  纯装饰；矮屏移动端由 .home-hero-visual 隐藏） */}
              <m.div
                className="home-hero-visual relative flex w-full items-end justify-center lg:justify-end"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : 0.25,
                  duration: prefersReducedMotion ? 0 : 0.5,
                  ease: "easeOut",
                }}
              >
                {/* 柔光底：让配图从底色上"浮"起来 */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[8%] left-1/2 -translate-x-1/2 lg:left-auto lg:right-[8%] lg:translate-x-0 w-[72%] lg:w-[84%] aspect-square rounded-full bg-[#e3dbc9]/55 blur-3xl"
                />
                <Image
                  src="/images/hero-illustration-placeholder.webp"
                  alt=""
                  aria-hidden="true"
                  width={1024}
                  height={1024}
                  sizes="(min-width: 1024px) 520px, 60vw"
                  className="relative h-[26vh] min-h-[150px] lg:h-[58vh] w-auto object-contain object-center lg:object-right drop-shadow-[0_16px_30px_rgba(0,38,62,0.14)]"
                  priority
                />
              </m.div>
            </div>
          </div>

          {/* 页脚（移动端/中屏：沉底于 Dock 上方；xl 以上见下方固定通栏版本）。
              全端贴边 16px，与顶栏的"通栏"方案保持同一网格 */}
          <div className="mt-auto pt-4 md:pt-6 px-4 md:mb-4 xl:hidden">
            <HomepageFooter />
          </div>
        </m.div>

      {/* xl 桌面端页脚：固定屏幕底部通栏，备案居左、链接与版权居右（z 高于内容层 z-20、低于 Dock；
          xl 及以上左右内缩 80px 与顶栏同网格，<1280px 改走上方 16px 贴边的沉底版） */}
      <div className="hidden xl:block fixed bottom-2 left-20 right-20 z-30">
        <HomepageFooter />
      </div>

      {/* "测肤有礼"入口为 Hero 下方的描边胶囊（见上方次级入口区），不再使用右下角悬浮卡片 */}

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
