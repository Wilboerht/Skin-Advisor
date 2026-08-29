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
    const { user } = useAuth();
    const { openAuthModal } = useAuthModal();
    const [dismissed, setDismissed] = useState(false);

    if (user) return null;

    return (
        <AnimatePresence>
            {!dismissed && (
                <m.div
                    initial={{ opacity: 0, y: -24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -24 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    className={`w-full bg-[var(--color-brand-cream)] border-b border-brand-espresso/10 ${className}`}
                >
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
                        <div className="flex items-center justify-center gap-2 sm:gap-3 text-[12px] sm:text-[13px] text-[var(--color-brand-cocoa)]">
                            <Image
                                src="/images/watermark.png"
                                alt=""
                                width={16}
                                height={16}
                                className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-90 drop-shadow-[0_1px_1px_rgba(61,68,48,0.4)]"
                                unoptimized
                            />
                            <span>
                                注册成为旎柏会员，保存你的专属分析报告，持续追踪肌肤状态，开启更多私享服务。
                            </span>
                            <button
                                onClick={() => openAuthModal("register")}
                                className="font-medium underline underline-offset-2 hover:text-[var(--color-brand-charcoal)] transition-colors"
                            >
                                立即注册
                            </button>
                            <button
                                onClick={() => setDismissed(true)}
                                className="ml-1 text-[#a89582] hover:text-[var(--color-brand-cocoa)] transition-colors"
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
