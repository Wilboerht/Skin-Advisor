"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/image";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useAuth } from "@/hooks/useAuth";

interface SaveReportBannerProps {
    className?: string;
}

export function SaveReportBanner({ className = "" }: SaveReportBannerProps) {
    const { user, loading } = useAuth();
    const { openAuthModal } = useAuthModal();
    const [dismissed, setDismissed] = useState(false);

    // Don't show if logged in or loading
    if (loading || user) return null;

    return (
        <AnimatePresence>
            {!dismissed && (
                <m.div
                    initial={{ opacity: 0, y: -24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -24 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    className={`w-full bg-[#F5F2ED] border-b border-[#3d2f25]/10 ${className}`}
                >
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
                        <div className="flex items-center justify-center gap-2 sm:gap-3 text-[12px] sm:text-[13px] text-[#5c4937]">
                            <Image
                                src="/images/watermark.png"
                                alt=""
                                width={16}
                                height={16}
                                className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-90 drop-shadow-[0_1px_1px_rgba(61,68,48,0.4)]"
                                unoptimized
                            />
                            <span>
                                成为旎柏注册会员，保存分析报告，追踪肤质变化
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
