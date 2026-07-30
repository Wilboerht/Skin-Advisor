"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { useSearchParams } from "next/navigation";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Loader2, X } from "lucide-react";

import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

import { useAuthModal } from "@/components/auth/AuthModalContext";
import { AuthUrlDetector } from "@/components/auth/AuthUrlDetector";
import { getGuestIdentity, type GuestIdentity } from "@/lib/guest-identity";
import { CONSENT_VERSION } from "@/components/advisor/PrivacyConsent";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import dynamic from "next/dynamic";
const OnboardingFlowModal = dynamic(() => import("@/components/advisor/OnboardingFlowModal").then((mod) => mod.OnboardingFlowModal), { ssr: false });
const HomepageFooter = dynamic(() => import("@/components/website/HomepageFooter").then((mod) => mod.HomepageFooter), { ssr: false });


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

export default function Home() {
  const router = useTransitionRouter();
  const { openAuthModal } = useAuthModal();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"scan" | "questionnaire" | null>(null);
  const [scanMode, setScanMode] = useState<"scan" | "questionnaire" | null>(null);
  const { initSession } = useAdvisorAnalytics();
  const { user, refresh: refreshUser } = useAuth();

  const prefersReducedMotion = useReducedMotion();

  // Initialize session
  useEffect(() => {
    initSession();
    router.prefetch("/questions");
  }, [initSession, router]);

  // Capture ref parameter: moved to <RefCapture /> rendered in JSX (useSearchParams needs Suspense boundary)

  // 首页锁定 body 滚动，防止 iPhone 上出现滚动条 / overscroll
  useBodyScrollLock({ enabled: true, iosSafe: true });

  // Nickname state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
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
    safeStorage.remove(STORAGE_KEYS.ADVISOR_NICKNAME);
    // 保留 advisor_scan_mode：它是本次新测试的入口模式，清除后纯问卷模式会被误判为 AI 扫描模式

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
    router.push("/questions");
  }, [router]);

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
    
    startNewTest();
  };

  const handleLocationDecline = () => {
    // Declining loc will naturally open Region Select, but handled by OnboardingFlowModal now implicitly via callback
    locationRequestId.current += 1;
    safeStorage.setSession("locationConsent", "declined");
  };

  // Test limit state
  const [testLimitInfo, setTestLimitInfo] = useState<{
    canTest: boolean;
    usedCount: number;
    dailyLimit: number;
    remaining: number;
    isBlocked?: boolean;
    blockReason?: string | null;
  } | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [onboardingOpenCount, setOnboardingOpenCount] = useState(0);
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null);

  // Initialize guest identity on mount
  useEffect(() => {
    const initGuestIdentity = async () => {
      try {
        const identity = await getGuestIdentity();
        setGuestIdentity(identity);
      } catch (error) {
        console.error('Failed to get guest identity:', error);
      }
    };
    initGuestIdentity();
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

        // Frontend safeguard: if frontend thinks user is logged in but backend treats as guest,
        // the JWT token may be invalid/mismatched. Refresh user state and re-check once.
        if (user && data.isGuest && canRefresh) {
          console.warn("[Auth Mismatch] Frontend has user but backend returned guest. Refreshing session...");
          await refreshUser();
          return runCheck(false);
        }

        // Check if blocked
        if (data.isBlocked) {
          return false;
        }
        return data.canTest;
      } catch (err) {
        console.error("Failed to check test limit:", err);
        return true; // Allow on error so the user is not blocked by a transient network issue
      }
    };

    return runCheck(allowRefresh);
  }, [guestIdentity, user, refreshUser]);


  const handleStart = useCallback(async (mode: "scan" | "questionnaire" = "scan") => {
    // Save scan mode for downstream routing (questions page checks this to decide next step)
    safeStorage.set("advisor_scan_mode", mode);

    // 精准标记被点击的按钮，避免两个按钮同时转圈
    startCancelledRef.current = false;
    setLoadingMode(mode);
    setScanMode(mode);

    // Check test limit first
    const canTest = await checkTestLimit();

    // 用户在等待限额检查时已主动关闭弹窗/返回首页：中止后续流程并清理 loading 状态
    if (startCancelledRef.current) {
      setLoadingMode(null);
      return;
    }

    if (!canTest) {
      setLoadingMode(null);
      setShowLimitModal(true);
      return;
    }

    // 问卷模式 + 已登录：直通问卷，跳过昵称/定位/合规引导
    // 但仍需存储隐私同意标记，否则 questions 页入口守卫会拦截
    if (mode === "questionnaire" && user) {
      safeStorage.set(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT, JSON.stringify({
        version: CONSENT_VERSION,
        consentedAt: new Date().toISOString()
      }));
      startNewTest();
      return;
    }

    // 用户在 checkTestLimit 完成后、打开弹窗前又关闭了：清理状态并中止
    if (startCancelledRef.current) {
      setLoadingMode(null);
      return;
    }

    // If user is logged in and has a name, pre-fill it and let the modal handle skipping the step
    if (user?.name) {
      setNickname(user.name);
      safeStorage.set("advisor_nickname", user.name);
    }
    setIsHomeExiting(true);
    if (!showOnboardingModal) {
      setOnboardingOpenCount(prev => prev + 1);
    }
    setShowOnboardingModal(true);
  }, [checkTestLimit, user, startNewTest, showOnboardingModal]);

  const handleNicknameSubmit = () => {
    if (!nickname.trim()) {
      return;
    }
    // Save nickname to localStorage
    safeStorage.set("advisor_nickname", nickname.trim());
  };



  return (
    <LazyMotion features={domAnimation}>
      <Suspense fallback={null}>
        <AuthUrlDetector />
        <RefCapture />
      </Suspense>

      {/* Full Screen Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#FDFBF7] flex flex-col items-center justify-center pointer-events-none"
          >
            <Loader2 className="w-10 h-10 text-[#3D4430] animate-spin mb-6" />
            <p className="text-[#5E5E5E] text-[15px] font-medium tracking-wide">{scanMode === "questionnaire" ? "正在进入肌肤测评..." : "即将进入 AI 问卷..."}</p>
          </m.div>
        )}
      </AnimatePresence>

      {/* 全局顶部导航 */}
      <WebsiteNavbar />

      {/* 内容区域容器 - 全屏显示 */}
      <m.div
        className="fixed inset-0 z-20 flex flex-col bg-[#F8F7F3]"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        animate={isHomeExiting ? (prefersReducedMotion ? { opacity: 0 } : { y: "-100%" }) : { opacity: 1, scale: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className="home-container relative flex flex-col flex-1 w-full">
          {/* Main Content Area */}
          <main className="main-content relative z-10 flex flex-col flex-1 items-center justify-center text-center px-6 pt-24 md:pt-28">
                {/* Center AI Actions */}
                <div className="z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
                  <div className="opacity-0 animate-fade-in-up flex flex-col items-center">
                    {/* Eyebrow */}
                    <m.div
                      className="w-full max-w-xl mb-10 md:mb-12"
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.12 } },
                      }}
                    >
                      <span className="inline-flex items-center gap-2.5 text-[13px] md:text-base font-medium tracking-[0.3em] text-[#8B7355] uppercase">
                        <m.span
                          className="block w-5 h-px bg-gradient-to-r from-transparent to-[#C8A27A]/50"
                          variants={{
                            hidden: { scaleX: 0, opacity: 0 },
                            visible: { scaleX: 1, opacity: 1, transition: { duration: 0.6, ease: [0.65, 0, 0.35, 1] } },
                          }}
                          style={{ transformOrigin: "right center" }}
                        />
                        <m.span
                          className="inline-flex items-center gap-2"
                          variants={{
                            hidden: { opacity: 0 },
                            visible: { opacity: 1, transition: { duration: 0.3 } },
                          }}
                        >
                          <Image src="/images/jzp-badge.svg" alt="" width={36} height={36} className="w-6 h-6 object-contain" />
                          肌智派
                        </m.span>
                        <m.span
                          className="block w-5 h-px bg-gradient-to-r from-[#C8A27A]/50 to-transparent"
                          variants={{
                            hidden: { scaleX: 0, opacity: 0 },
                            visible: { scaleX: 1, opacity: 1, transition: { duration: 0.6, ease: [0.65, 0, 0.35, 1] } },
                          }}
                          style={{ transformOrigin: "left center" }}
                        />
                      </span>
                    </m.div>

                    {/* Title */}
                    <h1 className="text-[40px] sm:text-[48px] md:text-[58px] font-serif text-brand-charcoal font-light leading-[1.1] tracking-[0.02em] mb-10 md:mb-12">
                      在线素颜测肤
                    </h1>

                    {/* Info Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2.5 md:gap-3 mb-10 md:mb-12 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                      {["2-5 分钟完成", "多维度精准肌肤状态检测", "定制化专属报告"].map((chip) => (
                        <span
                          key={chip}
                          className="px-4 py-1.5 rounded-full border border-brand-charcoal/15 text-brand-charcoal/60 text-[12px] md:text-[13px] font-light tracking-[0.15em] transition-colors duration-300 hover:border-brand-charcoal/30 hover:text-brand-charcoal/80"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>

                    {/* CTA + Guide + History */}
                    <div className="flex flex-col items-center gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                      {/* 双模式 CTA */}
                      <div className="flex flex-col items-center gap-3 w-full max-w-md">
                        {/* 面部扫描 - 主推 */}
                        <button
                          onClick={() => handleStart("scan")}
                          disabled={loadingMode !== null || isLoading}
                          className="group relative w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 text-[13px] sm:text-[14px] tracking-[0.1em] font-medium cursor-pointer border border-brand-charcoal/60 text-brand-charcoal bg-transparent transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {loadingMode === "scan" ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>正在连接</span>
                            </>
                          ) : (
                            <>
                              <span>开始完整肌肤检测</span>
                              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
                            </>
                          )}
                        </button>

                        {/* 纯问卷 - 备选 */}
                        <button
                          onClick={() => handleStart("questionnaire")}
                          disabled={loadingMode !== null || isLoading}
                          className="group relative w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 text-[13px] sm:text-[14px] tracking-[0.1em] font-medium cursor-pointer text-brand-charcoal/60 transition-colors duration-500 hover:text-brand-charcoal disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {loadingMode === "questionnaire" ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>正在连接</span>
                            </>
                          ) : (
                            <>
                              <span>了解你的肤质类型（仅问卷）</span>
                            </>
                          )}
                        </button>
                      </div>



                    </div>
                  </div>
                </div>

            </main>

            {/* Homepage Footer */}
            <HomepageFooter />
          </div>
        </m.div>

      {/* Modals */}
      <OnboardingFlowModal
        key={onboardingOpenCount}
        isOpen={showOnboardingModal}
        onClose={() => {
          // 标记用户已主动取消，防止 handleStart 中待完成的异步回调重新打开弹窗或恢复 loading
          startCancelledRef.current = true;
          setShowOnboardingModal(false);
          setIsHomeExiting(false);
          setIsLoading(false);
          setLoadingMode(null);
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
        mode={scanMode ?? "scan"}
      />

      <AnimatePresence>
        {showLimitModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
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
                  <h3 className="text-base font-bold" style={{ color: '#5c4937' }}>
                    今日测试次数已用完
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#5c4937', opacity: 0.8 }}>
                    {(() => {
                      const info = testLimitInfo;
                      const dailyLimit = info?.dailyLimit ?? (user ? 3 : 1);
                      const usedCount = info?.usedCount ?? dailyLimit;
                      const remaining = info?.remaining ?? 0;
                      if (remaining > 0) {
                        return <>您今日已用 {usedCount} 次，共 {dailyLimit} 次，剩余 {remaining} 次</>;
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
