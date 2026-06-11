"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MapPin, ShieldCheck, ArrowRight, ChevronLeft, X } from "lucide-react";
import { AnimatePresence, motion as m } from "framer-motion";
import Image from "next/image";

interface OnboardingFlowProps {
    isOpen: boolean;
    onClose: () => void;
    nickname: string;
    setNickname: (nickname: string) => void;
    onNicknameSubmit: () => void;
    isLocating: boolean;
    onLocationAccept: () => void;
    onLocationDecline: () => void;
    onSkipLocation: () => void;
    onRegionSelect: (region: string) => void;
    regionOptions: { group: string; regions: string[] }[];
    isLoggedIn: boolean;
}

type LocationSubView = "main" | "region";

export function OnboardingFlowModal({
    isOpen,
    onClose,
    nickname,
    setNickname,
    onNicknameSubmit,
    isLocating,
    onLocationAccept,
    onLocationDecline,
    onSkipLocation,
    onRegionSelect,
    regionOptions,
    isLoggedIn
}: OnboardingFlowProps) {
    // Determine which screens to show
    const hasNicknameScreen = !isLoggedIn || !nickname;
    const hasLegalScreen = !isLoggedIn;

    const getScreens = useCallback(() => {
        const s: string[] = [];
        if (hasNicknameScreen) s.push("nickname");
        s.push("location");
        if (hasLegalScreen) s.push("legal");
        return s;
    }, [hasNicknameScreen, hasLegalScreen]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [locationView, setLocationView] = useState<LocationSubView>("main");
    const [isAgreed, setIsAgreed] = useState(false);
    const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);

    const screens = getScreens();
    const totalScreens = screens.length;
    const currentScreen = screens[activeIndex];

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setActiveIndex(0);
            setLocationView("main");
            setIsAgreed(false);
            setMaxVisitedIndex(0);
        }
    }, [isOpen]);

    // Keyboard support: Escape to close (except on legal step)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && currentScreen !== "legal") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, currentScreen, onClose]);

    const goTo = (index: number) => {
        if (index < 0 || index >= totalScreens) return;
        setActiveIndex(index);
        setMaxVisitedIndex(prev => Math.max(prev, index));
    };

    const goNext = () => goTo(activeIndex + 1);

    const finish = () => {
        onSkipLocation();
    };

    /* ---- Nickname handlers ---- */
    const handleNicknameNext = () => {
        if (!nickname.trim()) return;
        onNicknameSubmit();
        goNext();
    };

    /* ---- Location handlers ---- */
    const handleLocationAcceptWrapper = async () => {
        try {
            await onLocationAccept();
            if (isLoggedIn) {
                finish();
            } else {
                goNext();
            }
        } catch (e) {
            setLocationView("region");
        }
    };

    const handleDecline = () => {
        onLocationDecline();
        setLocationView("region");
    };

    /* ---- Region select handlers ---- */
    const handleRegionOption = (region: string) => {
        onRegionSelect(region);
        setLocationView("main");
        if (isLoggedIn) {
            finish();
        } else {
            goNext();
        }
    };

    const handleSkipRegion = () => {
        setLocationView("main");
        if (isLoggedIn) {
            finish();
        } else {
            goNext();
        }
    };

    /* ---- Legal handlers ---- */
    const handleLegalSubmit = () => {
        if (!isAgreed) return;
        finish();
    };

    // Unified background color for all screens
    const getBgColor = () => "#FDFBF7";

    // Content entrance animation variants (horizontal to match slide direction)
    const contentVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay: 0.35, ease: "easeOut" as const } },
    };

    // Slide transition style (horizontal, vw-based to avoid subpixel jitter)
    const slideContainerStyle: React.CSSProperties = {
        width: `${totalScreens * 100}vw`,
        transform: `translateX(-${activeIndex * 100}vw)`,
        transition: "transform 0.9s cubic-bezier(0.32, 0.72, 0, 1)",
        willChange: "transform",
        backfaceVisibility: "hidden",
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    className="fixed inset-0 z-[100] overflow-hidden"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
                >
                    {/* ---- Slides Wrapper ---- */}
                    <div className="h-full flex" style={slideContainerStyle}>
                        {/* Slide: Nickname */}
                        {hasNicknameScreen && (
                            <div
                                className="h-full flex flex-col items-center justify-center px-6 relative"
                                style={{ backgroundColor: getBgColor(), flex: "0 0 100vw", backfaceVisibility: "hidden", willChange: "transform" }}
                            >
                                {/* Subtle texture overlay */}
                                <div
                                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                                    }}
                                />
                                <m.div
                                    className="relative z-10 w-full max-w-sm text-center"
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate={currentScreen === "nickname" ? "visible" : "hidden"}
                                >
                                    <div className="flex justify-center mb-9 text-[#3D4430]">
                                        <Image
                                            src="/images/hi.svg"
                                            alt="Wave"
                                            width={48}
                                            height={48}
                                            className="opacity-80"
                                            priority
                                        />
                                    </div>

                                    <h3 className="mb-4 text-2xl md:text-3xl font-serif text-[#1A1A1A]">
                                        您好，请问怎么称呼？
                                    </h3>

                                    <p className="mb-9 text-sm md:text-base text-[#5E5E5E] leading-relaxed font-light">
                                        输入昵称，让报告更有温度
                                    </p>

                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="输入您的昵称"
                                        maxLength={10}
                                        className="w-full bg-transparent border-0 border-b border-[#3D4430]/20 rounded-none py-4 px-0 mb-9 text-center text-[#1A1A1A] focus:outline-none focus:border-[#3D4430]/40 transition-colors placeholder:text-[#3D4430]/25 text-[15px] tracking-wide"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleNicknameNext();
                                        }}
                                        autoFocus
                                    />

                                    <button
                                        onClick={handleNicknameNext}
                                        disabled={!nickname.trim()}
                                        className="group relative inline-flex items-center justify-center gap-4 px-10 py-3.5 sm:px-14 border border-[#3D4430]/25 hover:border-[#3D4430]/50 hover:bg-[#3D4430]/[0.03] text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-500"
                                    >
                                        <span>下一步</span>
                                        <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                                    </button>
                                </m.div>
                            </div>
                        )}

                        {/* Slide: Location */}
                        <div
                            className="h-full flex flex-col items-center justify-center px-6 relative"
                            style={{ backgroundColor: getBgColor(), flex: "0 0 100vw", backfaceVisibility: "hidden", willChange: "transform" }}
                        >
                            <div
                                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                                }}
                            />

                            <AnimatePresence mode="wait">
                                {locationView === "main" ? (
                                    <m.div
                                        key="location-main"
                                        className="relative z-10 w-full max-w-md text-center"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="flex justify-center mb-9 text-[#8B7355]">
                                            <MapPin className="h-10 w-10 md:h-12 md:w-12 opacity-90" strokeWidth={1.2} />
                                        </div>

                                        <h3 className="mb-4 text-2xl md:text-3xl font-serif text-[#1A1A1A]">
                                            开启定位服务
                                        </h3>

                                        <p className="mb-9 text-sm md:text-base text-[#5E5E5E] leading-relaxed font-light max-w-sm mx-auto">
                                            为获得更精准的分析数据，我们需要您授权当前的地理位置信息（仅用于环境数据分析），<br className="sm:hidden" />
                                            在结合温度、气候、空气湿度、紫外线等多维数据后<br className="sm:hidden" />
                                            生成更个性化的定制化报告。
                                        </p>

                                        <div className="space-y-4">
                                            <button
                                                onClick={handleLocationAcceptWrapper}
                                                disabled={isLocating}
                                                className="group relative inline-flex items-center justify-center gap-4 px-10 py-3.5 sm:px-14 border border-[#3D4430]/25 hover:border-[#3D4430]/50 hover:bg-[#3D4430]/[0.03] text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium disabled:opacity-40 disabled:cursor-wait cursor-pointer transition-all duration-500"
                                            >
                                                {isLocating ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>正在定位...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>允许访问</span>
                                                        <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                                                    </>
                                                )}
                                            </button>

                                            <div>
                                                <button
                                                    onClick={handleDecline}
                                                    className="py-2 text-[12px] tracking-widest text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                                >
                                                    手动选择地区
                                                </button>
                                            </div>
                                        </div>
                                    </m.div>
                                ) : (
                                    <m.div
                                        key="location-region"
                                        className="relative z-10 w-full max-w-lg h-full flex flex-col"
                                        initial={{ opacity: 0, x: 40 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 40 }}
                                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        {/* Back Button - fixed top-left for region view */}
                                        <button
                                            onClick={() => setLocationView("main")}
                                            className="fixed top-6 left-6 z-[110] w-10 h-10 flex items-center justify-center rounded-full text-[#1A1A1A]/30 hover:text-[#1A1A1A] hover:bg-black/5 transition-all duration-300 bg-transparent border-none cursor-pointer"
                                            aria-label="返回"
                                        >
                                            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                                        </button>

                                        {/* Region Select Header */}
                                        <div className="shrink-0 pt-16 pb-4 px-6 text-center">
                                            <h3 className="text-xl md:text-2xl font-serif text-[#1A1A1A] tracking-wider">选择所在地区</h3>
                                            <p className="text-[13px] text-[#5E5E5E] mt-2 font-light opacity-80">根据当地气候为您提供更精准的分析建议</p>
                                        </div>

                                        {/* Region List */}
                                        <div className="flex-1 relative flex flex-col min-h-0">
                                            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                                                {regionOptions.map((group) => (
                                                    <div key={group.group} className="mb-9 last:mb-2">
                                                        <div className="flex items-center gap-4 mb-4">
                                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#8B7355]/10" />
                                                            <span className="text-[11px] font-bold text-[#8B7355]/60 uppercase tracking-[0.25em]">
                                                                {group.group}
                                                            </span>
                                                            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#8B7355]/10" />
                                                        </div>
                                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                            {group.regions.map((region) => (
                                                                <button
                                                                    key={region}
                                                                    onClick={() => handleRegionOption(region)}
                                                                    className="py-3 px-2 rounded-xl text-[13px] text-[#3D4430] bg-white/50 hover:bg-[#8B7355]/10 hover:text-[#8B7355] border border-[#3D4430]/5 hover:border-[#8B7355]/20 transition-all duration-300 font-medium active:scale-95"
                                                                >
                                                                    {region}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Bottom Fade Mask */}
                                            <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-20 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7]/80 to-transparent" />
                                        </div>

                                        {/* Footer */}
                                        <div className="shrink-0 p-6 text-center border-t border-[#3D4430]/5">
                                            <button
                                                onClick={handleSkipRegion}
                                                className="text-[12px] tracking-[0.15em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                            >
                                                暂不提供
                                            </button>
                                        </div>
                                    </m.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Slide: Legal */}
                        {hasLegalScreen && (
                            <div
                                className="h-full flex flex-col items-center justify-center px-6 relative"
                                style={{ backgroundColor: getBgColor(), flex: "0 0 100vw", backfaceVisibility: "hidden", willChange: "transform" }}
                            >
                                <div
                                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                                    }}
                                />
                                <m.div
                                    className="relative z-10 w-full max-w-md text-center"
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate={currentScreen === "legal" ? "visible" : "hidden"}
                                >
                                    <div className="flex justify-center mb-9 text-[#8B7355]">
                                        <ShieldCheck className="h-10 w-10 md:h-12 md:w-12 opacity-90" strokeWidth={1.2} />
                                    </div>

                                    <h3 className="mb-4 text-2xl md:text-3xl font-serif text-[#1A1A1A]">
                                        服务确认与授权
                                    </h3>

                                    <div className="p-6 mb-9 text-left max-w-md mx-auto">
                                        <label className="flex items-start gap-4 cursor-pointer group">
                                            <div className="mt-0.5 relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isAgreed}
                                                    onChange={(e) => setIsAgreed(e.target.checked)}
                                                    className="sr-only"
                                                />
                                                <m.div
                                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors duration-300 ${isAgreed ? "bg-[#8B7355] border-[#8B7355]" : "bg-transparent border-[#3D4430]/15 group-hover:border-[#8B7355]/60"}`}
                                                    animate={isAgreed ? { scale: [1, 0.92, 1.04, 1] } : { scale: 1 }}
                                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                                >
                                                    {isAgreed && (
                                                        <m.svg
                                                            className="w-4 h-4 text-white"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="3"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <m.polyline
                                                                initial={{ pathLength: 0 }}
                                                                animate={{ pathLength: 1 }}
                                                                transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
                                                                points="20 6 9 17 4 12"
                                                            />
                                                        </m.svg>
                                                    )}
                                                </m.div>
                                            </div>
                                            <span className="text-sm text-[#5E5E5E] leading-relaxed font-normal select-none">
                                                我已年满 14 周岁（未满 14 周岁已获得监护人许可），且已阅读并同意我们的
                                                <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="text-[#3D4430] font-medium underline underline-offset-4 mx-1">隐私政策</a>
                                                与
                                                <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="text-[#3D4430] font-medium underline underline-offset-4 mx-1">服务条款</a>。
                                            </span>
                                        </label>
                                    </div>

                                    <div className="flex flex-col items-center space-y-4">
                                        <button
                                            onClick={handleLegalSubmit}
                                            disabled={!isAgreed}
                                            className="group relative inline-flex items-center justify-center gap-4 px-10 py-3.5 sm:px-14 border border-[#3D4430]/25 hover:border-[#3D4430]/50 hover:bg-[#3D4430]/[0.03] text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-500"
                                        >
                                            <span>开始测试</span>
                                            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                                        </button>

                                        <button
                                            onClick={onClose}
                                            className="py-2 text-[12px] tracking-widest text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            暂不测试
                                        </button>
                                    </div>
                                </m.div>
                            </div>
                        )}
                    </div>

                    {/* ---- Close Button (not shown on legal step or region select) ---- */}
                    {currentScreen !== "legal" && locationView !== "region" && (
                        <button
                            onClick={onClose}
                            className="fixed top-6 right-6 z-[110] w-10 h-10 flex items-center justify-center rounded-full text-[#1A1A1A]/30 hover:text-[#1A1A1A] hover:bg-black/5 transition-all duration-300 bg-transparent border-none cursor-pointer"
                            aria-label="关闭"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* ---- Progress Indicators (connected steps) ---- */}
                    {/* Hidden in region select sub-view to avoid overlapping the footer */}
                    {locationView !== "region" && (
                        <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-[110]">
                            <div className="flex items-center">
                                {screens.map((screen, index) => {
                                    const isActive = index === activeIndex;
                                    const isCompleted = index < activeIndex;
                                    const isClickable = index <= maxVisitedIndex;

                                    return (
                                        <div key={screen} className="flex items-center">
                                            {/* Step dot */}
                                            <button
                                                onClick={() => isClickable && goTo(index)}
                                                className="relative flex items-center justify-center focus:outline-none"
                                                aria-label={`跳转到第 ${index + 1} 步`}
                                                disabled={!isClickable}
                                            >
                                                {/* Active pulse ring */}
                                                {isActive && (
                                                    <m.span
                                                        className="absolute w-full h-full rounded-full bg-[#8B7355]/20"
                                                        initial={{ scale: 1, opacity: 0.6 }}
                                                        animate={{ scale: 2.2, opacity: 0 }}
                                                        transition={{
                                                            duration: 1.8,
                                                            repeat: Infinity,
                                                            ease: "easeOut",
                                                        }}
                                                    />
                                                )}

                                                {/* Dot core */}
                                                <m.span
                                                    className={`relative block rounded-full border transition-colors duration-500 ${
                                                        isActive
                                                            ? "bg-[#8B7355] border-[#8B7355]"
                                                            : isCompleted
                                                                ? "bg-[#8B7355] border-[#8B7355]"
                                                                : "bg-transparent border-[#3D4430]/20"
                                                    }`}
                                                    animate={{
                                                        width: isActive ? 10 : 8,
                                                        height: isActive ? 10 : 8,
                                                    }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 400,
                                                        damping: 25,
                                                    }}
                                                />
                                            </button>

                                            {/* Connecting line */}
                                            {index < screens.length - 1 && (
                                                <div className="relative w-8 md:w-10 h-[1.5px] mx-1.5 overflow-hidden rounded-full bg-[#3D4430]/8">
                                                    <m.div
                                                        className="absolute inset-y-0 left-0 bg-[#8B7355]/50 rounded-full"
                                                        initial={{ width: "0%" }}
                                                        animate={{
                                                            width: isCompleted ? "100%" : "0%",
                                                        }}
                                                        transition={{
                                                            duration: 0.6,
                                                            ease: [0.32, 0.72, 0, 1],
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                </m.div>
            )}
        </AnimatePresence>
    );
}
