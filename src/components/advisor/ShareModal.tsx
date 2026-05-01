"use client";

/**
 * 分享弹窗组件
 * 支持自定义预览内容、多平台真实分享
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import { X, Download, MessageCircle, Twitter } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
    copyToClipboard,
    shareToWeibo,
    shareToXiaohongshu,
    shareToDouyin,
    generateShareText,
} from "@/lib/share";

// 小红书图标
const XiaohongshuIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" height="1em" width="1em">
        <path d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm0 853.3c-188.5 0-341.3-152.8-341.3-341.3S323.5 170.7 512 170.7s341.3 152.8 341.3 341.3-152.8 341.3-341.3 341.3z" />
        <path d="M512 256c-141.4 0-256 114.6-256 256s114.6 256 256 256 256-114.6 256-256-114.6-256-256-256zm0 426.7c-94.1 0-170.7-76.6-170.7-170.7S417.9 341.3 512 341.3s170.7 76.6 170.7 170.7S606.1 682.7 512 682.7z" />
    </svg>
);

// 抖音图标
const DouyinIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" height="1em" width="1em">
        <path d="M858.7 506.7V170.7h-128v293.3c0 70.4-57.6 128-128 128s-128-57.6-128-128 57.6-128 128-128V42.7c-141.1 0-256 114.9-256 256s114.9 256 256 256c19.2 0 37.8-2.1 55.5-6.1L453.3 853.3h133.3l5.3-298.7h117.3c21.3 0 42.7-5.3 64-16v-85.3c-37.3 16-77.9 24-120 24s-81.6-11.7-114.7-31.5z" />
    </svg>
);

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 自定义预览内容，如 SharePoster */
    preview: React.ReactNode;
    /** 截图目标 ref（用于小红书/抖音保存图片） */
    captureRef?: React.RefObject<HTMLDivElement | null>;
    /** 分享链接 */
    shareUrl?: string;
    /** 肤质标签，用于生成文案 */
    skinTypeLabel?: string;
    /** 肌肤评分，用于生成文案 */
    score?: number;
    /** 保存海报回调 */
    onSavePoster: () => Promise<void>;
    /** 是否正在生成海报 */
    isGeneratingPoster?: boolean;
    /** 分享行为追踪回调 */
    trackShare?: (method: "image" | "link" | "weibo" | "native" | "wechat" | "xiaohongshu" | "douyin") => void;
}

