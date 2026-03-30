"use client";

import { useState, useEffect, useRef } from "react";
import { BaseModal } from "@/components/ui/BaseModal";
import { Loader2, MapPin, ShieldCheck, ArrowRight, ChevronLeft } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
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

type Step = "nickname" | "location" | "legal";

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
    const [step, setStep] = useState<Step>("nickname");
    const [showRegionSelectModal, setShowRegionSelectModal] = useState(false);
    const [isAgreed, setIsAgreed] = useState(false);

    // Reset step when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(isLoggedIn && nickname ? "location" : "nickname");
        }
    }, [isOpen, isLoggedIn, nickname]);

    const handleNicknameNext = () => {
        if (!nickname.trim()) return;
        onNicknameSubmit();
        setStep("location");
    };

    const handleDecline = () => {
        onLocationDecline();
        setShowRegionSelectModal(true);
    }

    const handleSkipRegion = () => {
        setShowRegionSelectModal(false);
        if (isLoggedIn) {
            onSkipLocation();
        } else {
            setStep("legal");
        }
    }

    const handleRegionOption = (region: string) => {
        setShowRegionSelectModal(false);
        onRegionSelect(region);
        if (isLoggedIn) {
            onSkipLocation();
        } else {
            setStep("legal");
        }
    }

    // Handle location accept wrapper
    const handleLocationAcceptWrapper = async () => {
        try {
            await onLocationAccept();
            if (isLoggedIn) {
                onSkipLocation();
            } else {
                setStep("legal");
            }
        } catch (e) {
            // If location fails (e.g. denied or no support), show manual region select
            setShowRegionSelectModal(true);
        }
    };

    const handleLegalSubmit = () => {
        if (!isAgreed) return;
        onSkipLocation(); // Reuse this as the final trigger for page.tsx to start test
    };

    return (
        <>
            <BaseModal
                isOpen={isOpen && !showRegionSelectModal}
                onClose={onClose}
                showCloseButton={step !== "legal"}
                backdropClassName="bg-black/5 backdrop-blur-[2px]"
                className="p-10 text-center rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden border border-white/20 ring-1 ring-white/10 bg-[#FDFBF7]/80 backdrop-blur-2xl"
            >
                {/* Texture Overlay in Modal */}
                <div
                    className="texture-overlay absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                    }}
                />

                <div className="relative min-h-[320px] flex flex-col">
                    <div className="flex-1 flex flex-col justify-center py-2">
                        <AnimatePresence mode="wait">
                            {step === "nickname" && (
                                <m.div
                                    key="step-nickname"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="flex justify-center mb-6 text-[#3D4430]">
                                        <Image
                                            src="/images/wave-bye.svg"
                                            alt="Wave"
                                            width={36}
                                            height={36}
                                            className="opacity-80"
                                            priority
                                        />
                                    </div>

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
                                        className="w-full px-6 py-4 mb-6 text-center text-[#1A1A1A] bg-[#FDFBF7] border border-[#3D4430]/10 rounded-full focus:outline-none focus:border-[#3D4430]/30 transition-all placeholder:text-[#3D4430]/20 text-[15px] tracking-wide"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleNicknameNext();
                                            }
                                        }}
                                        autoFocus
                                    />

                                    <div className="space-y-3">
                                        <button
                                            onClick={handleNicknameNext}
                                            disabled={!nickname.trim()}
                                            className="group inline-flex items-center gap-2 py-2 text-[15px] tracking-[0.2em] font-medium text-[#8B7355] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-300 bg-transparent border-none outline-none mx-auto"
                                        >
                                            <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">下一步</span>
                                            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                        </button>
                                    </div>
                                </m.div>
                            )}

                            {step === "location" && (
                                <m.div
                                    key="step-location"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="flex justify-center mb-6 text-[#8B7355]">
                                        <MapPin className="h-9 w-9 opacity-90" strokeWidth={1.2} />
                                    </div>

                                    <h3 className="mb-4 text-xl font-serif text-[#1A1A1A]">
                                        开启定位服务
                                    </h3>

                                    <p className="mb-8 text-sm text-[#5E5E5E] leading-relaxed font-light">
                                        我们需要分析您所在地区的气候环境，<br />为肤质判断提供依据。
                                    </p>

                                    <div className="space-y-3">
                                        <button
                                            onClick={handleLocationAcceptWrapper}
                                            disabled={isLocating}
                                            className="group inline-flex items-center gap-2 py-2 text-[15px] tracking-[0.2em] font-medium text-[#8B7355] disabled:opacity-30 disabled:cursor-wait cursor-pointer transition-all duration-300 bg-transparent border-none outline-none mx-auto"
                                        >
                                            {isLocating ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                                    <span>正在定位...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">允许访问</span>
                                                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={handleDecline}
                                            className="w-full py-2 text-[12px] tracking-widest text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            手动选择地区
                                        </button>
                                    </div>
                                </m.div>
                            )}

                            {step === "legal" && (
                                <m.div
                                    key="step-legal"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <div className="flex justify-center mb-6 text-[#8B7355]">
                                        <ShieldCheck className="h-9 w-9 opacity-90 transition-all duration-700" strokeWidth={1.2} />
                                    </div>

                                    <h3 className="mb-4 text-xl font-serif text-[#1A1A1A]">
                                        服务确认与授权
                                    </h3>

                                    <div className="bg-[#FDFBF7]/50 rounded-2xl p-6 mb-8 border border-[#3D4430]/5 text-left">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className="mt-1 relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isAgreed}
                                                    onChange={(e) => setIsAgreed(e.target.checked)}
                                                    className="sr-only"
                                                />
                                                <div className={`w-5 h-5 rounded border transition-all duration-300 flex items-center justify-center ${isAgreed ? 'bg-[#8B7355] border-[#8B7355]' : 'bg-transparent border-[#8B7355]/20 group-hover:border-[#8B7355]/40'}`}>
                                                    {isAgreed && <m.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></m.svg>}
                                                </div>
                                            </div>
                                            <span className="text-[13px] text-[#5E5E5E] leading-relaxed font-light select-none">
                                                我已年满 14 周岁（未满 14 周岁已获得监护人许可），且已阅读并同意我们的
                                                <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="text-[#3D4430] font-medium underline underline-offset-4 mx-1">隐私政策</a>
                                                与
                                                <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="text-[#3D4430] font-medium underline underline-offset-4 mx-1">服务条款</a>。
                                            </span>
                                        </label>
                                    </div>

                                    <div className="flex flex-col items-center space-y-3">
                                        <button
                                            onClick={handleLegalSubmit}
                                            disabled={!isAgreed}
                                            className="group inline-flex items-center gap-2 py-2 text-[15px] tracking-[0.2em] font-medium text-[#8B7355] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-300 bg-transparent border-none outline-none"
                                        >
                                            <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">开始测试</span>
                                            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                        </button>
                                        
                                        <button
                                            onClick={onClose}
                                            className="w-full py-2 text-[12px] tracking-widest text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            暂不测试
                                        </button>
                                    </div>
                                </m.div>
                            )}
                        </AnimatePresence>
                    </div>


                </div>
            </BaseModal>

            {/* Region Select Modal Overlay (Fallback) */}
            <BaseModal
                isOpen={showRegionSelectModal}
                onClose={() => setShowRegionSelectModal(false)}
                backdropClassName="bg-black/5 backdrop-blur-[4px]"
                className="flex flex-col max-h-[80vh] p-0 rounded-[2.5rem] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.15)] overflow-hidden bg-[#FDFBF7]/90 backdrop-blur-3xl border border-white/40"
            >
                {/* Texture Overlay */}
                <div
                    className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                    }}
                />

                <div className="p-8 pb-4 text-center shrink-0 relative">
                    <button
                        onClick={() => setShowRegionSelectModal(false)}
                        className="absolute left-6 top-8 p-2 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-full hover:bg-[#8B7355]/5 flex items-center justify-center border-none cursor-pointer"
                        title="返回"
                    >
                        <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                    <h3 className="text-xl font-serif text-[#1A1A1A] tracking-wider">选择所在地区</h3>
                    <p className="text-[13px] text-[#5E5E5E] mt-2 font-light opacity-80">根据当地气候为您提供更精准的分析建议</p>
                </div>

                <div className="overflow-y-auto px-8 py-4 custom-scrollbar flex-1 relative">
                    {regionOptions.map((group) => (
                        <div key={group.group} className="mb-8 last:mb-2">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#8B7355]/10"></div>
                                <span className="text-[11px] font-bold text-[#8B7355]/60 uppercase tracking-[0.25em]">
                                    {group.group}
                                </span>
                                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#8B7355]/10"></div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {group.regions.map((region) => (
                                    <button
                                        key={region}
                                        onClick={() => handleRegionOption(region)}
                                        className="py-3 px-2 rounded-xl text-[13px] text-[#3D4430] bg-white/40 hover:bg-[#8B7355]/10 hover:text-[#8B7355] border border-[#3D4430]/5 hover:border-[#8B7355]/20 transition-all duration-300 font-medium active:scale-95"
                                    >
                                        {region}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 shrink-0 text-center relative border-t border-[#3D4430]/5">
                    <button
                        onClick={handleSkipRegion}
                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                    >
                        暂不提供
                    </button>
                </div>
            </BaseModal>
        </>
    );
}
