"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { LazyMotion, domAnimation, AnimatePresence, m } from "framer-motion";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Loader2, MapPin, User, ClipboardList } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { getGuestIdentity, type GuestIdentity } from "@/lib/guest-identity";
import dynamic from "next/dynamic";

const ProfileModal = dynamic(() => import("@/components/auth/ProfileModal").then((mod) => mod.ProfileModal), { ssr: false });
const SkincareReminder = dynamic(() => import("@/components/advisor/SkincareReminder").then((mod) => mod.SkincareReminder), { ssr: false });
const BaseModal = dynamic(() => import("@/components/ui/BaseModal").then((mod) => mod.BaseModal), { ssr: false });
const OnboardingFlowModal = dynamic(() => import("@/components/advisor/OnboardingFlowModal").then((mod) => mod.OnboardingFlowModal), { ssr: false });

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

        // 成功获取定位后，关闭弹窗并开始
        setShowOnboardingModal(false);
        setIsLocating(false);
        setIsLoading(true);
        recordAndStartTest();
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
    setShowOnboardingModal(false); // Make sure this is closed too just in case
    setIsLoading(true);
    safeStorage.setSession("locationConsent", "granted");
    safeStorage.set("userRegion", JSON.stringify({ province: region, city: region }));
    recordAndStartTest();
  };

  const handleSkipRegionSelect = () => {
    setShowOnboardingModal(false);
    setIsLoading(true);
    safeStorage.setSession("locationConsent", "declined");
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

    // If user is logged in and has a name, skip nickname modal
    if (user?.name) {
      safeStorage.set("advisor_nickname", user.name);
      // Wait, we need a way to open onboarding modal but skip nickname if already set...
      // Or simply just rely on OnboardingFlowModal to manage step 1 vs 2?
      // For now, OnboardingFlowModal always defaults to nickname step. Let's set the component prop or state!
      // Since it's refactored, let's just showOnboardingModal always, and it handles it! 
      setShowOnboardingModal(true);
    } else {
      setShowOnboardingModal(true);
    }
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
      {/* Full Screen Loading Overlay to cover Next.js chunk fetching gap */}
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

      <div className="texture-overlay"></div>

      <main className="relative w-full h-screen bg-[#FDFBF7] text-[#2D2A26] overflow-hidden flex flex-col items-center justify-center selection:bg-[#3D4430] selection:text-white">

        {/* Official Website Link */}
        <div className="absolute top-6 left-6 z-50">
          <a
            href="https://demo.nihplod.cn"
            className="flex items-center gap-2 text-[#3D4430]/80 hover:text-[#1A1A1A] transition-colors text-sm font-medium tracking-wide bg-transparent border-none cursor-pointer no-underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回官网</span>
          </a>
        </div>

        {/* Auth Navigation */}
        <div className="absolute top-6 right-6 z-50">
          {user ? (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 text-[#3D4430]/80 hover:text-[#1A1A1A] transition-colors text-sm font-medium tracking-wide bg-transparent border-none cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>{user.name || '我的档案'}</span>
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-2 text-sm font-medium text-[#3D4430]/80 hover:text-[#1A1A1A] transition-colors tracking-wide bg-transparent border-none cursor-pointer"
            >
              <span>登录 / 注册</span>
            </button>
          )}
        </div>

        {/* Center Content */}
        <div className="z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto">

          <div className="animate-fade-in-up">
            <div className="mb-8">
              <Image
                src="/partner-nihplod.webp"
                alt="NIHPLOD 旎柏"
                width={300}
                height={90}
                priority
                className="h-14 w-auto mx-auto opacity-80"
              />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif text-[#1A1A1A] mb-8 leading-tight tracking-tight">
              AI 智能<br className="sm:hidden" />精准护肤
            </h1>

            <p className="text-[#5C5855] leading-loose mb-12 max-w-md mx-auto font-light text-sm md:text-base delay-100 animate-fade-in-up opacity-0" style={{ animationFillMode: 'forwards' }}>
              源自摩纳哥真脂质体科技，结合 AI 深度视觉分析。<br />为您量身打造科学、精准的肌肤护理方案，唤醒肌肤本源之美。
            </p>

            <div className="delay-200 animate-fade-in-up opacity-0 flex flex-col items-center gap-6" style={{ animationFillMode: 'forwards' }}>
              <button
                onClick={handleStart}
                disabled={isLoading || checkingLimit}
                className="group relative inline-flex items-center justify-center gap-3 bg-[#1A1A1A] text-[#FDFBF7] px-8 py-3.5 rounded-full text-sm tracking-wide font-medium hover:bg-[#3D4430] transition-all duration-500 shadow-xl shadow-[#1A1A1A]/5 disabled:opacity-70 disabled:cursor-not-allowed border-none cursor-pointer"
              >
                {isLoading || checkingLimit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在连接...</span>
                  </>
                ) : (
                  <>
                    <span>开启定制之旅</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Secondary Actions */}
              <div className="flex flex-wrap justify-center items-center gap-3">
                {/* Leaderboard Button - Always Visible */}
                <button
                  onClick={() => router.push('/leaderboard')}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all bg-[#1A1A1A]/5 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/10 border-none cursor-pointer hover:scale-105 active:scale-95"
                >
                  <span className="text-base">🏆</span>
                  <span>肌肤评分榜</span>
                </button>

                {/* Logged-in User Actions */}
                {user && (
                  <>
                    <button
                      onClick={() => setShowProfileModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all bg-[#1A1A1A]/5 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/10 border-none cursor-pointer"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>历史记录</span>
                    </button>
                    <SkincareReminder />
                  </>
                )}
              </div>
            </div>

            {/* Minimal Footer Info - Moved to flow to prevent overlap */}
            <div className="mt-16 text-center animate-fade-in-up delay-300 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <p className="text-[10px] text-[#3D4430]/20 font-mono uppercase tracking-widest">
                Powered by MySkin Today™ Tech
              </p>
            </div>

          </div>
        </div>



        {/* Modals - Simplified Styles */}

        <OnboardingFlowModal
          isOpen={showOnboardingModal}
          onClose={() => setShowOnboardingModal(false)}
          nickname={nickname}
          setNickname={setNickname}
          onNicknameSubmit={handleNicknameSubmit}
          isLocating={isLocating}
          onLocationAccept={handleLocationAccept}
          onLocationDecline={handleLocationDecline}
          onSkipLocation={handleSkipRegionSelect}
          onRegionSelect={handleRegionSelect}
          regionOptions={regionOptions}
        />

        {/* Test Limit Modal */}
        <BaseModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          showCloseButton
          className="p-8 text-center"
        >
          <div className="flex justify-center mb-6 text-amber-500">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h3 className="mb-2 text-xl font-serif text-[#1A1A1A]">
            今日测试次数已用完
          </h3>

          <p className="mb-6 text-sm text-[#5E5E5E] leading-relaxed font-light">
            {user ? (
              <>您今日的 {testLimitInfo?.dailyLimit || 1} 次测试机会已全部使用，请明天再来</>
            ) : (
              <>游客每天仅有 1 次测试机会<br />登录后可获得更多测试次数</>
            )}
          </p>

          <div className="space-y-3">
            {!user && (
              <button
                onClick={() => {
                  setShowLimitModal(false);
                  openAuthModal('login');
                }}
                className="w-full bg-[#1A1A1A] text-[#FDFBF7] py-3 text-sm font-medium hover:bg-[#3D4430] transition-colors border-none cursor-pointer"
              >
                登录 / 注册
              </button>
            )}
            <button
              onClick={() => setShowLimitModal(false)}
              className="w-full py-2 text-xs text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </BaseModal>

        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      </main >
    </LazyMotion >
  );
}
