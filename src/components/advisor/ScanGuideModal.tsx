"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Sun, ScanEye, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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

    const handleClose = () => {
        if (onExit) onExit();
        else if (onCancel) onCancel();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="fixed inset-0 z-[320] bg-[#FAF8F5] flex flex-col items-center overflow-y-auto overscroll-contain"
                >
                    {/* ---- App Bar / Header ---- */}
                    <header className="fixed top-0 left-0 right-0 z-[330] flex items-center justify-between px-6 md:px-12 lg:px-20 py-5 md:py-6 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#1A1A1A]/5">
                        <button
                            onClick={handleClose}
                            className="group flex items-center gap-2 text-[#1A1A1A]/80 hover:text-[#1A1A1A] transition-colors cursor-pointer bg-transparent border-none"
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
                            onClick={handleClose}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-all cursor-pointer bg-transparent border-none"
                            aria-label="退出"
                        >
                            <LogOut className="w-4 h-4" strokeWidth={1.5} />
                            <span className="text-sm tracking-wide">退出</span>
                        </button>
                    </header>

                    {/* Content */}
                    <div className="flex-1 flex flex-col items-center justify-center w-full px-4 md:px-8 pt-16 md:pt-20">
                        <div className="w-full max-w-2xl flex flex-col items-center">
                            {/* Header */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                                className="flex flex-col items-center text-center"
                            >
                                <h3 className="text-3xl md:text-4xl font-serif text-[#1A1A1A] tracking-tight mb-6 md:mb-8">
                                    开始面部扫描
                                </h3>
                                <img
                                    src="/images/facescan.png"
                                    alt=""
                                    className="w-36 h-36 sm:w-44 sm:h-44 mx-auto mb-8 md:mb-10"
                                />
                            </motion.div>

                            {/* Checklist Content */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="w-full flex items-center justify-center mb-10 md:mb-12"
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
                                className="w-full flex flex-col items-center"
                            >
                                <button
                                    onClick={() => {
                                        // 关键体验修复：利用用户的首次显式点击解锁 iOS Safari 的语音合成引擎
                                        if (typeof window !== 'undefined' && window.speechSynthesis) {
                                            try {
                                                const wakeUpStr = new SpeechSynthesisUtterance('');
                                                wakeUpStr.volume = 0;
                                                window.speechSynthesis.speak(wakeUpStr);
                                            } catch (e) {
                                                console.warn("[ScanGuide] speechSynthesis wake-up failed:", e);
                                            }
                                        }
                                        onConfirm();
                                    }}
                                    className="group relative inline-flex items-center justify-center gap-3 px-12 py-4 sm:px-16 border border-[#4A3728] text-[#4A3728] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#4A3728] hover:text-[#FAF8F5]"
                                >
                                    <span>我已准备好</span>
                                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                                </button>
                            </motion.div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="py-6 opacity-40 shrink-0 text-center px-4">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A] leading-tight">
                            <p>&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                            <span className="hidden sm:inline text-[#1A1A1A]/30">·</span>
                            <div className="hidden sm:flex items-center gap-4">
                                <Link href="/privacy" className="hover:text-[#3D4430] transition-colors duration-300">隐私政策</Link>
                                <span className="text-[#1A1A1A]/30">·</span>
                                <Link href="/terms" className="hover:text-[#3D4430] transition-colors duration-300">服务条款</Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
