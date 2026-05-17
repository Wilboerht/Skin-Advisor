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

    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

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

    // Focus trap for accessibility
    useEffect(() => {
        if (!isOpen) return;

        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return;

        const getFocusable = () => Array.from(modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hasAttribute('disabled'));

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const focusable = getFocusable();
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        const previousFocus = document.activeElement as HTMLElement | null;
        const focusable = getFocusable();
        setTimeout(() => {
            const firstInput = modal.querySelector('input');
            firstInput ? firstInput.focus() : focusable[0]?.focus();
        }, 100);

        window.addEventListener('keydown', handleTab);
        return () => {
            window.removeEventListener('keydown', handleTab);
            previousFocus?.focus();
        };
    }, [isOpen, currentScreen]);

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
        transition: prefersReducedMotion ? 'none' : "transform 0.9s cubic-bezier(0.32, 0.72, 0, 1)",
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
                    transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: [0.65, 0, 0.35, 1] }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="引导流程"
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
                                    {activeIndex > 0 && (
                                        <button
                                            onClick={() => goTo(activeIndex - 1)}
                                            className="absolute -top-12 left-0 p-2 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-full hover:bg-black/5 border-none cursor-pointer"
                                            aria-label="返回上一步"
                                        >
                                            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                                        </button>
                                    )}
                                    <div className="flex justify-center mb-8 text-[#3D4430]">
                                        <Image
                                            src="/images/wave-bye.svg"
                                            alt="Wave"
                                            width={40}
                                            height={40}
                                            className="opacity-80"
                                            priority
                                        />
                                    </div>

                                    <h3 className="mb-3 text-2xl md:text-3xl font-serif text-[#1A1A1A]">
                                        您好，请问怎么称呼？
                                    </h3>

                                    <p className="mb-10 text-sm md:text-base text-[#5E5E5E] leading-relaxed font-light">
                                        输入昵称，让报告更有温度
                                    </p>

                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="例如：小美"
                                        maxLength={10}
                                        className="w-full bg-transparent border border-[#3D4430]/30 rounded-2xl py-4 px-5 mb-8 text-center text-[#1A1A1A] focus:outline-none focus:border-[#8B7355] transition-all duration-300 placeholder:text-[#3D4430]/30 text-[15px] tracking-wide"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleNicknameNext();
                                        }}
                                        autoFocus
                                        aria-label="昵称"
                                    />

                                    <button
                                        onClick={handleNicknameNext}
                                        disabled={!nickname.trim()}
                                        className="group inline-flex items-center gap-2 text-[13px] font-medium tracking-[0.2em] text-[#3D4430]/30 enabled:hover:text-[#3D4430] transition-colors duration-500 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none outline-none mx-auto"
                                    >
                                        <span className="relative">
                                            下一步
                                            <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                                        </span>
                                        <ArrowRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
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
                                        <div className="flex justify-center mb-8 text-[#8B7355]">
                                            <MapPin className="h-10 w-10 md:h-12 md:w-12 opacity-90" strokeWidth={1.2} />
                                        </div>

                                        <h3 className="mb-4 text-2xl md:text-3xl font-serif text-[#1A1A1A]">
                                            开启定位服务
                                        </h3>

                                        <p className="mb-10 text-sm md:text-base text-[#5E5E5E] leading-relaxed font-light max-w-sm mx-auto">
                                            为获得更精准的分析数据，我们需要您授权当前的地理位置信息（仅用于环境数据分析），在结合温度、气候、空气湿度、紫外线等多维数据后生成更个性化的定制化报告。
                                        </p>

                                        <div className="space-y-4">
                                            <button
                                                onClick={handleLocationAcceptWrapper}
                                                disabled={isLocating}
                                                className="group inline-flex items-center gap-2 py-2 text-[15px] tracking-[0.2em] font-medium text-[#8B7355] disabled:opacity-30 disabled:cursor-wait cursor-pointer transition-all duration-300 bg-transparent border-none outline-none mx-auto"
                                            >
                                                {isLocating ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        <span>正在定位...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">允许访问</span>
                                                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
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
                                        {/* Region Select Header */}
                                        <div className="shrink-0 pt-16 pb-4 px-6 text-center relative">
                                            <button
                                                onClick={() => setLocationView("main")}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-full hover:bg-[#8B7355]/5 flex items-center justify-center border-none cursor-pointer"
                                                title="返回"
                                            >
                                                <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                                            </button>
                                            <h3 className="text-xl md:text-2xl font-serif text-[#1A1A1A] tracking-wider">选择所在地区</h3>
                                            <p className="text-[13px] text-[#5E5E5E] mt-2 font-light opacity-80">根据当地气候为您提供更精准的分析建议</p>
                                        </div>

                                        {/* Region List */}
                                        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                                            {regionOptions.map((group) => (
                                                <div key={group.group} className="mb-8 last:mb-2">
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
                                    {activeIndex > 0 && (
                                        <button
                                            onClick={() => goTo(activeIndex - 1)}
                                            className="absolute -top-12 left-0 p-2 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-full hover:bg-black/5 border-none cursor-pointer"
                                            aria-label="返回上一步"
                                        >
                                            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                                        </button>
                                    )}
                                    <div className="flex justify-center mb-8 text-[#8B7355]">
                                        <ShieldCheck className="h-10 w-10 md:h-12 md:w-12 opacity-90" strokeWidth={1.2} />
                                    </div>

                                    <h3 className="mb-6 text-2xl md:text-3xl font-serif text-[#1A1A1A]">
                                        服务确认与授权
                                    </h3>

                                    <div className="p-6 mb-10 text-left max-w-md mx-auto">
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
                                                    transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: "easeOut" }}
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
                                                                transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeOut", delay: 0.05 }}
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
                                            className="group inline-flex items-center gap-2 text-[13px] font-medium tracking-[0.2em] text-[#3D4430]/30 enabled:hover:text-[#3D4430] transition-colors duration-500 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none outline-none"
                                        >
                                            <span className="relative">
                                                开始测试
                                                <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                                            </span>
                                            <ArrowRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
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

                    {/* ---- Close Button (not shown on legal step) ---- */}
                    {currentScreen !== "legal" && (
                        <button
                            onClick={onClose}
                            className="fixed top-6 right-6 z-[110] w-10 h-10 flex items-center justify-center rounded-full text-[#1A1A1A]/30 hover:text-[#1A1A1A] hover:bg-black/5 transition-all duration-300 bg-transparent border-none cursor-pointer"
                            aria-label="关闭"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* ---- Progress Indicators (bottom dots) ---- */}
                    <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2">
                        <span className="text-[11px] text-[#3D4430]/40 tracking-wider">
                            {screens[activeIndex] === 'nickname' && `步骤 1 / ${totalScreens} · 基本信息`}
                            {screens[activeIndex] === 'location' && `步骤 ${activeIndex + 1} / ${totalScreens} · 位置设置`}
                            {screens[activeIndex] === 'legal' && `步骤 ${activeIndex + 1} / ${totalScreens} · 服务确认`}
                        </span>
                        <div className="flex flex-row items-center gap-3">
                            {screens.map((screen, index) => (
                                <button
                                    key={screen}
                                    onClick={() => index <= maxVisitedIndex && goTo(index)}
                                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 border ${
                                        index === activeIndex
                                            ? "bg-[#8B7355] border-[#8B7355] scale-125"
                                            : index <= maxVisitedIndex
                                                ? "bg-[#8B7355]/30 border-[#8B7355]/40 hover:bg-[#8B7355]/50 cursor-pointer"
                                                : "bg-transparent border-[#3D4430]/15 cursor-default"
                                    }`}
                                    aria-label={`跳转到第 ${index + 1} 步`}
                                    disabled={index > maxVisitedIndex}
                                />
                            ))}
                        </div>
                    </div>


                </m.div>
            )}
        </AnimatePresence>
    );
}
