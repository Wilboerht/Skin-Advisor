"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

interface ScanGuideModalProps {
    isOpen: boolean;
    onConfirm: () => void;
}

export function ScanGuideModal({ isOpen, onConfirm }: ScanGuideModalProps) {
    const guideItems = [
        {
            title: "保持素颜",
            desc: "建议卸除底妆、遮瑕及有色面霜，还原最真实的皮肤纹理与色泽。"
        },
        {
            title: "摘下眼镜",
            desc: "请摘下眼镜、墨镜及面部饰品，避免镜片反光及遮挡关键区域。"
        },
        {
            title: "光源充足",
            desc: "建议面向窗户自然光或室内明亮主灯，避免背光或阴阳脸。"
        },
        {
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
                        className="fixed inset-0 bg-[#191919]/40 backdrop-blur-[2px]"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 8 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="relative z-10 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] w-full max-w-[560px] overflow-hidden border border-[#E9E9E7]"
                    >
                        <div className="p-8 pb-6">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center gap-5 mb-8">
                                <div className="text-[42px] leading-none mb-1">📸</div>
                                <div className="space-y-1.5">
                                    <h3 className="text-[18px] font-bold text-[#37352F] tracking-tight">开始面部扫描</h3>
                                </div>
                            </div>

                            {/* Checklist Content */}
                            <div className="space-y-3 mb-8">
                                {guideItems.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-[#F7F7F5] rounded-lg border border-[#EBEBE9]">
                                        <div className="flex-shrink-0 w-5 h-5 bg-white rounded flex items-center justify-center text-[11px] font-semibold text-[#37352F] border border-[#EBEBE9] shadow-sm mt-0.5">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-[14px] font-medium text-[#37352F] mb-1">{item.title}</h4>
                                            <p className="text-[13px] text-[#787774] font-light leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Privacy Note */}
                            <div className="mb-6 mx-1">
                                <p className="text-[12px] text-[#37352F]/40 text-center leading-relaxed">
                                    🔒 隐私保护：照片仅用于 AI 实时分析，<br />分析后立即销毁，绝不留存。
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={onConfirm}
                                    className="w-full h-11 rounded-lg bg-[#2383E2] hover:bg-[#1A73CB] text-white text-[14px] font-medium shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <span>我已准备好</span>
                                    <Check className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
