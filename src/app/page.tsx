"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { LazyMotion, domAnimation, AnimatePresence, m } from "framer-motion";
import Image from "next/image";
import { ArrowRight, House, Loader2, MapPin, User, ClipboardList, X, CircleAlert } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";

import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { getGuestIdentity, type GuestIdentity } from "@/lib/guest-identity";
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

  // Location/Region states
  const [isLocating, setIsLocating] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

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

      {/* 内容区域容器 - 全屏显示 */}
      <m.div
        className="fixed inset-0 z-20"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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
                {/* Top Navigation Hooks */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] flex items-center justify-between z-50">
                  <a
                    href="https://nihplod.cn"
                    className="group flex items-center gap-2 text-[13px] font-medium tracking-[0.2em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors duration-500 no-underline cursor-pointer relative z-10"
                  >
                    <House className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="hidden sm:inline relative">
                      返回官网
                      <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                    </span>
                  </a>

                  <div className="relative z-10">
                    {user ? (
                      <button
                        onClick={() => setShowProfileModal(true)}
                        className="group flex items-center gap-2 text-[13px] font-medium tracking-[0.2em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors duration-500 cursor-pointer"
                      >
                        <User className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
                        <span className="hidden sm:inline relative">
                          {user.name || '测肤记录'}
                          <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openAuthModal('login')}
                        className="group flex items-center gap-2 text-[13px] font-medium tracking-[0.2em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors duration-500 cursor-pointer"
                      >
                        <User className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
                        <span className="hidden sm:inline relative">
                          登录 / 注册
                          <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Center AI Actions */}
                <div className="z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto pt-4 lg:pt-8">
                  <div className="animate-fade-in-up flex flex-col items-center">
                    {/* Logo */}
                    <Image
                      src="/NIHPLOD-logo.svg"
                      alt="NIHPLOD 旎柏"
                      width={260}
                      height={78}
                      priority
                      className="h-9 sm:h-10 md:h-12 object-contain mb-14 md:mb-20"
                    />

                    {/* Title */}
                    <h1 className="text-[36px] sm:text-[44px] md:text-[52px] font-serif text-[#1A1A1A] font-normal leading-[1.1] tracking-tight mb-12 md:mb-16">
                      在线素颜测肤
                    </h1>

                    {/* Description */}
                    <p className="text-[#5C5855]/70 leading-[1.9] mb-16 md:mb-24 max-w-xl mx-auto font-light text-sm sm:text-base tracking-wide opacity-0 animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                      为了精准分析你的肌肤状态并生成专业定制化报告，<br className="hidden sm:block" />接下来我们将引导您进行个性化问卷调查与多维面部肌肤分析，<br className="hidden sm:block" />整个过程预计占用 <span className="text-[#3D4430]/80">2-5 分钟</span>。
                    </p>

                    {/* CTA + Guide + History */}
                    <div className="flex flex-col items-center gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                      <button
                        onClick={handleStart}
                        disabled={isLoading || checkingLimit}
                        className="group relative inline-flex items-center justify-center gap-4 px-10 py-3.5 sm:px-14 border border-[#3D4430]/25 hover:border-[#3D4430]/50 hover:bg-[#3D4430]/[0.03] text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-500"
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

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </LazyMotion>
  );
}
