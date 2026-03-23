"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { LazyMotion, domAnimation, AnimatePresence, m } from "framer-motion";
import Image from "next/image";
import { ArrowRight, House, Loader2, MapPin, User, ClipboardList, ChevronDown } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useLayout } from "@/contexts/LayoutContext";
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
  const { user } = useAuth();
  const { isDrawerOpen, setDrawerOpen, showBento, setShowBento } = useLayout();
  const textureRef = useRef<HTMLDivElement>(null);

  // 首页特殊处理：立即设置抽屉为展开状态，并隐藏便当盒
  useEffect(() => {
    setDrawerOpen(true);
    setShowBento(false);
  }, [setDrawerOpen, setShowBento]);

  // 鼠标视差效果
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawerOpen) return;

      const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.01;

      if (textureRef.current) {
        textureRef.current.style.transform = `translate(${moveX * 0.5}px, ${moveY * 0.5}px)`;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isDrawerOpen]);

  // Initialize session
  useEffect(() => {
    initSession();
    router.prefetch("/questions");
  }, [initSession, router]);

  // Nickname state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
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
  }, [guestIdentity]);

  // Record test and start with multi-factor identity
  const recordAndStartTest = useCallback(async () => {
    try {
      // Get fresh identity if not available
      let identity = guestIdentity;
      if (!identity) {
        identity = await getGuestIdentity();
        setGuestIdentity(identity);
      }

      const sessionId = safeStorage.get("advisor_session_id");
      await fetch("/api/advisor/test-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookieId: identity.cookieId,
          fingerprint: identity.fingerprint,
          sessionId
        })
      });
    } catch (err) {
      console.error("Failed to record test:", err);
    }
    startNewTest();
  }, [guestIdentity, startNewTest]);

  const handleStart = async () => {
    // Check test limit first
    const canTest = await checkTestLimit();
    if (!canTest) {
      setShowLimitModal(true);
      return;
    }

    // 进入问卷时收起抽屉
    setDrawerOpen(false);

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

      {/* 内容区域容器 */}
      <m.div
        className="safe-area-content !-top-[1px] !pointer-events-none"
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* 主内容区域 + 展开按钮一体化 */}
        <m.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full pointer-events-none"
        >
          {/* 主内容区域 - 抽屉 + 按钮一体化容器 */}
          <div className="flex h-full flex-col items-center pointer-events-none">
            {/* 主内容区域 - 抽屉 - z-20 Ensure it sits on top of the button */}
            <m.div
              className="relative z-20 w-full overflow-hidden rounded-b-2xl bg-[#F0EDE1] lg:rounded-b-3xl pointer-events-auto shadow-2xl"
              style={{ willChange: "flex-grow, height" }}
              initial={{ height: 0, flexGrow: 0 }}
              animate={{
                flexGrow: isDrawerOpen ? 1 : 0,
                height: !isDrawerOpen ? 0 : "auto"
              }}
              transition={{
                duration: 1.2,
                ease: [0.22, 1, 0.36, 1],
                delay: isDrawerOpen ? 0.3 : 0
              }}
            >
              <div className={`home-container relative h-full w-full transition-opacity duration-500 ${isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                {/* Texture Overlay */}
                <div
                  ref={textureRef}
                  className="mineral-texture absolute -inset-10 z-0 opacity-40 transition-transform duration-1000 ease-out"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                  }}
                />

                {/* Main Content Area */}
                <main className="main-content relative z-10 w-full flex h-full flex-col items-center justify-center text-center pb-32 lg:pb-24">
                  {/* Top Navigation Hooks */}
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] flex items-center justify-between z-50">
                    <a
                      href="https://demo.nihplod.cn"
                      className="group flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium tracking-[0.2em] text-[#3D4430]/40 hover:text-[#3D4430] hover:bg-white/40 border border-[#3D4430]/10 hover:border-[#3D4430]/20 transition-all duration-500 backdrop-blur-sm no-underline cursor-pointer relative z-10"
                    >
                      <House className="w-3.5 h-3.5 transition-transform group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                      <span className="hidden sm:inline">返回官网</span>
                    </a>



                    <div className="relative z-10">
                      {user ? (
                        <button
                          onClick={() => setShowProfileModal(true)}
                          className="group flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium tracking-[0.2em] text-[#3D4430]/40 hover:text-[#3D4430] hover:bg-white/40 border border-[#3D4430]/10 hover:border-[#3D4430]/20 transition-all duration-500 backdrop-blur-sm cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5 transition-transform group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                          <span className="hidden sm:inline">{user.name || '我的档案'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openAuthModal('login')}
                          className="group flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium tracking-[0.2em] text-[#3D4430]/40 hover:text-[#3D4430] hover:bg-white/40 border border-[#3D4430]/10 hover:border-[#3D4430]/20 transition-all duration-500 backdrop-blur-sm cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5 transition-transform group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                          <span className="hidden sm:inline">登录 / 注册</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Center AI Actions */}
                  <div className="z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto pt-4 lg:pt-8">
                    <div className="animate-fade-in-up flex flex-col items-center border-[0px] border-red-500">
                      {/* Logo (Moved from top bar) */}
                      <Image
                        src="/NIHPLOD-logo.svg"
                        alt="NIHPLOD 旎柏"
                        width={260}
                        height={78}
                        priority
                        className="h-8 sm:h-9 md:h-12 object-contain opacity-90 mix-blend-multiply mb-12 md:mb-16"
                      />
                      
                      <h1 className="text-[32px] sm:text-4xl md:text-5xl font-serif text-[#1A1A1A] mb-8 leading-tight tracking-tight whitespace-nowrap">
                        AI 智能测肤
                      </h1>

                      <p className="text-[#5C5855]/90 leading-relaxed mb-14 max-w-xl mx-auto font-light text-[16px] opacity-0 animate-fade-in-up tracking-wide" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                        源自摩纳哥真脂质体科技，<br className="sm:hidden" />结合 AI 深度视觉分析。<br />
                        为您量身打造科学、精准的<br className="sm:hidden" /><span className="text-[#3D4430] font-medium">肌肤护理方案</span>，<br className="sm:hidden" />唤醒肌肤本源之美。
                      </p>

                      <div className="flex flex-col items-center gap-7 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                        <button
                          onClick={handleStart}
                          disabled={isLoading || checkingLimit}
                          className="glass-premium-primary animate-float-premium group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 sm:px-10 rounded-full text-[14px] sm:text-[15px] tracking-[0.15em] font-medium disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                        >
                          {isLoading || checkingLimit ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>正在连接...</span>
                            </>
                          ) : (
                            <>
                              <span>开始肌肤测试</span>
                              <ArrowRight className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1.5" />
                            </>
                          )}
                        </button>

                        <div className="flex flex-wrap justify-center items-center gap-10">
                          {user && (
                            <div className="flex items-center gap-8">
                              <button
                                onClick={() => setShowProfileModal(true)}
                                className="group relative flex items-center gap-2 text-[13px] font-medium text-[#8B7355] transition-all duration-300 cursor-pointer border-none bg-transparent hover:-translate-y-0.5"
                              >
                                <ClipboardList className="w-4 h-4 transition-transform group-hover:scale-110" />
                                <span className="tracking-widest">历史记录</span>
                                {/* Base Line */}
                                <div className="absolute -bottom-1 left-0 w-full h-[0.5px] bg-[#8B7355]/10" />
                                {/* Animated Line */}
                                <div className="absolute -bottom-1 left-1/2 w-0 h-[1px] bg-[#8B7355] transition-all duration-500 ease-out group-hover:w-full group-hover:left-0" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Homepage Footer */}
                  <HomepageFooter />
                </main>
              </div>
            </m.div>

            {/* Drawer Toggle Button */}
            <button
              onClick={() => {
                if (!isDrawerOpen) {
                  // 展开：隐藏便当盒
                  setShowBento(false);
                  setDrawerOpen(true);
                } else {
                  // 收起：显示便当盒
                  setDrawerOpen(false);
                  setShowBento(true);
                }
              }}
              className="group -mt-[1px] relative z-30 flex items-center justify-center rounded-b-2xl bg-[#F0EDE1] px-10 py-3 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.1)] transition-all hover:shadow-[0_15px_25px_-5px_rgba(0,0,0,0.15)] lg:px-14 lg:py-3.5 overflow-hidden pointer-events-auto border-none outline-none"
            >
              <div className="texture-overlay absolute inset-0" />
              <m.div
                className="relative z-10 flex flex-col items-center"
                animate={{ rotate: isDrawerOpen ? 180 : 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChevronDown className="h-7 w-7 text-brand-gold lg:h-8 lg:w-8" />
                <ChevronDown className="-mt-5 h-7 w-7 text-brand-gold lg:h-8 lg:w-8" />
              </m.div>
            </button>
          </div>
        </m.div>
      </m.div>

      {/* Modals */}
      <OnboardingFlowModal
        isOpen={showOnboardingModal}
        onClose={() => {
          setShowOnboardingModal(false);
          setDrawerOpen(true);
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

      <BaseModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        showCloseButton
        className="p-10 text-center rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Texture Overlay */}
        <div
          className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />

        <div className="relative z-10">
          <div className="flex justify-center mb-6 text-amber-500/80">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mb-3 text-xl font-serif text-[#1A1A1A] tracking-tight">今日测试次数已用完</h3>
          <p className="mb-8 text-[14px] text-[#5E5E5E] leading-relaxed font-light">
            {user ? (
              <>您今日的 {testLimitInfo?.dailyLimit || 1} 次测试机会已全部使用，请明天再来</>
            ) : (
              <>游客每天仅有 1 次测试机会<br />登录后可获得更多测试次数</>
            )}
          </p>
          <div className="space-y-4">
            {!user && (
              <button
                onClick={() => {
                  setShowLimitModal(false);
                  openAuthModal('login');
                }}
                className="glass-premium-primary w-full py-3.5 rounded-full text-[15px] tracking-[0.2em] font-medium transition-all duration-300 border-none cursor-pointer outline-none"
              >
                登录 / 注册
              </button>
            )}
            <button
              onClick={() => setShowLimitModal(false)}
              className="w-full py-2 text-[13px] tracking-widest text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </div>
      </BaseModal>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </LazyMotion>
  );
}
