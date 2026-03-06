"use client";

import { useState } from "react";
import { BaseModal } from "@/components/ui/BaseModal";
import { Loader2, MapPin } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";

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
}

type Step = "nickname" | "location";

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
    regionOptions
}: OnboardingFlowProps) {
    const [step, setStep] = useState<Step>("nickname");

    const [showRegionSelectModal, setShowRegionSelectModal] = useState(false);


    const handleNicknameNext = () => {
        if (!nickname.trim()) return;
        onNicknameSubmit();
        setStep("location");
    };

    const handleDecline = () => {
        onLocationDecline();
        // Do not close onboarding here, let the handler decide (or open region select)
        setShowRegionSelectModal(true);
    }

    const handleSkipRegion = () => {
        setShowRegionSelectModal(false);
        onSkipLocation();
    }

    const handleRegionOption = (region: string) => {
        setShowRegionSelectModal(false);
        onRegionSelect(region);
    }

    // Handle location accept wrapper
    const handleLocationAcceptWrapper = async () => {
        try {
            await onLocationAccept();
        } catch (e) {
            // If location fails (e.g. denied or no support), show manual region select
            setShowRegionSelectModal(true);
        }
    };

    return (
        <>
            <BaseModal
                isOpen={isOpen && !showRegionSelectModal}
                onClose={onClose}
                showCloseButton
                className="p-10 text-center rounded-[2rem] shadow-2xl overflow-hidden"
            >
                {/* Texture Overlay in Modal */}
                <div
                    className="texture-overlay absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                    }}
                />

                <div className="relative min-h-[280px] flex flex-col">
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
                                            className="glass-premium-primary w-full py-3.5 rounded-full text-[15px] tracking-[0.2em] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-300 border-none outline-none"
                                        >
                                            下一步
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
                                            onClick={handleLocationAcceptWrapper}
                                            disabled={isLocating}
                                            className="glass-premium-primary w-full py-3.5 rounded-full text-[15px] tracking-[0.2em] font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-wait border-none cursor-pointer transition-all duration-300 outline-none"
                                        >
                                            {isLocating ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                                    正在定位...
                                                </>
                                            ) : "允许访问"}
                                        </button>

                                        <button
                                            onClick={handleDecline}
                                            className="w-full py-3 text-[13px] tracking-widest text-[#3D4430]/40 hover:text-[#3D4430] transition-all duration-300 bg-transparent border-none cursor-pointer"
                                        >
                                            暂不提供
                                        </button>
                                    </div>
                                </m.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex justify-center items-center gap-2 pt-6 pb-1">
                        <div className={`rounded-full transition-all duration-500 ${step === 'nickname' ? 'h-1.5 w-6 bg-[#3D4430]' : 'h-1.5 w-1.5 bg-[#3D4430]/15 hover:bg-[#3D4430]/30'}`} />
                        <div className={`rounded-full transition-all duration-500 ${step === 'location' ? 'h-1.5 w-6 bg-[#3D4430]' : 'h-1.5 w-1.5 bg-[#3D4430]/15 hover:bg-[#3D4430]/30'}`} />
                    </div>
                </div>
            </BaseModal>

            {/* Region Select Modal Overlay (Fallback) */}
            <BaseModal
                isOpen={showRegionSelectModal}
                onClose={handleSkipRegion}
                className="flex flex-col max-h-[70vh] p-0 rounded-[2rem] shadow-2xl overflow-hidden"
            >
                {/* Texture Overlay */}
                <div
                    className="texture-overlay absolute inset-0 opacity-[0.02] pointer-events-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                    }}
                />

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
                                        onClick={() => handleRegionOption(region)}
                                        className="glass-premium px-5 py-2.5 rounded-full text-xs transition-all duration-300 min-w-[5rem] border-none cursor-pointer hover:scale-105 active:scale-95"
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
                        onClick={handleSkipRegion}
                        className="text-xs text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                    >
                        跳过
                    </button>
                </div>
            </BaseModal>
        </>
    );
}
