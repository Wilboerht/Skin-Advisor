"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { m, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Loader2, MapPin, User } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { initSession } = useAdvisorAnalytics();
  const { user } = useAuth();

  // Initialize session
  useEffect(() => {
    initSession();
    router.prefetch("/questions");
  }, [initSession, router]);

  // Location/Region states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRegionSelectModal, setShowRegionSelectModal] = useState(false);

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

  const startNewTest = () => {
    // Clear previous advisor state to ensure fresh start
    localStorage.removeItem("advisor_answers");
    localStorage.removeItem("advisor_gender");
    localStorage.removeItem("advisor_face_images");
    localStorage.removeItem("advisor_result");

    setIsLoading(true);
    router.push("/questions");
  };

  const handleLocationAccept = async () => {
    setShowLocationModal(false);
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
        startNewTest();
      } catch (error) {
        console.warn("Geolocation failed", error);
        setShowRegionSelectModal(true);
      }
    } else {
      setShowRegionSelectModal(true);
    }
  };

  const handleRegionSelect = (region: string) => {
    setShowRegionSelectModal(false);
    sessionStorage.setItem("locationConsent", "granted");
    localStorage.setItem("userRegion", JSON.stringify({ province: region, city: region }));
    startNewTest();
  };

  const handleSkipRegionSelect = () => {
    setShowRegionSelectModal(false);
    sessionStorage.setItem("locationConsent", "declined");
    startNewTest();
  };

  const handleLocationDecline = () => {
    setShowLocationModal(false);
    sessionStorage.setItem("locationConsent", "declined");
    startNewTest();
  };

  const handleStart = () => {
    setShowLocationModal(true);
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="texture-overlay"></div>

      <main className="relative w-full h-screen bg-[#FDFBF7] text-[#2D2A26] overflow-hidden flex flex-col items-center justify-center selection:bg-[#3D4430] selection:text-white">

        {/* Auth Navigation */}
        <div className="absolute top-6 right-6 z-50">
          {user ? (
            <Link href="/profile" className="flex items-center gap-2 text-[#3D4430]/80 hover:text-[#1A1A1A] transition-colors text-sm font-medium tracking-wide">
              <User className="w-4 h-4" />
              <span>{user.name || '我的档案'}</span>
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-2 text-sm font-medium text-[#3D4430]/80 hover:text-[#1A1A1A] transition-colors tracking-wide">
              <span>登录 / 注册</span>
            </Link>
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

            <div className="delay-200 animate-fade-in-up opacity-0" style={{ animationFillMode: 'forwards' }}>
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
            </div>

            {/* Minimal Footer Info */}
            <div className="fixed bottom-8 left-0 w-full text-center">
              <p className="text-[10px] text-[#3D4430]/20 font-mono uppercase tracking-widest">
                AI Powered Analysis
              </p>
            </div>

          </div>
        </div>

        {/* Modals - Simplified Styles */}
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
                    className="w-full bg-[#1A1A1A] text-[#FDFBF7] py-3 text-sm font-medium hover:bg-[#3D4430] transition-colors"
                  >
                    允许访问
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

      </main>
    </LazyMotion>
  );
}
