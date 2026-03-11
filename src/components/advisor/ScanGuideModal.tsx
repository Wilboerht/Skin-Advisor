"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Glasses, Sun, Smartphone, ScanFace } from "lucide-react";

interface ScanGuideModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
}

export function ScanGuideModal({ isOpen, onConfirm, onCancel }: ScanGuideModalProps) {
    const guideItems = [
        {
            icon: Sparkles,
            title: "保持素颜",
            desc: "建议卸除底妆、遮瑕及有色面霜，还原最真实的皮肤纹理与色泽。"
        },
        {
            icon: Glasses,
            title: "摘下眼镜",
            desc: "请摘下眼镜、墨镜及面部饰品，避免镜片反光及遮挡关键区域。"
        },
        {
            icon: Sun,
            title: "光源充足",
            desc: "建议面向窗户自然光或室内明亮主灯，避免背光或阴阳脸。"
        },
        {
            icon: Smartphone,
            title: "对准镜头",
            desc: "手机保持约 20-30cm 距离，平视镜头，将面部置于引导框中央。"
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#1A1A1A]/10 backdrop-blur-md"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 8 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="relative z-10 bg-[#FDFBF7]/85 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-[560px] overflow-hidden border border-white/40 ring-1 ring-white/20"
                    >
                        <div className="p-7 pt-9">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-full bg-[#4A3728]/5 flex items-center justify-center mb-1 ring-1 ring-[#4A3728]/10 shadow-inner">
                                    <ScanFace className="w-8 h-8 text-[#4A3728]" strokeWidth={1.2} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-serif text-[#1A1A1A] tracking-tight">
                                        开始面部扫描
                                    </h3>
                                    <p className="text-[15px] text-[#4A3728]/60 font-light tracking-wide max-w-xs mx-auto">
                                        为了获得最准确的分析结果，请遵循以下建议
                                    </p>
                                </div>
                            </div>

                            {/* Checklist Content */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 items-stretch">
                                {guideItems.map((item, index) => {
                                    const Icon = item.icon;
                                    return (
                                        <div
                                            key={index}
                                            className="flex flex-col h-full p-5 rounded-2xl bg-white/40 border border-[#4A3728]/5 hover:border-[#4A3728]/20 hover:bg-white/60 hover:shadow-xl hover:shadow-[#4A3728]/5 transition-all duration-500 group backdrop-blur-sm"
                                        >
                                            <div className="flex items-start gap-3.5 mb-auto">
                                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#4A3728]/5 group-hover:bg-[#4A3728]/10 transition-all duration-500 flex items-center justify-center text-[#4A3728] group-hover:scale-110 shadow-sm border border-white/40">
                                                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                                                </div>
                                                <div className="flex-1 pt-1.5">
                                                    <h4 className="text-base font-semibold text-[#1A1A1A] mb-2 leading-none tracking-wide">
                                                        {item.title}
                                                    </h4>
                                                    <p className="text-[13px] text-[#4A3728]/70 leading-relaxed font-light">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Actions */}
                            <div className="pt-2 flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        // 关键体验修复：利用用户的首次显式点击解锁 iOS Safari 的语音合成引擎
                                        if (typeof window !== 'undefined' && window.speechSynthesis) {
                                            const wakeUpStr = new SpeechSynthesisUtterance('');
                                            wakeUpStr.volume = 0;
                                            window.speechSynthesis.speak(wakeUpStr);
                                        }
                                        onConfirm();
                                    }}
                                    className="w-full h-14 rounded-full bg-[#4A3728]/95 backdrop-blur-md hover:bg-[#4A3728] text-[#FDFBF7] text-[15px] font-bold tracking-[0.2em] shadow-xl hover:shadow-[#4A3728]/30 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 group border border-white/20"
                                >
                                    <span>我已准备好</span>
                                    <Check className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                </button>

                                {onCancel && (
                                    <button
                                        onClick={onCancel}
                                        className="w-full h-10 rounded-full text-[#4A3728]/40 hover:text-[#4A3728] text-[13px] font-medium tracking-[0.2em] transition-all duration-300 flex items-center justify-center group"
                                    >
                                        <span className="relative">
                                            暂不测试，退出
                                            <span className="absolute -bottom-1 left-1.5 right-1.5 h-[1px] bg-current scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center opacity-30" />
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