export function ShareModal({
    isOpen,
    onClose,
    preview,
    shareUrl,
    skinTypeLabel,
    score,
    onSavePoster,
    isGeneratingPoster = false,
    trackShare,
}: ShareModalProps) {
    const [mounted, setMounted] = useState(false);
    const toast = useToast();

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const currentUrl = shareUrl || (typeof window !== "undefined" ? window.location.href : "");

    const handleShare = useCallback(
        async (platform: "wechat" | "weibo" | "xiaohongshu" | "douyin") => {
            const shareData = {
                title: generateShareText(skinTypeLabel).title,
                description: generateShareText(skinTypeLabel).description,
                url: currentUrl,
                skinTypeLabel,
                score,
            };

            try {
                switch (platform) {
                    case "weibo": {
                        shareToWeibo(shareData);
                        toast.success("已打开微博分享窗口");
                        trackShare?.("weibo");
                        break;
                    }
                    case "wechat": {
                        await copyToClipboard(currentUrl);
                        toast.success("链接已复制，快去微信粘贴分享给好友吧");
                        trackShare?.("wechat");
                        break;
                    }
                    case "xiaohongshu": {
                        // 1. 保存图片
                        await onSavePoster();
                        // 2. 复制文案
                        await shareToXiaohongshu(shareData);
                        toast.success("海报和文案已准备，快去小红书发布吧");
                        trackShare?.("xiaohongshu");
                        break;
                    }
                    case "douyin": {
                        // 1. 保存图片
                        await onSavePoster();
                        // 2. 复制文案
                        await shareToDouyin(shareData);
                        toast.success("海报和文案已准备，快去抖音发布吧");
                        trackShare?.("douyin");
                        break;
                    }
                }
            } catch (error) {
                console.error(`${platform} 分享失败:`, error);
                toast.error("分享失败，请重试");
            }
        },
        [currentUrl, skinTypeLabel, score, onSavePoster, toast, trackShare]
    );

    const handleCopyLink = useCallback(async () => {
        try {
            await copyToClipboard(currentUrl);
            toast.success("链接已复制");
            trackShare?.("link");
        } catch {
            toast.error("复制失败，请手动复制链接");
        }
    }, [currentUrl, toast, trackShare]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 text-brand-charcoal">
                    {/* 背景遮罩 */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* 弹窗内容 */}
                    <m.div
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

                        {/* 顶部 Logo */}
                        <div className="relative z-10 flex flex-col items-center pt-8 pb-4 px-8">
                            <img
                                src="/images/NIHPLOD-logo.svg"
                                alt="Logo"
                                className="h-7 w-auto object-contain brightness-95 opacity-80 mb-4"
                            />
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-[#d4b483]/40 to-transparent" />
                        </div>

                        {/* 内容区 */}
                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch gap-8 md:gap-10 px-8 pb-8 lg:px-10 lg:pb-10">
                            {/* 左侧：文字和操作 */}
                            <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 min-w-0 justify-center order-2 md:order-1">
                                <h3 className="text-lg font-bold text-[#2d2a26] mb-1 tracking-tight">
                                    分享你的素颜证书
                                </h3>
                                <p className="text-xs text-[#8c7a6b] mb-4 leading-relaxed">
                                    让好友见证您的肌肤蜕变
                                </p>

                                {/* 社交平台 */}
                                <div className="mb-6 grid grid-cols-4 gap-3 w-full">
                                    <button
                                        onClick={() => handleShare("wechat")}
                                        className="flex flex-col items-center gap-2 group"
                                        title="分享到微信"
                                    >
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#07C160]/10 text-[#07C160] transition-colors group-hover:bg-[#07C160] group-hover:text-white">
                                            <MessageCircle className="h-5 w-5" />
                                        </div>
                                        <span className="text-[11px] text-brand-charcoal/60">微信</span>
                                    </button>
                                    <button
                                        onClick={() => handleShare("weibo")}
                                        className="flex flex-col items-center gap-2 group"
                                        title="分享到微博"
                                    >
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E6162D]/10 text-[#E6162D] transition-colors group-hover:bg-[#E6162D] group-hover:text-white">
                                            <Twitter className="h-5 w-5" />
                                        </div>
                                        <span className="text-[11px] text-brand-charcoal/60">微博</span>
                                    </button>
                                    <button
                                        onClick={() => handleShare("xiaohongshu")}
                                        className="flex flex-col items-center gap-2 group"
                                        title="分享到小红书"
                                    >
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF2442]/10 text-[#FF2442] transition-colors group-hover:bg-[#FF2442] group-hover:text-white">
                                            <XiaohongshuIcon className="h-5 w-5" />
                                        </div>
                                        <span className="text-[11px] text-brand-charcoal/60">小红书</span>
                                    </button>
                                    <button
                                        onClick={() => handleShare("douyin")}
                                        className="flex flex-col items-center gap-2 group"
                                        title="分享到抖音"
                                    >
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/5 text-black transition-colors group-hover:bg-black group-hover:text-white">
                                            <DouyinIcon className="h-5 w-5" />
                                        </div>
                                        <span className="text-[11px] text-brand-charcoal/60">抖音</span>
                                    </button>
                                </div>

                                <div className="w-full space-y-3">
                                    <button
                                        onClick={onSavePoster}
                                        disabled={isGeneratingPoster}
                                        className="relative w-full py-3.5 px-6 rounded-full shadow-[0_4px_12px_-2px_rgba(150,110,60,0.2)] border border-[#e6d0a8]/50 group transition-all disabled:opacity-60"
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
                                        onClick={handleCopyLink}
                                        className="w-full py-3 text-sm font-medium text-[#8c7a6b] hover:text-[#5c4937] transition-colors rounded-full border border-[#e6d0a8]/30 hover:bg-[#e6d0a8]/10"
                                    >
                                        复制链接
                                    </button>

                                    <button
                                        onClick={onClose}
                                        className="w-full py-2 text-sm font-medium text-[#c4b5a2] hover:text-[#8c7a6b] transition-colors"
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
                    </m.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
