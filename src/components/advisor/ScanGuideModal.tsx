"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Sun, Smartphone } from "lucide-react";
import Image from "next/image";

interface ScanGuideModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
    onExit?: () => void;
}

export function ScanGuideModal({ isOpen, onConfirm, onCancel, onExit }: ScanGuideModalProps) {
    const guideItems = [
        {
            icon: Sparkles,
            title: "保持素颜",
            desc: "请在扫描前彻底卸除底妆、防晒及彩妆产品，清洁面部并静待5分钟，以确保AI能够识别您最真实的肌肤纹理、色斑分布与毛孔状态，避免残留化妆品干扰分析精度。",
            fullWidth: true
        },
        {
            icon: Sun,
            title: "光源充足",
            desc: "确保面部光线均匀，避免背光"
        },
        {
            icon: Smartphone,
            title: "对准镜头",
            desc: "平视镜头，将面部置于引导框中央"
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="fixed inset-0 z-[300] bg-[#FAF8F5] flex flex-col items-center justify-center overflow-y-auto"
                >
                    <div className="w-full max-w-2xl px-6 py-12 md:py-16 flex flex-col items-center">
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="flex flex-col items-center text-center gap-4 mb-10"
                        >
                            <Image src="/NIHPLOD-logo.svg" alt="NIHPLOD" width={140} height={74} className="w-[140px] h-16 mb-2" />
                            <div className="space-y-2">
                                <h3 className="text-3xl md:text-4xl font-serif text-[#1A1A1A] tracking-tight">
                                    开始面部扫描
                                </h3>
                                <p className="text-[15px] text-[#4A3728]/60 font-light tracking-wide max-w-sm mx-auto">
                                    为了获得最准确的分析结果，请遵循以下建议
                                </p>
                            </div>
                        </motion.div>

                        {/* Checklist Content */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-10"
                        >
                            {guideItems.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={index}
                                        className={`flex flex-col h-full p-4 sm:p-5 rounded-lg bg-white/50 border border-[#D4CFC5]/60 hover:border-[#8B7355]/25 hover:bg-[#F8F5EE]/80 transition-all duration-300 group ${item.fullWidth ? 'sm:col-span-2' : ''}`}
                                    >
                                        <div className="flex items-center sm:items-start gap-3 sm:gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#4A3728]/[0.04] group-hover:bg-[#4A3728]/[0.08] transition-colors duration-300 flex items-center justify-center text-[#4A3728]">
                                                <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={1.5} />
                                            </div>
                                            <div className="flex-1 sm:pt-0.5">
                                                <h4 className="text-sm sm:text-[15px] font-medium text-[#1A1A1A] sm:mb-1.5 tracking-wide">
                                                    {item.title}
                                                </h4>
                                                <p className="hidden sm:block text-[13px] text-[#5E5E5E]/80 leading-relaxed font-light">
                                                    {item.desc}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </motion.div>

                        {/* Actions */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="w-full max-w-md flex flex-col items-center"
                        >
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
                                className="w-full max-w-sm h-12 rounded-md bg-[#4A3728] hover:bg-[#3D2E20] text-[#FDFBF7] text-[14px] font-medium tracking-[0.15em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 group mb-5"
                            >
                                <span>我已准备好</span>
                                <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" />
                            </button>

                            {/* Secondary Actions */}
                            <div className="flex items-center justify-center gap-4 w-full">
                                {onCancel && (
                                    <button
                                        onClick={onCancel}
                                        className="px-4 h-10 text-[#4A3728]/50 hover:text-[#4A3728] text-[13px] font-medium tracking-[0.15em] transition-all duration-300 flex items-center justify-center group"
                                    >
                                        <span className="relative">
                                            返回修改问卷
                                            <span className="absolute -bottom-1 left-0 right-0 h-[1px] bg-current scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center opacity-30" />
                                        </span>
                                    </button>
                                )}

                                {(onCancel && onExit) && (
                                    <div className="w-px h-3 bg-[#4A3728]/10" />
                                )}

                                {onExit && (
                                    <button
                                        onClick={onExit}
                                        className="px-4 h-10 text-[#4A3728]/50 hover:text-[#4A3728] text-[13px] font-medium tracking-[0.15em] transition-all duration-300 flex items-center justify-center group"
                                    >
                                        <span className="relative">
                                            退出测试
                                            <span className="absolute -bottom-1 left-0 right-0 h-[1px] bg-current scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center opacity-30" />
                                        </span>
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
