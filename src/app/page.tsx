"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { m, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Loader2, MapPin, User, ClipboardList, X } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { SkincareReminder } from "@/components/advisor/SkincareReminder";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { ProfileModal } from "@/components/auth/ProfileModal";
import { getGuestIdentity, type GuestIdentity } from "@/lib/guest-identity";

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
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nickname, setNickname] = useState("");

  // Location/Region states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRegionSelectModal, setShowRegionSelectModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Region options
  const regionOptions = [
    { group: "华北/东北", regions: ["北京", "天津", "河北", "山西", "内蒙古", "黑龙江", "吉林", "辽宁"] },
    { group: "华东", regions: ["上海", "江苏", "浙江", "山东", "安徽", "江西"] },
    { group: "华南", regions: ["广东", "广西", "海南", "福建", "台湾"] },
    { group: "华中/西南", regions: ["湖北", "湖南", "河南", "四川", "重庆", "贵州", "云南"] },
    { group: "西北", regions: ["陕西", "甘肃", "宁夏", "新疆"] },
    { group: "高原", regions: ["西藏", "青海"] },
  ];


  /* --- Handlers --- */

  const startNewTest = useCallback(() => {
    // Clear previous advisor state to ensure fresh start
    localStorage.removeItem("advisor_answers");
    localStorage.removeItem("advisor_gender");
    localStorage.removeItem("advisor_face_images");
    localStorage.removeItem("advisor_result");

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

        localStorage.setItem("userRegion", JSON.stringify({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }));
        sessionStorage.setItem("locationConsent", "granted");

        // 成功获取定位后，关闭弹窗并开始
        setShowLocationModal(false);
        setIsLocating(false);
        recordAndStartTest();
      } catch (error) {
        console.warn("Geolocation failed", error);
        setIsLocating(false);
        setShowLocationModal(false);
        setShowRegionSelectModal(true);
      }
    } else {
      setIsLocating(false);
      setShowLocationModal(false);
      setShowRegionSelectModal(true);
    }
  };

  const handleRegionSelect = (region: string) => {
    setShowRegionSelectModal(false);
    sessionStorage.setItem("locationConsent", "granted");
    localStorage.setItem("userRegion", JSON.stringify({ province: region, city: region }));
    recordAndStartTest();
  };

  const handleSkipRegionSelect = () => {
    setShowRegionSelectModal(false);
    sessionStorage.setItem("locationConsent", "declined");
    recordAndStartTest();
  };

  const handleLocationDecline = () => {
    setShowLocationModal(false);
    sessionStorage.setItem("locationConsent", "declined");
    recordAndStartTest();
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

      const sessionId = localStorage.getItem("advisor_session_id");
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
      localStorage.setItem("advisor_nickname", user.name);
      setShowLocationModal(true);
    } else {
      setShowNicknameModal(true);
    }
  };

  const handleNicknameSubmit = () => {
    if (!nickname.trim()) {
      toast.error("请输入您的昵称");
      return;
    }
    // Save nickname to localStorage
    localStorage.setItem("advisor_nickname", nickname.trim());
    setShowNicknameModal(false);
    // Proceed to location modal
    setShowLocationModal(true);
  };



  return (
    <LazyMotion features={domAnimation}>
      <div className="texture-overlay"></div>

      <main className="relative w-full h-screen bg-[#FDFBF7] text-[#2D2A26] overflow-hidden flex flex-col items-center justify-center selection:bg-[#3D4430] selection:text-white">

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
                src="/logo-myskin-today.svg"
                alt="MySkin.Today"
                width={300}
                height={90}
                priority
                className="h-24 w-auto mx-auto opacity-80"
              />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif text-[#1A1A1A] mb-8 leading-tight tracking-tight">
              专属您的<br className="sm:hidden" />护肤专家
            </h1>

            <p className="text-[#5C5855] leading-loose mb-12 max-w-md mx-auto font-light text-sm md:text-base delay-100 animate-fade-in-up opacity-0" style={{ animationFillMode: 'forwards' }}>
              融合视觉分析与专家级诊疗建议，<br />为您提供科学、严谨的定制化护肤方案。
            </p>

            <div className="delay-200 animate-fade-in-up opacity-0 flex flex-col items-center gap-8" style={{ animationFillMode: 'forwards' }}>
              <button
                onClick={handleStart}
                disabled={isLoading}
                className="group relative inline-flex items-center justify-center gap-3 bg-[#1A1A1A] text-[#FDFBF7] px-8 py-3.5 rounded-full text-sm tracking-wide font-medium hover:bg-[#3D4430] transition-all duration-500 shadow-xl shadow-[#1A1A1A]/5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在开启...</span>
                  </>
                ) : (
                  <>
                    <span>开始测评</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Secondary Actions for Logged-in Users */}
              {user && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all bg-[#1A1A1A]/5 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/10 border-none cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>历史记录</span>
                  </button>
                  <SkincareReminder />
                </div>
              )}
            </div>

            {/* Minimal Footer Info - Moved to flow to prevent overlap */}
            <div className="mt-16 text-center animate-fade-in-up delay-300 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <p className="text-[10px] text-[#3D4430]/20 font-mono uppercase tracking-widest">
                AI Powered Analysis
              </p>
            </div>

          </div>
        </div>



        {/* Modals - Simplified Styles */}

        {/* Nickname Modal */}
        <AnimatePresence>
          {showNicknameModal && (
            <m.div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <m.div
                className="absolute inset-0 bg-[#FDFBF7]/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNicknameModal(false)}
              />

              <m.div
                className="relative z-10 w-full max-w-sm bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-[#3D4430]/5 p-8 text-center"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  onClick={() => setShowNicknameModal(false)}
                  className="absolute top-4 right-4 text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="mb-2 text-xl font-serif text-[#1A1A1A]">
                  您好，请问怎么称呼？
                </h3>

                <p className="mb-8 text-sm text-[#5E5E5E] leading-relaxed font-light">
                  输入昵称，让报告更有温度
                </p>

                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="输入您的昵称"
                  maxLength={20}
                  className="w-full px-4 py-3 mb-5 text-center text-[#1A1A1A] bg-[#FDFBF7] border border-[#3D4430]/10 rounded-lg focus:outline-none focus:border-[#3D4430]/30 focus:ring-2 focus:ring-[#3D4430]/5 transition-all placeholder:text-[#3D4430]/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleNicknameSubmit();
                    }
                  }}
                  autoFocus
                />

                <div className="space-y-3">
                  <button
                    onClick={handleNicknameSubmit}
                    className="w-full bg-[#1A1A1A] text-[#FDFBF7] py-3 text-sm font-medium hover:bg-[#3D4430] transition-colors"
                  >
                    继续
                  </button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Location Modal */}
        <AnimatePresence>
          {showLocationModal && (
            <m.div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <m.div
                className="absolute inset-0 bg-[#FDFBF7]/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLocationModal(false)}
              />

              <m.div
                className="relative z-10 w-full max-w-sm bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-[#3D4430]/5 p-8 text-center"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex justify-center mb-6 text-[#3D4430]">
                  <MapPin className="h-6 w-6 opacity-80" />
                </div>

                <h3 className="mb-4 text-xl font-serif text-[#1A1A1A]">
                  开启定位服务
                </h3>

                <p className="mb-8 text-sm text-[#5E5E5E] leading-relaxed font-light">
                  我们需要分析您所在地区的气候环境，<br />为肤质判断提供依据。
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleLocationAccept}
                    disabled={isLocating}
                    className="w-full bg-[#1A1A1A] text-[#FDFBF7] py-3 text-sm font-medium hover:bg-[#3D4430] transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-wait"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在定位...
                      </>
                    ) : "允许访问"}
                  </button>

                  <button
                    onClick={handleLocationDecline}
                    className="w-full py-2 text-xs text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent"
                  >
                    暂不提供
                  </button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRegionSelectModal && (
            <m.div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <m.div
                className="absolute inset-0 bg-[#FDFBF7]/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleSkipRegionSelect}
              />

              <m.div
                className="relative z-10 w-full max-w-sm bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-[#3D4430]/5 flex flex-col max-h-[70vh]"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="p-6 pb-2 text-center shrink-0">
                  <h3 className="text-lg font-serif text-[#1A1A1A]">选择地区</h3>
                  <p className="text-xs text-[#5E5E5E] mt-2 font-light">手动选择您所在的区域</p>
                </div>

                <div className="overflow-y-auto px-6 py-2 custom-scrollbar flex-1">
                  {regionOptions.map((group) => (
                    <div key={group.group} className="mb-6 last:mb-2">
                      <div className="text-[10px] font-bold text-[#3D4430]/30 uppercase tracking-widest mb-3 text-center">
                        {group.group}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {group.regions.map((region) => (
                          <button
                            key={region}
                            onClick={() => handleRegionSelect(region)}
                            className="px-3 py-1.5 bg-[#FDFBF7] text-xs text-[#5E5E5E] hover:bg-[#3D4430] hover:text-white transition-all duration-300 min-w-[3rem]"
                          >
                            {region}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 shrink-0 text-center border-t border-[#3D4430]/5">
                  <button
                    onClick={handleSkipRegionSelect}
                    className="text-xs text-[#3D4430]/30 hover:text-[#3D4430] transition-colors"
                  >
                    跳过
                  </button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Test Limit Modal */}
        <AnimatePresence>
          {showLimitModal && (
            <m.div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <m.div
                className="absolute inset-0 bg-[#FDFBF7]/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLimitModal(false)}
              />

              <m.div
                className="relative z-10 w-full max-w-sm bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-[#3D4430]/5 p-8 text-center"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="absolute top-4 right-4 text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

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
                      className="w-full bg-[#1A1A1A] text-[#FDFBF7] py-3 text-sm font-medium hover:bg-[#3D4430] transition-colors"
                    >
                      登录 / 注册
                    </button>
                  )}
                  <button
                    onClick={() => setShowLimitModal(false)}
                    className="w-full py-2 text-xs text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent"
                  >
                    我知道了
                  </button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>

        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      </main >
    </LazyMotion >
  );
}
