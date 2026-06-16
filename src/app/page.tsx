"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { LazyMotion, domAnimation, AnimatePresence, m } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Loader2, MapPin, ClipboardList, X, CircleAlert } from "lucide-react";

import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { getGuestIdentity, type GuestIdentity } from "@/lib/guest-identity";
import { CONSENT_VERSION } from "@/components/advisor/PrivacyConsent";
import dynamic from "next/dynamic";

const ProfileModal = dynamic(() => import("@/components/auth/ProfileModal").then((mod) => mod.ProfileModal), { ssr: false });
const BaseModal = dynamic(() => import("@/components/ui/BaseModal").then((mod) => mod.BaseModal), { ssr: false });
const OnboardingFlowModal = dynamic(() => import("@/components/advisor/OnboardingFlowModal").then((mod) => mod.OnboardingFlowModal), { ssr: false });
const HomepageFooter = dynamic(() => import("@/components/website/HomepageFooter").then((mod) => mod.HomepageFooter), { ssr: false });


// Safe storage helper to prevent QuotaExceededError or Privacy Mode crashes
const safeStorage = {
  get: (key: string) => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch (e) { console.warn("Failed to write to localStorage", e); }
  },
  remove: (key: string) => {
    try { localStorage.removeItem(key); } catch (e) { console.warn("Failed to remove from localStorage", e); }
  },
  setSession: (key: string, value: string) => {
    try { sessionStorage.setItem(key, value); } catch (e) { console.warn("Failed to write to sessionStorage", e); }
  }
};

// Region options
const regionOptions = [
  { group: "华北/东北", regions: ["北京", "天津", "河北", "山西", "内蒙古", "黑龙江", "吉林", "辽宁"] },
  { group: "华东", regions: ["上海", "江苏", "浙江", "山东", "安徽", "江西"] },
  { group: "华南", regions: ["广东", "广西", "海南", "福建", "台湾"] },
  { group: "华中/西南", regions: ["湖北", "湖南", "河南", "四川", "重庆", "贵州", "云南"] },
  { group: "西北", regions: ["陕西", "甘肃", "宁夏", "新疆"] },
  { group: "高原", regions: ["西藏", "青海"] },
];

