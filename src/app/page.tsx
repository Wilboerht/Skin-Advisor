"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { m, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { ArrowRight, Sparkles, Loader2, MapPin, X, User } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { initSession } = useAdvisorAnalytics();
  const { user } = useAuth();

  // 初始化会话追踪
  useEffect(() => {
    initSession();
    router.prefetch("/questions");
  }, [initSession, router]);

  // 鼠标视差效果
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const moveX = (e.clientX - window.innerWidth / 2) * 0.005;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.005;
      setMousePos({ x: moveX, y: moveY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
  const handleLocationAccept = async () => {
    setShowLocationModal(false);
    if ("geolocation" in navigator) {
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
          });
        });
        sessionStorage.setItem("locationConsent", "granted");
        setIsLoading(true);
        router.push("/questions");
      } catch {
        setShowRegionSelectModal(true);
      }
    } else {
      setShowRegionSelectModal(true);
    }
  };

  const handleRegionSelect = (region: string) => {
    setShowRegionSelectModal(false);
    sessionStorage.setItem("locationConsent", "granted");
    sessionStorage.setItem("userRegion", region);
    setIsLoading(true);
    router.push("/questions");
  };

  const handleSkipRegionSelect = () => {
    setShowRegionSelectModal(false);
    sessionStorage.setItem("locationConsent", "declined");
    setIsLoading(true);
    router.push("/questions");
  };

  const handleLocationDecline = () => {
    setShowLocationModal(false);
    sessionStorage.setItem("locationConsent", "declined");
    setIsLoading(true);
    router.push("/questions");
  };

  const handleStart = () => {
    setShowLocationModal(true);
  };

  return (
    <LazyMotion features={domAnimation}>
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#F0EDE1] font-sans text-brand-charcoal selection:bg-[#3D4430] selection:text-white">

        {/* Auth Navigation */}
        <div className="absolute top-0 right-0 z-50 p-6 flex items-center gap-4">
          {user ? (
            <Link href="/profile" className="flex items-center gap-2 text-[#3D4430] hover:text-[#1A1A1A] transition-colors rounded-full bg-white/50 backdrop-blur px-4 py-2 text-sm font-medium border border-[#3D4430]/10 shadow-sm hover:bg-white/80">
              <User className="w-4 h-4" />
              <span>{user.name || '我的档案'}</span>
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-2 text-sm font-medium text-[#3D4430] hover:text-[#1A1A1A] bg-white/30 backdrop-blur px-4 py-2 rounded-full border border-transparent hover:border-[#3D4430]/10 hover:bg-white/50 transition-all">
              <User className="w-4 h-4 opacity-70" />
              登录 / 注册
            </Link>
          )}
        </div>

        {/* 背景纹理 */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.4]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 md:p-12 lg:p-16">
          <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

            {/* 左侧：文字内容 */}
            <m.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="order-2 md:order-1 flex flex-col items-center md:items-start text-center md:text-left"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3D4430] text-white shadow-xl">
                  <Sparkles className="h-6 w-6" />
                </div>
                <span className="font-serif text-lg tracking-widest text-[#3D4430]">NIHPLOD</span>
              </div>

              <h1 className="mb-6 font-serif text-4xl font-light leading-tight tracking-tight text-[#1A1A1A] sm:text-5xl lg:text-6xl">
                专属您的 <br />
                <span className="font-normal relative inline-block">
                  护肤专家
                  <span className="absolute -bottom-2 left-0 h-1 w-full bg-[#3D4430]/20" />
                </span>
              </h1>

              <p className="mb-8 max-w-md text-lg font-light leading-relaxed text-[#5E5E5E]">
                融合 VISIA 风格的视觉分析与专家级诊疗建议，为您提供科学、严谨的定制化护肤方案。
              </p>

              <div className="mb-10 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[#3D4430] px-8 py-4 text-white transition-all duration-300 hover:bg-[#2A2F22] hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-80"
                >
                  <span className="relative flex items-center gap-2 font-medium tracking-wide">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        正在开启...
                      </>
                    ) : (
                      <>
                        立即开始测评
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-6 text-xs text-[#3D4430]/60">
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#3D4430]/40" />
                  AI 智能影像分析
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#3D4430]/40" />
                  专家级配方推荐
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#3D4430]/40" />
                  隐私安全保护
                </span>
              </div>
            </m.div>

            {/* 右侧：图片视觉 */}
            <m.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="order-1 md:order-2 flex justify-center md:justify-end relative"
            >
              <div
                className="relative max-w-[80%] md:max-w-full"
                style={{
                  transform: `translate(${mousePos.x}px, ${mousePos.y}px)`,
                  transition: 'transform 0.1s ease-out'
                }}
              >
                {/* 装饰框 */}
                <div className="absolute -left-4 -top-4 h-full w-full border border-[#3D4430]/10" />
                <div className="absolute -right-4 -bottom-4 h-full w-full bg-[#3D4430]/5" />

                {/* 图片 */}
                <div className="relative overflow-hidden shadow-2xl">
                  <img
                    src="https://wp-cdn.4ce.cn/v2/bP048kN.png"
                    alt="Skin Advisor"
                    className="h-auto w-full object-cover grayscale-[0.1] contrast-[1.05]"
                    style={{ maxHeight: '600px' }}
                  />

                  {/* 浮动标签 */}
                  <m.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="absolute bottom-6 right-6 bg-white/90 backdrop-blur px-4 py-3 shadow-lg border border-[#3D4430]/10"
                  >
                    <div className="text-xs font-serif text-[#3D4430]">AI SKIN ANALYZER</div>
                    <div className="text-[10px] text-[#3D4430]/60">Professional Grade</div>
                  </m.div>
                </div>
              </div>
            </m.div>

          </div>
        </div>

        {/* 底部版权 */}
        <footer className="relative z-10 py-6 text-center text-[10px] text-[#3D4430]/40">
          <p>© 2026 NIHPLOD 旎柏 · 源自摩纳哥的高端护肤实验室</p>
        </footer>


        {/* Modals */}
        <AnimatePresence>
          {showLocationModal && (
            <m.div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 font-sans"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <m.div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLocationModal(false)}
              />

              <m.div
                className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-[#F8F6F0] shadow-2xl"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="absolute right-3 top-3 rounded-full p-1.5 text-brand-charcoal/40 transition-colors hover:bg-brand-charcoal/5 hover:text-brand-charcoal/60"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="px-6 pb-6 pt-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3D4430]/10">
                    <MapPin className="h-7 w-7 text-[#3D4430]" />
                  </div>

                  <h3 className="mb-2 text-xl font-light tracking-wide text-[#1A1A1A]">
                    定位服务
                  </h3>

                  <p className="mb-6 text-sm font-light leading-relaxed text-[#5E5E5E]">
                    为了给您提供更精准的护肤建议，我们希望获取您的位置信息，以便分析当地的气候、紫外线强度等环境因素。
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleLocationAccept}
                      className="group relative w-full overflow-hidden rounded-full border border-[#3D4430] bg-[#3D4430] px-6 py-3 text-sm font-medium tracking-wider text-white transition-all duration-300 hover:bg-transparent hover:text-[#3D4430]"
                    >
                      <span className="relative">同意提供定位</span>
                    </button>

                    <button
                      onClick={handleLocationDecline}
                      className="w-full rounded-full border border-[#3D4430]/20 bg-transparent px-6 py-3 text-sm font-light tracking-wider text-[#3D4430]/60 transition-all duration-300 hover:border-[#3D4430]/40 hover:text-[#3D4430]/80"
                    >
                      暂不提供
                    </button>
                  </div>

                  <p className="mt-4 text-[10px] font-light leading-relaxed text-[#1A1A1A]/40">
                    您的位置信息仅用于本次分析，不会被存储或用于其他用途
                  </p>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRegionSelectModal && (
            <m.div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 font-sans"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <m.div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleSkipRegionSelect}
              />

              <m.div
                className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-[#F8F6F0] shadow-2xl"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={handleSkipRegionSelect}
                  className="absolute right-3 top-3 rounded-full p-1.5 text-brand-charcoal/40 transition-colors hover:bg-brand-charcoal/5 hover:text-brand-charcoal/60"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="px-6 pb-6 pt-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3D4430]/10">
                    <MapPin className="h-7 w-7 text-[#3D4430]" />
                  </div>

                  <h3 className="mb-2 text-xl font-light tracking-wide text-[#1A1A1A]">
                    选择您的地区
                  </h3>

                  <p className="mb-4 text-sm font-light leading-relaxed text-[#5E5E5E]">
                    自动定位失败，请手动选择您所在的地区，以便我们为您提供更精准的气候相关护肤建议
                  </p>

                  <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-[#3D4430]/10 bg-white/50">
                    {regionOptions.map((group) => (
                      <div key={group.group} className="border-b border-[#3D4430]/5 last:border-b-0">
                        <div className="sticky top-0 bg-[#F0EDE1]/90 px-4 py-2 text-left text-xs font-medium tracking-wider text-[#3D4430]/50 backdrop-blur-sm">
                          {group.group}
                        </div>
                        <div className="flex flex-wrap gap-2 px-4 py-2">
                          {group.regions.map((region) => (
                            <button
                              key={region}
                              onClick={() => handleRegionSelect(region)}
                              className="rounded-full border border-[#3D4430]/30 bg-white px-3 py-1.5 text-sm text-[#3D4430] transition-all hover:border-[#3D4430] hover:bg-[#3D4430]/10"
                            >
                              {region}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSkipRegionSelect}
                    className="mt-4 w-full text-sm font-light text-[#3D4430]/50 transition-colors hover:text-[#3D4430]/70"
                  >
                    跳过，使用简化分析
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
