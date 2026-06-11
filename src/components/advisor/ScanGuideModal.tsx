"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Sun, ScanEye, ChevronLeft } from "lucide-react";
import Image from "next/image";
import { HomeSvg } from "@/components/icons/HomeSvg";

interface ScanGuideModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
    onExit?: () => void;
}

export function ScanGuideModal({ isOpen, onConfirm, onCancel, onExit }: ScanGuideModalProps) {
    const guideItems = [
        { icon: Sparkles, title: "保持素颜" },
        { icon: Sun, title: "光线充足" },
        { icon: ScanEye, title: "对准镜头" }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="fixed inset-0 z-[300] bg-[#FAF8F5] flex flex-col items-center overflow-y-auto p-4"
                >
                    {/* Top Bar */}
                    <div className="relative flex items-center justify-center py-4 z-20 shrink-0 w-full">
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="absolute left-0 p-2 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-full hover:bg-[#3D4430]/5"
                                aria-label="返回"
                            >
                                <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
                            </button>
                        )}
                        <Image
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD"
                            width={120}
                            height={30}
                            className="h-7 sm:h-8 object-contain"
                            priority
                        />
                        {onExit && (
                            <button
                                onClick={onExit}
                                className="absolute right-0 p-2 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-full hover:bg-[#3D4430]/5"
                                aria-label="退出测试"
                            >
                                <HomeSvg className="w-6 h-6" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <div className="w-full max-w-2xl p-4 flex flex-col items-center">
                            {/* Header */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                                className="flex flex-col items-center text-center"
                            >
                                <h3 className="text-3xl md:text-4xl font-serif text-[#1A1A1A] tracking-tight mb-6">
                                    开始面部扫描
                                </h3>
                                <img
                                    src="/images/gender-decoration.svg"
                                    alt=""
                                    className="w-28 h-28 mx-auto opacity-60 mb-6"
                                />
                            </motion.div>

                            {/* Checklist Content */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="w-full flex items-center justify-center mb-12"
                            >
                                {guideItems.map((item, index) => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={index} className="flex items-center">
                                            <div className="flex flex-col items-center gap-3 px-6 sm:px-10">
                                                <Icon className="w-6 h-6 text-[#4A3728]/50" strokeWidth={1.5} />
                                                <span className="text-sm text-[#1A1A1A]/70 font-light tracking-wide">
                                                    {item.title}
                                                </span>
                                            </div>
                                            {index < guideItems.length - 1 && (
                                                <div className="w-px h-10 bg-[#4A3728]/15" />
                                            )}
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
                                    className="group relative w-full max-w-sm inline-flex items-center justify-center gap-4 px-10 py-3.5 sm:px-14 border border-[#3D4430]/25 hover:border-[#3D4430]/50 hover:bg-[#3D4430]/[0.03] text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium cursor-pointer transition-all duration-500 mb-5"
                                >
                                    <span>我已准备好</span>
                                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                </button>

                                {/* Secondary Actions */}
                                <div className="flex items-center justify-center gap-4 w-full">
                                    {onCancel && (
                                        <button
                                            onClick={onCancel}
                                            className="px-3 py-2 text-[#3D4430]/60 hover:text-[#3D4430] text-[13px] tracking-[0.1em] transition-colors duration-300"
                                        >
                                            返回修改问卷
                                        </button>
                                    )}

                                    {(onCancel && onExit) && (
                                        <div className="w-px h-4 bg-[#3D4430]/15" />
                                    )}

                                    {onExit && (
                                        <button
                                            onClick={onExit}
                                            className="px-3 py-2 text-[#3D4430]/60 hover:text-[#3D4430] text-[13px] tracking-[0.1em] transition-colors duration-300"
                                        >
                                            退出测试
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="py-6 opacity-40 shrink-0 text-center">
                        <p className="text-center text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A] leading-tight">
                            &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
