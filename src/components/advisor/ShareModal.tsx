"use client";

/**
 * 分享弹窗组件
 * 仅支持保存海报分享
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 自定义预览内容，如 SharePoster */
    preview: React.ReactNode;
    /** 保存海报回调 */
    onSavePoster: () => Promise<void>;
    /** 是否正在生成海报 */
    isGeneratingPoster?: boolean;
}

export function ShareModal({
    isOpen,
    onClose,
    preview,
    onSavePoster,
    isGeneratingPoster = false,
}: ShareModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 text-brand-charcoal">
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* 弹窗内容 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative flex max-h-full w-full max-w-[640px] flex-col overflow-hidden rounded-[32px] bg-white/90 backdrop-blur-2xl shadow-2xl border border-white/60"
                    >
                        {/* 关闭按钮 */}
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10"
                        >
                            <X className="h-5 w-5 opacity-60" />
                        </button>

                        {/* 内容区 */}
                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-center gap-8 md:gap-12 p-8 pt-10 lg:p-10 lg:pt-12">
                            {/* 左侧：文字和操作 */}
                            <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 min-w-0 order-2 md:order-1">
                                <h3 className="text-xl font-bold text-[#2d2a26] mb-2 tracking-tight">
                                    分享你的素颜证书
                                </h3>
                                <p className="text-sm text-[#8c7a6b] mb-8 leading-relaxed">
                                    保存海报，分享到你的社交平台
                                </p>

                                <div className="w-full space-y-4">
                                    <button
                                        onClick={onSavePoster}
                                        disabled={isGeneratingPoster}
                                        className="relative w-full py-4 px-6 rounded-full shadow-[0_4px_12px_-2px_rgba(150,110,60,0.2)] border border-[#e6d0a8]/50 group transition-all disabled:opacity-60"
                                        style={{
                                            background: "linear-gradient(135deg, #fdf6e9 0%, #f5dfb8 50%, #e6d0a8 100%)",
                                        }}
                                    >
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-white/30 pointer-events-none" />
                                        <span className="relative z-10 text-[#5e4b3c] text-sm font-bold flex items-center justify-center gap-2 tracking-wide">
                                            {isGeneratingPoster ? (
                                                <>
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e4b3c]/30 border-t-[#5e4b3c]" />
                                                    生成中...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4" />
                                                    保存分享海报
                                                </>
                                            )}
                                        </span>
                                    </button>

                                    <button
                                        onClick={onClose}
                                        className="w-full py-2.5 text-sm font-medium text-[#c4b5a2] hover:text-[#8c7a6b] transition-colors"
                                    >
                                        再等一下
                                    </button>
                                </div>
                            </div>

                            {/* 右侧：预览 */}
                            <div className="shrink-0 order-1 md:order-2">
                                {preview}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
