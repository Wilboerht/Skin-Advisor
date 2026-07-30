"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, MapPin, ShieldCheck, ArrowRight, LogOut, X, ChevronDown } from "lucide-react";
import { AnimatePresence, motion as m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useToast } from "@/components/ui/Toast";

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
    mode?: "scan" | "questionnaire";
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
    isLoggedIn,
    mode = "scan",
}: OnboardingFlowProps) {
    const toast = useToast();
    // Determine which screens to show
    const hasNicknameScreen = !isLoggedIn || !nickname;
    const hasLegalScreen = !isLoggedIn;

    const getScreens = useCallback(() => {
        const s: string[] = [];
        // 问卷模式：只需法律合规授权，跳过昵称和定位
        if (mode !== "questionnaire" && hasNicknameScreen) s.push("nickname");
        // 定位仅扫描模式需要（用于气候关联推荐）
        if (mode === "scan") s.push("location");
        if (hasLegalScreen) s.push("legal");
        return s;
    }, [hasNicknameScreen, hasLegalScreen, mode]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [locationView, setLocationView] = useState<LocationSubView>("main");
    const [isAgreed, setIsAgreed] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);
    const prefersReducedMotion = useReducedMotion();
    const screens = getScreens();
    const totalScreens = screens.length;
    const currentScreen = screens[activeIndex];
    const onCloseRef = useRef(onClose);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Focus the modal container when it opens for accessibility
    useEffect(() => {
        if (isOpen) {
            modalRef.current?.focus();
        }
    }, [isOpen]);

    // Keyboard support: Escape to close (except on legal step)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && currentScreen !== "legal") {
                onCloseRef.current();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, currentScreen]);

    const goTo = (index: number) => {
        if (index < 0 || index >= totalScreens) return;
        const targetScreen = screens[index];
        // Reset location sub-view when navigating back to the location step
        if (targetScreen === "location" && currentScreen !== "location") {
            setLocationView("main");
        }
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
        } catch {
            toast.warning("无法获取位置信息，请手动选择所在地区");
            setLocationView("region");
        }
    };

    const handleDecline = () => {
        onLocationDecline();
        if (isLoggedIn) {
            finish();
        } else {
            goNext();
        }
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
        if (!isAgreed || isFinishing) return;
        setIsFinishing(true);
        finish();
    };

    // Unified background color for all screens
    const getBgColor = () => "#FDFBF7";

    // Content entrance animation variants (horizontal to match slide direction)
    const contentVariants = prefersReducedMotion
        ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0 } } }
        : {
            hidden: { opacity: 0, x: 20 },
            visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay: 0.35, ease: "easeOut" as const } },
        };

    // Slide transition style (horizontal, vw-based to avoid subpixel jitter)
    const slideContainerStyle: React.CSSProperties = {
        width: `${totalScreens * 100}vw`,
        transform: `translateX(-${activeIndex * 100}vw)`,
        transition: prefersReducedMotion ? "none" : "transform 0.9s cubic-bezier(0.32, 0.72, 0, 1)",
        willChange: prefersReducedMotion ? undefined : "transform",
        backfaceVisibility: "hidden",
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    ref={modalRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="onboarding-modal-title"
                    tabIndex={-1}
                    className="fixed inset-0 z-[100002] overflow-hidden"
                    initial={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
                >
                    <div id="onboarding-modal-title" className="sr-only">肌肤测试引导</div>

                    {/* ---- App Bar / Header ---- */}
                    <header className="fixed top-0 left-0 right-0 z-[100003] flex items-center justify-between px-6 md:px-12 lg:px-20 py-6 md:py-7 bg-[#FDFBF7]/95 backdrop-blur-sm border-b border-[#1A1A1A]/5">
                        <button
                            onClick={onClose}
                            className="group flex items-center gap-2 text-brand-charcoal/80 hover:text-brand-charcoal transition-colors cursor-pointer bg-transparent border-none"
                            aria-label="关闭"
                        >
                            <Image
                                src="/NIHPLOD-logo.svg"
                                alt="NIHPLOD"
                                width={120}
                                height={36}
                                className="h-7 md:h-9 w-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                        </button>
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-[#1A1A1A]/5 transition-all cursor-pointer bg-transparent border-none"
                            aria-label="退出"
                        >
                            <LogOut className="w-4 h-4" strokeWidth={1.5} />
                            <span className="text-sm tracking-[0.1em]">退出</span>
                        </button>
                    </header>

                    {/* ---- Slides Wrapper ---- */}
                    <div className="h-full flex relative z-10" style={slideContainerStyle}>
                        {/* Slide: Nickname */}
                        {screens.includes("nickname") && (
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
                                    className="relative z-10 w-full max-w-lg text-center"
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate={currentScreen === "nickname" ? "visible" : "hidden"}
                                >
                                    <div className="flex justify-center mb-8 text-[#3D4430]">
                                        <Image
                                            src="/images/hi.svg"
                                            alt="Wave"
                                            width={48}
                                            height={48}
                                            priority
                                        />
                                    </div>

                                    <h3 className="mb-5 text-2xl md:text-3xl font-serif font-light text-brand-charcoal tracking-[0.02em]">
                                        您好，请问怎么称呼？
                                    </h3>

                                    <p className="mb-7 text-sm md:text-base text-brand-charcoal/75 font-light leading-relaxed tracking-[0.06em] md:tracking-[0.12em]">
                                        输入昵称，让报告更有温度
                                    </p>

                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="输入您的昵称"
                                        maxLength={10}
                                        className="w-full bg-transparent border-0 border-b border-[#3D4430]/20 rounded-none py-4 px-0 mb-7 text-center text-brand-charcoal focus:outline-none focus:border-[#3D4430]/40 transition-colors placeholder:text-brand-charcoal/30 text-[16px] tracking-wide"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleNicknameNext();
                                        }}
                                        autoFocus
                                    />

                                    <button
                                        onClick={handleNicknameNext}
                                        disabled={!nickname.trim()}
                                        className="group relative inline-flex items-center justify-center gap-3 px-12 py-4 sm:px-16 border border-[#8B7355] text-[#8B7355] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.1em] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-500 hover:bg-[#8B7355] hover:text-white"
                                    >
                                        <span>下一步</span>
                                        <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                                    </button>
                                </m.div>
                            </div>
                        )}

                        {/* Slide: Location */}
                        {screens.includes("location") && (
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
                                        className="relative z-10 w-full max-w-lg text-center"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="flex justify-center mb-8 text-[#8B7355]">
                                            <MapPin className="h-10 w-10 md:h-12 md:w-12 opacity-90" strokeWidth={1.2} />
                                        </div>

                                        <h3 className="mb-5 text-2xl md:text-3xl font-serif font-light text-brand-charcoal tracking-[0.02em]">
                                            开启定位服务
                                        </h3>

                                        <p className="mb-7 text-sm md:text-base text-brand-charcoal/75 font-light leading-relaxed tracking-[0.06em] md:tracking-[0.12em]">
                                            为获得更精准的分析数据，我们需要您授权当前的地理位置信息，结合当地气候情况，生成更个性化的定制化报告。
                                        </p>

                                        <div className="space-y-4">
                                            <button
                                                onClick={handleLocationAcceptWrapper}
                                                disabled={isLocating}
                                                className="group relative inline-flex items-center justify-center gap-3 px-12 py-4 sm:px-16 border border-[#8B7355] text-[#8B7355] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.1em] font-medium disabled:opacity-40 disabled:cursor-wait cursor-pointer transition-all duration-500 hover:bg-[#8B7355] hover:text-white"
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
                                                    className="py-2 text-[13px] tracking-[0.1em] text-brand-charcoal/60 hover:text-brand-charcoal transition-colors bg-transparent border-none cursor-pointer"
                                                >
                                                    不提供我的位置信息
                                                </button>
                                            </div>
                                        </div>
                                    </m.div>
                                ) : (
                                    <m.div
                                        key="location-region"
                                        className="relative z-10 w-full max-w-lg h-full mx-auto flex flex-col justify-center px-4 sm:px-6"
                                        initial={{ opacity: 0, x: 40 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 40 }}
                                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        {/* Region Select Header */}
                                        <div className="shrink-0 pb-6 md:pb-8 text-center">
                                            <h3 className="text-lg md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em]">选择所在地区</h3>
                                            <p className="text-sm md:text-base text-brand-charcoal/75 font-light leading-relaxed tracking-[0.06em] md:tracking-[0.12em] mt-3">结合当地气候情况，为您提供更精准的分析建议</p>
                                        </div>

                                        {/* Province Select (native) */}
                                        <div className="shrink-0 relative">
                                            <select
                                                value=""
                                                onChange={(e) => { if (e.target.value) handleRegionOption(e.target.value); }}
                                                aria-label="选择所在地区"
                                                className="w-full appearance-none bg-white/70 border border-brand-charcoal/15 rounded-xl py-3.5 pl-5 pr-12 text-[15px] text-brand-charcoal focus:outline-none focus:border-brand-charcoal/35 transition-colors duration-300 cursor-pointer"
                                            >
                                                <option value="" disabled>选择省份</option>
                                                {regionOptions.flatMap((group) => group.regions).map((region) => (
                                                    <option key={region} value={region}>{region}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-charcoal/40 pointer-events-none" />
                                        </div>

                                        {/* Skip */}
                                        <div className="shrink-0 mt-6 md:mt-8 text-center">
                                            <button
                                                onClick={handleSkipRegion}
                                                className="text-[13px] tracking-[0.1em] text-brand-charcoal/60 hover:text-brand-charcoal transition-colors bg-transparent border-none cursor-pointer"
                                            >
                                                暂不提供
                                            </button>
                                        </div>
                                    </m.div>
                                )}
                            </AnimatePresence>
                        </div>
                        )}

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
                                    className="relative z-10 w-full max-w-lg text-center"
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate={currentScreen === "legal" ? "visible" : "hidden"}
                                >
                                    <div className="flex justify-center mb-8 text-[#8B7355]">
                                        <ShieldCheck className="h-10 w-10 md:h-12 md:w-12 opacity-90" strokeWidth={1.2} />
                                    </div>

                                    <h3 className="mb-5 text-2xl md:text-3xl font-serif font-light text-brand-charcoal tracking-[0.02em]">
                                        服务确认与授权
                                    </h3>

                                    <div
                                        className={`p-5 md:p-6 mb-7 text-left max-w-lg mx-auto rounded-xl border cursor-pointer transition-all duration-300 ${
                                            isAgreed
                                                ? "bg-white/60 border-[#8B7355]/25 shadow-[0_2px_12px_rgba(139,115,85,0.06)]"
                                                : "bg-white/40 border-[#3D4430]/8 hover:border-[#8B7355]/15 hover:bg-white/50"
                                        }`}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).tagName !== "A") {
                                                setIsAgreed((prev) => !prev);
                                            }
                                        }}
                                    >
                                        <div className="flex items-start gap-3.5 md:gap-4">
                                            <label
                                                htmlFor="legal-agree"
                                                className="mt-0.5 relative flex items-center cursor-pointer group"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    id="legal-agree"
                                                    type="checkbox"
                                                    checked={isAgreed}
                                                    onChange={(e) => setIsAgreed(e.target.checked)}
                                                    className="sr-only"
                                                />
                                                <m.div
                                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-300 ${
                                                        isAgreed
                                                            ? "bg-[#8B7355] border-[#8B7355]"
                                                            : "bg-transparent border-[#3D4430]/15 group-hover:border-[#8B7355]/60 group-focus-visible:ring-2 group-focus-visible:ring-[#8B7355]/30 group-focus-visible:ring-offset-2"
                                                    }`}
                                                    animate={isAgreed ? { scale: [1, 0.92, 1.04, 1] } : { scale: 1 }}
                                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                                >
                                                    {isAgreed && (
                                                        <m.svg
                                                            className="w-3 h-3 text-white"
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
                                                                points="4 12 9 17 20 6"
                                                            />
                                                        </m.svg>
                                                    )}
                                                </m.div>
                                            </label>
                                            <span
                                                className="text-[13px] md:text-base text-brand-charcoal/60 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] select-none"
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).tagName !== "A") {
                                                        e.stopPropagation();
                                                        setIsAgreed((prev) => !prev);
                                                    }
                                                }}
                                            >
                                                根据相关法律法规，请确认您已年满 14 周岁，且已阅读并同意我们的
                                                <a
                                                    href="https://nihplod.cn/privacy"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-brand-charcoal/75 mx-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    隐私政策
                                                </a>
                                                与
                                                <a
                                                    href="https://nihplod.cn/terms"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-brand-charcoal/75 mx-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    服务条款
                                                </a>。
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center space-y-4">
                                        <button
                                            onClick={handleLegalSubmit}
                                            disabled={!isAgreed || isFinishing}
                                            className="group relative inline-flex items-center justify-center gap-3 px-12 py-4 sm:px-16 border border-[#8B7355] text-[#8B7355] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.1em] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-500 hover:bg-[#8B7355] hover:text-white"
                                        >
                                            {isFinishing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>处理中...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>开始测试</span>
                                                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={onClose}
                                            className="py-2 text-[13px] tracking-[0.1em] text-brand-charcoal/60 hover:text-brand-charcoal transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            暂不测试
                                        </button>
                                    </div>
                                </m.div>
                            </div>
                        )}
                    </div>

                    {/* ---- Progress Indicators (minimal text) ---- */}
                    <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-[110]">
                        <div className="flex items-center gap-3 md:gap-4 text-[11px] md:text-xs tracking-[0.12em]">
                                {screens.map((screen, index) => {
                                    const isActive = index === activeIndex;
                                    const isCompleted = index < activeIndex;
                                    const isClickable = index <= maxVisitedIndex;
                                    const label = screen === "nickname" ? "称呼" : screen === "location" ? "定位" : "授权";

                                    return (
                                        <div key={screen} className="flex items-center gap-3 md:gap-4">
                                            <button
                                                onClick={() => isClickable && goTo(index)}
                                                disabled={!isClickable}
                                                aria-label={`跳转到第 ${index + 1} 步：${label}`}
                                                className={`flex items-baseline gap-1.5 transition-colors duration-500 focus:outline-none ${
                                                    isActive
                                                        ? "text-[#8B7355]"
                                                        : isCompleted
                                                            ? "text-[#3D4430]/55 hover:text-[#3D4430]/80"
                                                            : "text-[#3D4430]/25"
                                                }`}
                                            >
                                                <span className="text-[9px] md:text-[10px] opacity-60">
                                                    {String(index + 1).padStart(2, "0")}
                                                </span>
                                                <span className={isActive ? "font-medium" : ""}>{label}</span>
                                            </button>

                                            {index < screens.length - 1 && (
                                                <span className="text-[#3D4430]/15 select-none">/</span>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                </m.div>
            )}
        </AnimatePresence>
    );
}
