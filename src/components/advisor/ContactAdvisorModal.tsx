"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ContactAdvisorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ContactAdvisorModal({ isOpen, onClose }: ContactAdvisorModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop with Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-[420px] bg-white rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>

                        {/* Header */}
                        <div className="p-10 pt-14 text-center pb-6">
                            <div className="mb-7 flex justify-center">
                                <img
                                    src="/NIHPLOD-logo.svg"
                                    alt="NIHPLOD"
                                    className="h-[34px] object-contain"
                                />
                            </div>
                            <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">
                                联系顾问
                            </p>
                        </div>

                        {/* Content */}
                        <div className="px-10 pb-10 pt-2 flex flex-col items-center gap-6">
                            {/* Advisor QR Code */}
                            <div className="w-[200px] h-[200px] rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                                <img
                                    src="/images/advisor-qr.jpg"
                                    alt="顾问二维码"
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            <div className="text-center space-y-2">
                                <h3 className="text-base font-bold" style={{ color: '#5c4937' }}>
                                    扫码添加专属护肤顾问
                                </h3>
                                <p className="text-sm leading-relaxed" style={{ color: '#5c4937', opacity: 0.8 }}>
                                    获得一对一专业护肤指导
                                    <br />
                                    定制您的个人护肤方案
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
