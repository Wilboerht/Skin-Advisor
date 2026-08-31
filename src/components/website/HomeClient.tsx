"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, ChevronRight, Loader2, X, ScanFace, Sparkles, FileText, Gift, CircleHelp } from "lucide-react";

import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

import { useAuthModal } from "@/components/auth/AuthModalContext";
import { getGuestIdentity, type GuestIdentity } from "@/lib/guest-identity";
import { CONSENT_VERSION } from "@/components/advisor/PrivacyConsent";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useNavPush } from "@/hooks/use-nav-push";
import type { HistorySession } from "@/components/website/TestHistoryList";
import dynamic from "next/dynamic";
const OnboardingFlowModal = dynamic(() => import("@/components/advisor/OnboardingFlowModal").then((mod) => mod.OnboardingFlowModal), { ssr: false });
import { HomepageFooter } from "@/components/website/HomepageFooter";
const GiftModal = dynamic(() => import("@/components/website/GiftModal").then((mod) => mod.GiftModal), { ssr: false });
const FaqModal = dynamic(() => import("@/components/website/FaqModal").then((mod) => mod.FaqModal), { ssr: false });

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

  // 社会证明：累计测肤人数（< 100 时不展示数字）
  const [testCount, setTestCount] = useState<number | null>(null);
  // 老用户快捷入口：最近一次已完成测肤（含与上次的评分差）
  const [latestReport, setLatestReport] = useState<{
    sessionId: string;
    score: number | null;
    delta: number | null;
  } | null>(null);

  // 社会证明取数（公开接口，失败静默降级为不显示该行——非关键增强，不报错惊扰用户）
  useEffect(() => {
    fetch("/api/public/test-count")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => setTestCount(typeof data.count === "number" ? data.count : null))
      .catch((e) => console.warn("Test count fetch failed (该行将隐藏):", e));
  }, []);

  // 老用户最近报告取数（仅登录后，取最近 2 条算评分差）
  useEffect(() => {
    if (!user) return;
    fetch("/api/advisor/history?page=1&limit=2")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        const history = (data.history ?? []) as HistorySession[];
        if (history.length === 0) return;
        const score = history[0].analysisResult?.faceAnalysis?.overallScore ?? null;
        const prevScore = history[1]?.analysisResult?.faceAnalysis?.overallScore;
        setLatestReport({
          sessionId: history[0].sessionId,
          score,
          delta: score != null && prevScore != null ? score - prevScore : null,
        });
      })
      .catch((e) => console.error("Latest report fetch error:", e));
  }, [user]);

  // Capture ref parameter: moved to <RefCapture /> rendered in JSX (useSearchParams needs Suspense boundary)

  // 首页为一屏布局（h-dvh 不滚动），无需整页锁定 body 滚动；
  // 限额弹窗的滚动锁在其 state 声明后单独处理

  // Nickname state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  // 测肤有礼活动弹窗（替代原独立 /gift 页面）
  const [showGiftModal, setShowGiftModal] = useState(false);
  const openGiftModal = useCallback(() => setShowGiftModal(true), []);
  // FAQ 模态框（首页"常见问题"描边胶囊入口）
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [nickname, setNickname] = useState("");
  const [isHomeExiting, setIsHomeExiting] = useState(false);

  // 防止用户在 checkTestLimit 进行过程中关闭弹窗后，异步回调又重新打开弹窗
  const startCancelledRef = useRef(false);

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
    usedCount: number;
    dailyLimit: number;
    remaining: number;
    isGuest?: boolean;
    error?: string | null;
  } | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  // 限额弹窗打开时锁定背景滚动（整页锁定已随改版移除）
  useBodyScrollLock({ enabled: showLimitModal, iosSafe: true });
  // 限额弹窗焦点圈定 + Escape 关闭
  const limitModalRef = useFocusTrap<HTMLDivElement>(showLimitModal, () => setShowLimitModal(false));
  const [onboardingOpenCount, setOnboardingOpenCount] = useState(0);
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null);

  // Initialize guest identity on mount
  // 指纹采集（FingerprintJS）在主线程耗时数百 ms，错峰到浏览器空闲时执行，
  // 避免与首屏动画争抢主线程；Safari 不支持 requestIdleCallback，用 setTimeout 兜底
  useEffect(() => {
    const initGuestIdentity = async () => {
      try {
        const identity = await getGuestIdentity();
        setGuestIdentity(identity);
      } catch (error) {
        console.error('Failed to get guest identity:', error);
      }
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => initGuestIdentity(), { timeout: 3000 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = setTimeout(initGuestIdentity, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Check test limit with multi-factor identity
  const checkTestLimit = useCallback(async (allowRefresh = true): Promise<boolean> => {
    const runCheck = async (canRefresh: boolean): Promise<boolean> => {
      try {
        // Get fresh identity if not available
        let identity = guestIdentity;
        if (!identity) {
          identity = await getGuestIdentity();
          setGuestIdentity(identity);
        }

        const params = new URLSearchParams();
        params.set('cookieId', identity.cookieId);
        if (identity.fingerprint) {
          params.set('fingerprint', identity.fingerprint);
        }

        const res = await fetch(`/api/advisor/test-limit?${params.toString()}`);
        if (!res.ok) {
          const errorText = await res.text().catch(() => "未知错误");
          console.error("Test limit check failed:", res.status, errorText);
          return true; // Allow on error so the user is not blocked by a transient server issue
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

        return data.canTest;
      } catch (err) {
        console.error("Failed to check test limit:", err);
        return true; // Allow on error so the user is not blocked by a transient network issue
      }
    };

    return runCheck(allowRefresh);
  }, [guestIdentity, user, refreshUser]);


  // 防重复触发：限额检查是异步的，等待期间按钮仍可点，快速双击会并发跑两遍流程
  const startingRef = useRef(false);

  const handleStart = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    startCancelledRef.current = false;

    try {
      // Check test limit first
      const canTest = await checkTestLimit();

      // 用户在等待限额检查时已主动关闭弹窗/返回首页：中止后续流程并清理 loading 状态
      if (startCancelledRef.current) {
        return;
      }

      if (!canTest) {
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
            <Loader2 className="w-10 h-10 text-[#3D4430] animate-spin mb-6" />
            <p className="text-[#5E5E5E] text-[15px] font-medium tracking-wide">即将进入 AI 问卷...</p>
          </m.div>
        )}
      </AnimatePresence>

      {/* 首页 Kinetic 背景：米白底 + 点阵 + N 水印（与 nihplod.cn 主站一致，仅首页渲染） */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="kinetic-bg-base" />
        <div className="kinetic-dot-pattern" />
        <div className="kinetic-watermark">
          {/* PC 端水印（≥1025px 断点切换见 globals.css） */}
          <div
            className="kinetic-watermark-pc relative"
            style={{ filter: "brightness(0) invert(0.95)", opacity: 0.22 }}
          >
            <Image
              src="/images/N-web.svg"
              alt=""
              width={2800}
              height={800}
              style={{ objectFit: "contain" }}
              unoptimized
            />
          </div>
          {/* 移动端水印 - 竖版，深色水印在浅色背景上形成品牌纹理 */}
          <div
            className="kinetic-watermark-mobile absolute inset-0"
            style={{ filter: "brightness(0)" }}
          >
            <Image
              src="/images/watermark-mobile.webp"
              alt=""
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>

      {/* 顶部导航已移除，由根 layout 的 BottomDock 统一承担导航 */}

      {/* 内容区域 - 一屏布局（h-dvh 不滚动）；pb-dock 为底部 Dock 留白 */}
      <m.div
        className="relative z-20 flex flex-col h-dvh overflow-hidden pb-dock"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        animate={isHomeExiting ? (prefersReducedMotion ? { opacity: 0 } : { y: "-100%" }) : { opacity: 1, scale: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      >
          {/* 首屏主内容组：垂直居中，保证各端一屏放下 */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* 品牌区（layout 已提供唯一 <main> 地标，这里用 section 避免嵌套 main） */}
          <section className="relative z-10 flex flex-col items-center text-center px-6">
                <div className="z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
                  <div className="opacity-0 animate-fade-in-up flex flex-col items-center">
                    {/* 印章徽标（标题上方居中） */}
                    <m.div
                      className="mb-6 md:mb-8 inline-flex items-center"
                      initial={{ opacity: 0, scale: 1.5, y: -10, filter: "blur(2px)" }}
                      animate={{ opacity: [0, 1, 1], scale: [1.5, 0.97, 1], y: [-10, 0, 0], filter: ["blur(2px)", "blur(0px)", "blur(0px)"] }}
                      transition={{ delay: 0.5, duration: 0.45, ease: "easeOut", times: [0, 0.55, 1] }}
                    >
                      <Image
                        src="/images/jzp-eyebrow.png"
                        alt="肌智派"
                        width={514}
                        height={258}
                        className="h-8 md:h-10 w-auto opacity-90 mix-blend-multiply"
                        priority
                      />
                    </m.div>

                    {/* Title */}
                    <h1 className="text-[40px] sm:text-[48px] md:text-[58px] font-serif text-brand-charcoal font-light leading-[1.1] tracking-[0.02em] mb-6 md:mb-8">
                      在线 AI 测肤
                    </h1>

                    {/* 卖点与 CTA 已迁入下方主视觉卡 */}
                  </div>
                </div>
          </section>

          {/* 主视觉卡：浅色设计，藏青只留给标题与按钮；整卡可点击，触发 handleStart 流程（隐私同意 → 问卷） */}
          <section className="w-full px-6 md:px-12 mt-6 md:mt-8">
            <button
              onClick={handleStart}
              disabled={isLoading || isNavigating}
              className="group relative block w-full max-w-3xl mx-auto text-left bg-gradient-to-br from-white to-[#FBF7EE] border border-brand-charcoal/[0.08] rounded-3xl overflow-hidden cursor-pointer shadow-[0_8px_24px_rgba(0,38,62,0.06)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(0,38,62,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/40 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex flex-col md:flex-row md:items-center">
                <div className="flex-1 p-6 md:p-10">
                  <h2 className="text-xl md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4 md:mb-5">
                    开始完整肌肤检测
                  </h2>
                  {/* 三步流程预告：降低"点进去要干嘛"的不确定感（单行不折行） */}
                  <div className="flex items-center gap-x-2 whitespace-nowrap text-brand-charcoal/60 text-[12px] md:text-sm font-light tracking-[0.06em] mb-7 md:mb-9">
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
                  <span className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-charcoal text-white text-[13px] tracking-[0.12em] font-light transition-opacity duration-300 group-hover:opacity-90">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>正在连接</span>
                      </>
                    ) : (
                      <>
                        <span>立即开始</span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none" />
                      </>
                    )}
                  </span>
                </div>
                <div className="shrink-0 self-end md:self-center -mt-4 md:mt-0 md:pr-10 [@media(max-height:700px)]:hidden">
                  <Image
                    src="/images/character/guardian/guardian_female.webp"
                    alt="肌智派 IP 形象"
                    width={180}
                    height={280}
                    className="w-32 md:w-44 h-auto object-contain mx-auto"
                    priority
                  />
                </div>
              </div>
            </button>

            {/* 社会证明（≥100 人才显示） */}
            {testCount != null && testCount >= 100 && (
              <p className="mt-4 text-[12px] text-brand-charcoal/45 font-light tracking-[0.05em] text-center">
                已有 {testCount.toLocaleString()} 人完成测肤
              </p>
            )}

            {/* 老用户快捷入口：最近报告直达（新用户不渲染） */}
            {latestReport && (
              <Link
                href={`/reports/${latestReport.sessionId}`}
                className="mt-3 inline-flex items-center gap-1.5 min-h-[36px] text-[13px] text-brand-charcoal/70 hover:text-brand-charcoal transition-colors font-light tracking-[0.05em]"
              >
                <span>
                  最近测肤{latestReport.score != null && <> <span className="font-medium text-brand-charcoal">{latestReport.score}</span> 分</>}
                  {latestReport.delta != null && latestReport.delta !== 0 && (
                    <span className={latestReport.delta > 0 ? "text-[#4C8055]" : "text-[#D44C47]"}>
                      ，较上次 {latestReport.delta > 0 ? `+${latestReport.delta}` : latestReport.delta}
                    </span>
                  )}
                </span>
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Link>
            )}
          </section>

          {/* 次级入口：测肤有礼活动 + 常见问题（描边胶囊，同一视觉层级） */}
          <section className="flex flex-wrap items-center justify-center gap-3 px-6 mt-4 md:mt-6">
            <button
              onClick={openGiftModal}
              className="group inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full border border-brand-charcoal/25 text-brand-charcoal/70 text-[13px] font-light tracking-[0.08em] transition-all duration-300 hover:border-brand-charcoal/60 hover:text-brand-charcoal cursor-pointer touch-manipulation"
            >
              <Gift className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>测肤有礼 · 参与赢好礼</span>
            </button>
            <button
              onClick={() => setShowFaqModal(true)}
              className="group inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full border border-brand-charcoal/25 text-brand-charcoal/70 text-[13px] font-light tracking-[0.08em] transition-all duration-300 hover:border-brand-charcoal/60 hover:text-brand-charcoal cursor-pointer touch-manipulation"
            >
              <CircleHelp className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>常见问题</span>
            </button>
          </section>
          </div>

          {/* 页脚（移动端：沉底于 Dock 上方；桌面端见下方固定左下角版本） */}
          <div className="mt-auto pt-6 px-6 md:hidden">
            <HomepageFooter />
          </div>
        </m.div>

      {/* 桌面端页脚：固定屏幕底部通栏，备案居左、链接与版权居右（z 高于内容层 z-20、低于 Dock） */}
      <div className="hidden md:block fixed bottom-2 left-4 right-4 z-30">
        <HomepageFooter />
      </div>

      {/* "测肤有礼"入口为主视觉卡下方的描边胶囊（见上方次级入口区），不再使用右下角悬浮卡片 */}

      {/* Modals */}
      <GiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        onStartTest={() => {
          setShowGiftModal(false);
          handleStart();
        }}
      />
      <FaqModal
        isOpen={showFaqModal}
        onClose={() => setShowFaqModal(false)}
      />
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
              className="relative z-10 w-full max-w-[420px] bg-white rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowLimitModal(false)}
                aria-label="关闭"
                className="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
                    className="h-[34px] object-contain"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="px-10 pb-10 pt-2 flex flex-col items-center gap-6">
                <div className="text-center space-y-2">
                  <h2 id="limit-modal-title" className="text-base font-bold" style={{ color: '#5c4937' }}>
                    今日测试次数已用完
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: '#5c4937', opacity: 0.8 }}>
                    {(() => {
                      const info = testLimitInfo;
                      const dailyLimit = info?.dailyLimit ?? (user ? 3 : 1);
                      const remaining = info?.remaining ?? 0;
                      // 被封禁/限制但仍有剩余次数：展示限制原因而非次数信息
                      if (remaining > 0) {
                        return <>{info?.error || "当前暂时无法开始测肤，请稍后再试"}</>;
                      }
                      return (
                        <>
                          今日测试次数已用完（共 {dailyLimit} 次）
                          {!user && (
                            <><br />登录会员可获更多次数，立即注册解锁完整权益</>
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
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#5c4937] py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95 hover:bg-[#4a3a2c]"
                    >
                      登录 / 注册
                    </button>
                  )}
                  <button
                    onClick={() => setShowLimitModal(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-[#5c4937]/10 bg-white py-3 text-sm font-medium text-[#5c4937] transition-colors hover:bg-[#5c4937]/5 active:scale-95"
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
