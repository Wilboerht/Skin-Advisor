"use client";

import { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Share2, X, Link as LinkIcon, Download, MessageCircle, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

// 定义图标组件类型
export const ShareIcons = {
    Wechat: MessageCircle, // 使用 MessageCircle 代替 Wechat
    Weibo: Twitter, // 使用 Twitter 代替 Weibo (Lucide 没有微博图标)
    Xiaohongshu: ({ className }: { className?: string }) => (
        <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" height="1em" width="1em">
            <path d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm0 853.3c-188.5 0-341.3-152.8-341.3-341.3S323.5 170.7 512 170.7s341.3 152.8 341.3 341.3-152.8 341.3-341.3 341.3z" />
            <path d="M512 256c-141.4 0-256 114.6-256 256s114.6 256 256 256 256-114.6 256-256-114.6-256-256-256zm0 426.7c-94.1 0-170.7-76.6-170.7-170.7S417.9 341.3 512 341.3s170.7 76.6 170.7 170.7S606.1 682.7 512 682.7z" />
        </svg>
    ), // 简单的 SVG 替代
    Douyin: ({ className }: { className?: string }) => (
        <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" height="1em" width="1em">
            <path d="M858.7 506.7V170.7h-128v293.3c0 70.4-57.6 128-128 128s-128-57.6-128-128 57.6-128 128-128V42.7c-141.1 0-256 114.9-256 256s114.9 256 256 256c19.2 0 37.8-2.1 55.5-6.1L453.3 853.3h133.3l5.3-298.7h117.3c21.3 0 42.7-5.3 64-16v-85.3c-37.3 16-77.9 24-120 24s-81.6-11.7-114.7-31.5z" />
        </svg>
    ),
    Copy: LinkIcon,
    Download: Download,
};

export interface ShareOption {
    key: string;
    label: string;
    icon: any;
    bgColor: string;
    onClick: () => void;
}

interface ShareFloatingButtonProps {
    options: ShareOption[];
    onSaveImage?: () => void;
    copied?: boolean; // 是否处于已复制状态
}

export function ShareFloatingButton({ options, copied = false }: ShareFloatingButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed bottom-8 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-12 sm:right-8"
        >
            {/* 展开的选项 */}
            <AnimatePresence>
                {isOpen && (
                    <div className="flex flex-col items-end gap-3 mb-2">
                        {options.map((option, index) => (
                            <m.button
                                key={option.key}
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                transition={{ delay: index * 0.05, duration: 0.2 }}
                                onClick={() => {
                                    option.onClick();
                                    // 不自动关闭，让用户感知操作，或者根据需求关闭
                                    // setIsOpen(false); 
                                }}
                                className={`group flex items-center gap-3 rounded-full px-4 py-2.5 shadow-lg backdrop-blur-md transition-transform hover:scale-105 ${option.bgColor}`}
                            >
                                <span className="text-sm font-medium">{option.label}</span>
                                <option.icon className="h-4 w-4" />
                            </m.button>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* 主按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-luxury transition-all duration-300 hover:scale-110 active:scale-95 sm:h-14 sm:w-14",
                    isOpen ? "bg-brand-charcoal rotate-45" : copied ? "bg-green-500" : "bg-brand-gold"
                )}
                aria-label="分享"
            >
                {isOpen ? (
                    <X className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                    <Share2 className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
            </button>
        </div>
    );
}
