"use client";

import { useState, useEffect } from "react";
import { Link } from "next-view-transitions";
import { m, AnimatePresence } from "framer-motion";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SaveReportBannerProps {
    className?: string;
}

export function SaveReportBanner({ className = "" }: SaveReportBannerProps) {
    const { user, loading } = useAuth();
    const [dismissed, setDismissed] = useState(false);
    const [showBanner, setShowBanner] = useState(false);

    // Show banner after a delay for better UX
    useEffect(() => {
        if (!loading && !user) {
            const timer = setTimeout(() => setShowBanner(true), 3000);
            return () => clearTimeout(timer);
        }
    }, [user, loading]);

    // Don't show if logged in, loading, or dismissed
    if (loading || user || dismissed) return null;

    return (
        <AnimatePresence>
            {showBanner && (
                <m.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-lg ${className}`}
                >
                    <div className="relative bg-white rounded-xl border border-[#E9E9E7] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
                        {/* Main Content */}
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                            {/* Left: Icon + Text */}
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-[#F7F6F3] flex items-center justify-center shrink-0">
                                    <Sparkles className="w-[18px] h-[18px] text-[#37352F]" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-[14px] font-medium text-[#37352F] leading-snug">
                                        保存分析报告
                                    </h4>
                                    <p className="text-[13px] text-[#787774] leading-snug mt-0.5 truncate">
                                        注册后可追踪肤质变化
                                    </p>
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    href="/register?from=result"
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#37352F] text-white text-[13px] font-medium rounded-lg hover:bg-[#2F2F2F] transition-colors"
                                >
                                    <span>免费注册</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                                <button
                                    onClick={() => setDismissed(true)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#B4B4B4] hover:text-[#787774] hover:bg-[#F7F6F3] transition-colors"
                                    aria-label="关闭"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Subtle top accent line */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E9E9E7] via-[#D4B78F] to-[#E9E9E7] opacity-60" />
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}

