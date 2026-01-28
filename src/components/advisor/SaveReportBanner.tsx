"use client";

import { useState, useEffect } from "react";
import { Link } from "next-view-transitions";
import { m, AnimatePresence } from "framer-motion";
import { BookmarkPlus, X, User, ArrowRight } from "lucide-react";
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md ${className}`}
                >
                    <div className="relative bg-white/95 backdrop-blur-lg rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/5 p-5 pr-12">
                        {/* Close Button */}
                        <button
                            onClick={() => setDismissed(true)}
                            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1A1A1A] to-[#3D4430] flex items-center justify-center shrink-0">
                                <BookmarkPlus className="w-5 h-5 text-white" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[15px] font-semibold text-gray-900 mb-1">
                                    保存您的专属报告
                                </h4>
                                <p className="text-sm text-gray-500 leading-relaxed mb-3">
                                    创建账户后可随时查看历史报告、追踪肤质变化
                                </p>

                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/register?from=result"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-lg hover:bg-[#3D4430] transition-colors"
                                    >
                                        <User className="w-3.5 h-3.5" />
                                        <span>免费注册</span>
                                    </Link>
                                    <Link
                                        href="/login?from=result"
                                        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        <span>已有账户</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Subtle gradient accent */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1A1A1A] via-[#3D4430] to-[#C4A86E] rounded-b-2xl opacity-80" />
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
