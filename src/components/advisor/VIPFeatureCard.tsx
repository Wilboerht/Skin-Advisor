"use client";

import { useRef } from "react";
import { motion as m } from "framer-motion";
import { Lock, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface VIPFeatureCardProps {
    userImage?: string;
    className?: string;
    onUnlock?: () => void;
}

export function VIPFeatureCard({ userImage, className, onUnlock }: VIPFeatureCardProps) {
    const router = useRouter();

    const handleUnlock = () => {
        if (onUnlock) {
            onUnlock();
            return;
        }
        // Default action: Show toast or redirect
        alert("VIP 升级功能即将上线\n敬请期待更多高级分析功能！");
        // router.push("/pricing"); // Future
    };

    return (
        <div className={cn("relative w-full h-full overflow-hidden rounded-2xl group cursor-pointer", className)} onClick={handleUnlock}>
            {/* 1. Base Image with Blur (Simulate "Hidden" Content) */}
            <div className="absolute inset-0 bg-gray-100">
                {userImage && (
                    <img
                        src={userImage}
                        alt="User Face"
                        className="w-full h-full object-cover opacity-80 blur-xl scale-110 transition-transform duration-700 group-hover:scale-105"
                    />
                )}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            </div>

            {/* 2. Content Container */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">

                {/* Icon Wrapper with Glow */}
                <m.div
                    initial={{ scale: 0.9, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        repeat: Infinity,
                        repeatType: "reverse",
                        repeatDelay: 3
                    }}
                    className="relative mb-6"
                >
                    <div className="absolute inset-0 bg-amber-400/30 blur-2xl rounded-full" />
                    <div className="relative w-16 h-16 bg-gradient-to-b from-amber-100 to-amber-300 rounded-2xl flex items-center justify-center shadow-lg border border-amber-200/50">
                        <Lock className="w-8 h-8 text-amber-900" />
                        <div className="absolute -top-2 -right-2">
                            <Crown className="w-6 h-6 text-yellow-400 drop-shadow-md fill-yellow-400" />
                        </div>
                    </div>
                </m.div>

                {/* Text Content */}
                <div className="space-y-2 mb-6 max-w-[280px]">
                    <h3 className="text-xl font-bold text-white tracking-tight drop-shadow-md">
                        解锁 AI 深度透视
                    </h3>
                    <p className="text-sm text-white/80 font-medium leading-relaxed drop-shadow">
                        查看 6 大核心区域的深层热力图分析<br />
                        精准定位油光、皱纹与色斑根源
                    </p>
                </div>

                {/* CTA Button */}
                <button
                    className="group/btn relative px-6 py-2.5 bg-gradient-to-r from-amber-200 to-yellow-400 rounded-full font-semibold text-amber-950 text-sm shadow-[0_4px_14px_rgba(251,191,36,0.4)] hover:shadow-[0_6px_20px_rgba(251,191,36,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>升级 VIP 权益</span>
                </button>

                {/* Tag */}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <span className="text-[10px] font-bold text-amber-300 tracking-wide uppercase">PRO Feature</span>
                </div>
            </div>

            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-20 pointer-events-none" />
        </div>
    );
}