export default function Home() {
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { initSession } = useAdvisorAnalytics();
  const { user, refresh: refreshUser } = useAuth();

  const spotlightRef = useRef<HTMLDivElement>(null);

  // 柔光聚光灯跟随效果
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(200, 185, 160, 0.08), transparent 40%)`;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Initialize session
  useEffect(() => {
    initSession();
    router.prefetch("/questions");
  }, [initSession, router]);

  // Nickname state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [nickname, setNickname] = useState("");
  const [isHomeExiting, setIsHomeExiting] = useState(false);

  // Location/Region states
  const [isLocating, setIsLocating] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  // Region options moved outside component

  /* --- Handlers --- */

  const startNewTest = useCallback(() => {
    // Clear previous advisor state to ensure fresh start
    safeStorage.remove("advisor_answers");
    safeStorage.remove("advisor_gender");
    safeStorage.remove("advisor_face_images");
    safeStorage.remove("advisor_result");
    safeStorage.remove("advisor_gender_mismatch_ack");
    safeStorage.remove("advisor_free_retry");
    safeStorage.remove("advisor_step");

    setIsLoading(true);
    router.push("/questions");
  }, [router]);

  const handleLocationAccept = async () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
          });
        });

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
    safeStorage.setSession("locationConsent", "granted");
    safeStorage.set("userRegion", JSON.stringify({ province: region, city: region }));
    // Do not close or start test here, let legal step handle it
  };

  const handleSkipRegionSelect = () => {
    // This is now repurposed as the FINAL completion handler from the Legal step
    setShowOnboardingModal(false);
    setIsLoading(true);
    
    // Ensure consent is recorded if not already set by location/region steps
    if (!sessionStorage.getItem("locationConsent")) {
        safeStorage.setSession("locationConsent", "declined");
    }

    // Record privacy consent from the legal step
    safeStorage.set("advisor_privacy_consent", JSON.stringify({
        version: CONSENT_VERSION,
        consentedAt: new Date().toISOString()
    }));
    
    recordAndStartTest();
  };

  const handleLocationDecline = () => {
    // Declining loc will naturally open Region Select, but handled by OnboardingFlowModal now implicitly via callback
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
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
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
  const checkTestLimit = useCallback(async () => {
    setCheckingLimit(true);
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
      if (res.ok) {
        const data = await res.json();
        setTestLimitInfo(data);

        // Frontend safeguard: if frontend thinks user is logged in but backend treats as guest,
        // the JWT token may be invalid/mismatched. Refresh user state and warn.
        if (user && data.isGuest) {
          console.warn("[Auth Mismatch] Frontend has user but backend returned guest. Refreshing session...");
          await refreshUser();
          toast.info("登录状态已刷新，请重新尝试");
          // After refresh, allow the test to proceed; next check will use fresh state
          return true;
        }

        // Check if blocked
        if (data.isBlocked) {
          return false;
        }
        return data.canTest;
      }
      return true; // Allow on error
    } catch (err) {
      console.error("Failed to check test limit:", err);
      return true; // Allow on error
    } finally {
      setCheckingLimit(false);
    }
  }, [guestIdentity, user, refreshUser, toast]);

  // Start test directly — usage will be recorded by analyze API
  const recordAndStartTest = useCallback(async () => {
    startNewTest();
  }, [startNewTest]);

  const handleStart = async () => {
    // Check test limit first
    const canTest = await checkTestLimit();
    if (!canTest) {
      setShowLimitModal(true);
      return;
    }

    // If user is logged in and has a name, pre-fill it and let the modal handle skipping the step
    if (user?.name) {
      setNickname(user.name);
      safeStorage.set("advisor_nickname", user.name);
    }
    setIsHomeExiting(true);
    setShowOnboardingModal(true);
  };

  const handleNicknameSubmit = () => {
    if (!nickname.trim()) {
      toast.error("请输入您的昵称");
      return;
    }
    // Save nickname to localStorage
    safeStorage.set("advisor_nickname", nickname.trim());
  };



  return (
    <LazyMotion features={domAnimation}>
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
            <p className="text-[#5E5E5E] text-[15px] font-medium tracking-wide">即将进入 AI 问卷...</p>
          </m.div>
        )}
      </AnimatePresence>

      {/* 全局顶部导航 */}
      <WebsiteNavbar />

      {/* 内容区域容器 - 全屏显示 */}
      <m.div
        className="fixed inset-0 z-20"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={isHomeExiting ? { y: "-100%" } : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className="h-full">
          <div className="relative z-20 w-full h-full bg-[#F5F2E9]">
            <div className="home-container relative h-full w-full">
              {/* Spotlight Follow */}
              <div
                ref={spotlightRef}
                className="absolute inset-0 z-[1] pointer-events-none"
              />

              {/* Main Content Area */}
              <main className="main-content relative z-10 w-full flex h-full flex-col items-center justify-center text-center pb-16 lg:pb-12">
                {/* Center AI Actions */}
                <div className="z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto pt-28 md:pt-36 lg:pt-44">
                  <div className="animate-fade-in-up flex flex-col items-center">
                    {/* Eyebrow */}
                    <p className="text-xs uppercase tracking-[0.3em] text-[#8B7355] mb-6 md:mb-8 opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
                      AI Skin Analysis
                    </p>

                    {/* Title */}
                    <h1 className="text-[40px] sm:text-[48px] md:text-[58px] font-serif text-[#1A1A1A] font-normal leading-[1.1] tracking-tight mb-8 md:mb-10">
                      在线素颜测肤
                    </h1>

                    {/* Description */}
                    <p className="text-[#5C5855]/90 leading-[1.9] mb-12 md:mb-16 max-w-xl mx-auto font-light text-sm sm:text-base tracking-wide opacity-0 animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                      为了精准分析你的肌肤状态并生成专业定制化报告，<br className="hidden sm:block" />接下来我们将引导您<br className="sm:hidden" />进行个性化问卷调查与多维面部肌肤分析，<br />整个过程预计占用 <span className="text-[#3D4430]/80">2-5 分钟</span>。
                    </p>

                    {/* CTA + Guide + History */}
                    <div className="flex flex-col items-center gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                      <button
                        onClick={handleStart}
                        disabled={isLoading || checkingLimit}
                        className="group relative inline-flex items-center justify-center gap-4 px-12 py-4 sm:px-16 border border-[#3D4430]/25 hover:border-[#3D4430]/50 hover:bg-[#3D4430]/[0.03] text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-500"
                      >
                        {isLoading || checkingLimit ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>正在连接</span>
                          </>
                        ) : (
                          <>
                            <span>立即开启</span>
                            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                          </>
                        )}
                      </button>

                      <Link
                        href="/skin-types"
                        className="group inline-flex items-center justify-center gap-3 text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/60 hover:text-[#3D4430] font-medium transition-colors duration-500"
                      >
                        <span>探索 10 种肌肤类型</span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Homepage Footer */}
                <HomepageFooter />
              </main>
            </div>
          </div>
        </div>
      </m.div>

      {/* Modals */}
      <OnboardingFlowModal
        isOpen={showOnboardingModal}
        onClose={() => {
          setShowOnboardingModal(false);
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

      {/* 测试准备指南模态框 */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuideModal(false)}
              className="absolute inset-0 bg-[#2d2a26]/40 backdrop-blur-md"
            />

            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="relative z-10 w-full max-w-[420px] overflow-hidden flex flex-col max-h-[85vh]"
              style={{
                background: 'linear-gradient(180deg, #F8F6F1 0%, #F3F0E9 100%)',
                borderRadius: 24,
                boxShadow: '0 32px 64px -16px rgba(45, 42, 38, 0.25), inset 0 1px 1px rgba(255,255,255,0.6)',
                border: '1px solid rgba(139, 115, 85, 0.15)',
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowGuideModal(false)}
                className="absolute top-5 right-5 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{ background: 'rgba(139, 115, 85, 0.08)', color: '#8B7355' }}
              >
                <X size={15} strokeWidth={2.5} />
              </button>

              {/* Header */}
              <div className="px-8 pt-10 pb-6 text-center shrink-0">
                <div className="flex justify-center">
                  <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={120}
                    height={30}
                    className="h-[30px] object-contain opacity-80"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar">
                <div className="flex flex-col gap-3">
                  {[
                    { title: "素颜状态", desc: "彻底卸除底妆、防晒及彩妆产品，确保面部处于完全素颜状态。" },
                    { title: "光线充足", desc: "在自然光或柔和灯光下进行，避免强光直射、背光或昏暗环境。" },
                  ].map((item, i) => (
                    <m.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-xl transition-colors"
                      style={{ background: 'rgba(139, 115, 85, 0.04)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(139, 115, 85, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(139, 115, 85, 0.04)';
                      }}
                    >
                      <span
                        className="mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{ background: 'rgba(61, 68, 48, 0.1)', color: '#3D4430' }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold mb-0.5" style={{ color: '#2d2a26' }}>{item.title}</p>
                        <p className="text-[12px] leading-relaxed" style={{ color: '#8c7a6b' }}>{item.desc}</p>
                      </div>
                    </m.div>
                  ))}
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

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
                    {user ? (
                      <>您今日的 {testLimitInfo?.dailyLimit || 1} 次测试机会已全部使用，请明天再来</>
                    ) : (
                      <>游客每天仅有 {testLimitInfo?.dailyLimit || 3} 次测试机会<br />登录后可获得更多测试次数</>
                    )}
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

      {/* Brand Modal */}
      <AnimatePresence>
        {showBrandModal && (
          <m.div
            className="fixed inset-0 z-[300] bg-[#FDFBF7] flex flex-col overflow-hidden"
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
          >
            {/* Texture overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
              }}
            />

            {/* Close Button */}
            <button
              onClick={() => setShowBrandModal(false)}
              className="fixed top-6 right-6 z-[310] w-10 h-10 flex items-center justify-center text-[#1A1A1A]/30 hover:text-[#1A1A1A] hover:bg-black/5 transition-all duration-300 bg-transparent border-none cursor-pointer"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-10 md:px-20 py-14">
              <div className="max-w-6xl xl:max-w-7xl w-full">

                {/* Header */}
                <div className="text-center mb-10 md:mb-14">
                  <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={200}
                    height={60}
                    className="h-9 md:h-11 object-contain mx-auto"
                  />
                </div>

                {/* Main: 图片左 + 文字右 */}
                <div className="grid grid-cols-1 md:grid-cols-[5fr_5fr] gap-10 md:gap-12 items-stretch">
                  {/* Image */}
                  <div className="relative min-h-[340px] md:min-h-[520px] -ml-6 md:-ml-12">
                    {/* 上方图片 - 海豚灵感 */}
                    <div className="absolute top-0 left-0 w-[80%] h-[62%] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 border-4 border-white/90">
                      <img
                        src="/images/story/dolphin-ocean.webp"
                        alt="海豚灵感"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* 下方图片 - 研发团队 */}
                    <div className="absolute bottom-0 right-0 w-[72%] h-[52%] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-20 border-4 border-white/90">
                      <img
                        src="/images/story/lab-research.webp"
                        alt="研发团队"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="flex flex-col justify-center text-left py-2">
                    <p className="text-[13px] text-[#8B7355] tracking-[0.25em] uppercase font-medium mb-5">
                      化繁为简 · 逆转时光
                    </p>
                    <h3 className="text-[26px] md:text-[32px] font-serif text-[#1A1A1A] mb-6 leading-tight tracking-tight">
                      将逆转时光的不可能，慢慢变得「有可能」
                    </h3>
                    <p className="text-base md:text-lg text-[#5E5E5E] leading-[1.9] font-light">
                      旎柏始终坚持正确且积极的科学理念。通过化繁为简的居家修护及高效舒适的院线调理，尽可能的帮助人们解决并预防各类肌肤问题。NIHPLOD 源于「DOLPHIN」的逆转——灵感来自海豚肌肤每两小时自我更新的神奇修复力。创始人 Dr. Stefan 博士将前沿技术与天然活性成分结合，为每一款产品注入前沿科技，使护肤调理变得简单、高效且美好。
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="text-center mt-12 md:mt-16">
                  <a
                    href="https://nihplod.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowBrandModal(false)}
                    className="inline-flex items-center gap-2 py-2 text-[14px] tracking-[0.2em] font-medium text-[#8B7355] cursor-pointer transition-all duration-300 bg-transparent border-none outline-none group"
                  >
                    <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">前往官网</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </LazyMotion>
  );
}
