"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Glasses, Sun, Smartphone, ScanFace, ShieldCheck } from "lucide-react";

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
                        className="fixed inset-0 bg-[#3D4430]/40 backdrop-blur-sm"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 8 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="relative z-10 bg-[#FBF9F5] rounded-2xl shadow-2xl w-full max-w-[640px] overflow-hidden border border-[#3D4430]/10"
                    >
                        <div className="p-8 pt-10">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-full bg-[#3D4430]/5 flex items-center justify-center mb-1">
                                    <ScanFace className="w-7 h-7 text-[#3D4430]" strokeWidth={1.5} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-serif font-bold text-[#3D4430] tracking-wide">
                                        开始面部扫描
                                    </h3>
                                    <p className="text-sm text-[#3D4430]/60 font-light tracking-wide max-w-xs mx-auto">
                                        为了获得最准确的分析结果，请遵循以下建议
                                    </p>
                                </div>
                            </div>

                            {/* Checklist Content */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 items-stretch">
                                {guideItems.map((item, index) => {
                                    const Icon = item.icon;
                                    return (
                                        <div
                                            key={index}
                                            className="flex flex-col h-full p-5 rounded-2xl bg-white border border-[#3D4430]/5 hover:border-[#3D4430]/20 hover:shadow-md transition-all duration-300 group"
                                        >
                                            <div className="flex items-start gap-4 mb-auto">
                                                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#3D4430]/5 group-hover:bg-[#3D4430]/10 transition-colors flex items-center justify-center text-[#3D4430]">
                                                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                                                </div>
                                                <div className="flex-1 pt-1.5">
                                                    <h4 className="text-base font-bold text-[#3D4430] mb-2 leading-none group-hover:text-[#2A3020] transition-colors">
                                                        {item.title}
                                                    </h4>
                                                    <p className="text-sm text-[#3D4430]/70 leading-relaxed font-normal">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Privacy Note - Enhanced Professional Version */}
                            <div className="mb-10 px-6 py-4 rounded-2xl bg-[#3D4430]/5 border border-[#3D4430]/10 flex items-start gap-4">
                                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
                                    <ShieldCheck className="w-5 h-5 text-[#3D4430]" strokeWidth={2} />
                                </div>
                                <div className="space-y-1.5 flex-1">
                                    <h5 className="text-[14px] font-bold text-[#3D4430] leading-none tracking-wide">隐私安全与数据保护</h5>
                                    <p className="text-[12px] text-[#3D4430]/60 leading-relaxed font-normal">
                                        您的面部图像经由端端加密技术安全传输，仅供 AI 皮肤分析模型进行生物特征实时提取。分析任务完成后，原始图像将立即从所有计算节点中永久移除并销毁。我们严格遵守中华人民共和国《个人信息保护法》(PIPL) 及行业安全标准，绝不存储、转卖或向第三方公开您的影像数据。
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex flex-col gap-4">
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
                                    className="w-full h-12 rounded-xl bg-[#3D4430] hover:bg-[#2A3020] text-[#F0EDE1] text-[15px] font-medium tracking-wide shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 group"
                                >
                                    <span>我已准备好</span>
                                    <Check className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                </button>

                                {onCancel && (
                                    <button
                                        onClick={onCancel}
                                        className="w-full h-10 rounded-full text-[#3D4430]/30 hover:text-[#3D4430]/60 text-[13px] font-medium tracking-[0.15em] transition-all duration-300 flex items-center justify-center group"
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
