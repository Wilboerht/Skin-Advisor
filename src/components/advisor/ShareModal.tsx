"use client";

/**
 * 分享弹窗组件
 * 包含社交平台分享按钮、保存图片
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import { X, Download, Share2, Check } from "lucide-react";
import { ShareCard } from "./ShareCard";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import html2canvas from "html2canvas";
import { ShareIcons } from "@/components/ui/ShareFloatingButton";
import { useToast } from "@/components/ui/Toast";
import { copyToClipboard } from "@/lib/share";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    isMobile: boolean;
    skinType: string;
    skinTypeLabel: string;
    concerns: string[];
    skinAge?: number;
    summary: string;
    faceAnalysis?: FaceAnalysisResult | null;
    userImage?: string | null;
}

export function ShareModal({
    isOpen,
    onClose,
    isMobile,
    skinType,
    skinTypeLabel,
    concerns,
    skinAge,
    summary,
    faceAnalysis,
    userImage,
}: ShareModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [generating, setGenerating] = useState(false);
    const toast = useToast();

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // 生成并下载图片
    const handleSaveImage = useCallback(async () => {
        if (!cardRef.current || generating) return;

        try {
            setGenerating(true);
            toast.info("正在生成分享图片...");

            // 临时显示卡片用于截图（如果在隐藏区域）
            // 这里的逻辑是 ShareCard 已经在 Modal 中渲染了，所以直接截取

            // 等待图片加载
            const images = Array.from(cardRef.current.getElementsByTagName("img"));
            await Promise.all(
                images.map(
                    (img) =>
                        new Promise((resolve) => {
                            if (img.complete) resolve(true);
                            else {
                                img.onload = () => resolve(true);
                                img.onerror = () => resolve(true);
                            }
                        })
                )
            );

            // 使用 html2canvas 截图
            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                scale: 2, // 高清
                backgroundColor: "#F0EDE1", // 确保背景色
                logging: false,
            });

            // 转换为图片并下载
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = `NIHPLOD-Skin-Advisor-${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();

            toast.success("图片已保存至相册");
        } catch (error) {
            console.error("生成图片失败:", error);
            toast.error("生成图片失败，请重试");
        } finally {
            setGenerating(false);
        }
    }, [generating, toast]);

    const handleShare = (platform: string) => {
        // 模拟分享
        toast.success(`已分享到 ${platform}`);
    }

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
                        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#F0EDE1] shadow-2xl md:flex-row"
                    >
                        {/* 关闭按钮 */}
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10 md:right-6 md:top-6"
                        >
                            <X className="h-5 w-5 opacity-60" />
                        </button>

                        {/* 左侧：分享卡片预览 */}
                        <div className="flex-1 overflow-y-auto bg-[#E6E2D6] p-4 md:p-8 flex items-center justify-center">
                            <div className="relative w-full max-w-[375px] shadow-2xl rounded-xl overflow-hidden">
                                <div ref={cardRef}>
                                    <ShareCard
                                        skinType={skinType}
                                        skinTypeLabel={skinTypeLabel}
                                        concerns={concerns}
                                        skinAge={skinAge}
                                        summary={summary}
                                        faceAnalysis={faceAnalysis}
                                        userImage={userImage}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 右侧：操作区域 */}
                        <div className="flex w-full flex-col bg-white p-6 md:w-[320px] md:p-8">
                            <div className="mb-6">
                                <h3 className="mb-2 font-serif text-2xl text-brand-charcoal">分享您的<br />肌肤报告</h3>
                                <p className="text-sm text-brand-charcoal/60">
                                    邀请好友体验 AI 测肤，即刻领取专属护肤好礼。
                                </p>
                            </div>

                            {/* 社交平台 */}
                            <div className="mb-8 grid grid-cols-4 gap-4 md:grid-cols-4">
                                <button
                                    onClick={() => handleShare("微信")}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#07C160]/10 text-[#07C160] transition-colors group-hover:bg-[#07C160] group-hover:text-white">
                                        <ShareIcons.Wechat className="h-6 w-6" />
                                    </div>
                                    <span className="text-xs text-brand-charcoal/60">微信</span>
                                </button>
                                <button
                                    onClick={() => handleShare("微博")}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E6162D]/10 text-[#E6162D] transition-colors group-hover:bg-[#E6162D] group-hover:text-white">
                                        <ShareIcons.Weibo className="h-6 w-6" />
                                    </div>
                                    <span className="text-xs text-brand-charcoal/60">微博</span>
                                </button>
                                <button
                                    onClick={() => handleShare("小红书")}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2442]/10 text-[#FF2442] transition-colors group-hover:bg-[#FF2442] group-hover:text-white">
                                        <ShareIcons.Xiaohongshu className="h-6 w-6" />
                                    </div>
                                    <span className="text-xs text-brand-charcoal/60">小红书</span>
                                </button>
                                <button
                                    onClick={() => handleShare("抖音")}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 text-black transition-colors group-hover:bg-black group-hover:text-white">
                                        <ShareIcons.Douyin className="h-6 w-6" />
                                    </div>
                                    <span className="text-xs text-brand-charcoal/60">抖音</span>
                                </button>
                            </div>

                            {/* 主要动作按钮 */}
                            <div className="mt-auto space-y-3">
                                <button
                                    onClick={handleSaveImage}
                                    disabled={generating}
                                    className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-charcoal py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95 disabled:opacity-70"
                                >
                                    {generating ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            正在生成...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4" />
                                            保存图片
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        copyToClipboard(window.location.href);
                                        toast.success("链接已复制");
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-charcoal/10 bg-white py-3 text-sm font-medium text-brand-charcoal transition-colors hover:bg-brand-charcoal/5 active:scale-95"
                                >
                                    <ShareIcons.Copy className="h-4 w-4" />
                                    复制链接
                                </button>
                            </div>
                        </div>
                    </m.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
