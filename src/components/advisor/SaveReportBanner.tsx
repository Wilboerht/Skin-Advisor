"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useAuth } from "@/hooks/useAuth";

interface SaveReportBannerProps {
    className?: string;
}

export function SaveReportBanner({ className = "" }: SaveReportBannerProps) {
    const { user, loading } = useAuth();
    const { openAuthModal } = useAuthModal();
    const [dismissed, setDismissed] = useState(false);

    // Don't show if logged in, loading, or dismissed
    if (loading || user || dismissed) return null;

    return (
        <AnimatePresence>
            {!dismissed && (
                <m.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className={`w-full bg-[#F5F2ED] border-b border-[#3d2f25]/10 ${className}`}
                >
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
                        <div className="flex items-center justify-center gap-3 text-[12px] sm:text-[13px] text-[#5c4937]">
                            <span>
                                保存分析报告，注册后可追踪肤质变化
                            </span>
                            <button
                                onClick={() => openAuthModal("register")}
                                className="font-medium underline underline-offset-2 hover:text-[#00263e] transition-colors"
                            >
                                立即注册
                            </button>
                            <button
                                onClick={() => setDismissed(true)}
                                className="ml-1 text-[#a89582] hover:text-[#5c4937] transition-colors"
                                aria-label="关闭"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
