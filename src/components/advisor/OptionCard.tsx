"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionCardProps {
    value: string;
    label: string;
    description?: string;
    emoji?: string;
    isSelected: boolean;
    onClick: () => void;
    index: number;
}

/**
 * 问题选项卡片组件 - NIHPLOD 高奢品牌风格
 * 毛玻璃效果、金色边框、优雅动画
 */
export function OptionCard({
    label,
    description,
    emoji,
    isSelected,
    onClick,
    index,
}: OptionCardProps) {
    return (
        <m.button
            type="button"
            onClick={onClick}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: index * 0.05,
                ease: [0.2, 0.8, 0.2, 1], // Power easing
            }}
            whileHover={{ 
                y: -6, 
                // Removed scale to prevent text blurring, using purely translation and shadow for elevation
                transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } 
            }}
            whileTap={{ scale: 0.98 }}
            style={{ 
                // CRITICAL: Forces the element into its own compositor layer from the start
                transform: "translateZ(0)",
                backfaceVisibility: "hidden", 
                WebkitBackfaceVisibility: "hidden",
                perspective: "1000px"
            }}
            className={cn(
                "group relative w-full rounded-lg text-left border px-4 sm:px-6 py-3 sm:py-5 flex items-center gap-3 sm:gap-5 backdrop-blur-md transition-all duration-300 overflow-hidden",
                isSelected
                    ? "bg-[#F8F5EE] border-[#8B7355]/40 shadow-[0_2px_12px_-2px_rgba(139,115,85,0.08)]"
                    : "bg-white/50 border-[#D4CFC5]/70 hover:border-[#8B7355]/30 hover:bg-[#F5F2EA]/60 shadow-sm hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.03)]"
            )}
        >
            {/* Left accent bar */}
            <div className={cn(
                "absolute left-0 top-3 bottom-3 sm:top-4 sm:bottom-4 w-[2px] transition-all duration-300",
                isSelected ? "bg-[#8B7355]" : "bg-transparent"
            )} />
            <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none rounded-lg" />
            {/* Emoji - Simplified */}
            {emoji && (
                <div className={cn(
                    "text-2xl transition-opacity duration-300",
                    isSelected ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                )}>
                    {emoji}
                </div>
            )}

            {/* Text Content */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-[15px] tracking-wide mb-0.5 transition-colors duration-300",
                    isSelected ? "text-[#1A1A1A] font-semibold" : "text-[#3D4430]/85 font-medium"
                )}>
                    {label}
                </p>
                {description && (
                    <p className={cn(
                        "text-xs font-light leading-relaxed transition-colors duration-300",
                        isSelected ? "text-[#8B7355]/80" : "text-[#5E5E5E]/60"
                    )}>
                        {description}
                    </p>
                )}
            </div>

            {/* Checkmark - Only shows when selected, very minimal */}
            <m.div
                className={cn(
                    "w-5 h-5 rounded-sm border flex items-center justify-center transition-all duration-300",
                    isSelected
                        ? "border-[#8B7355] bg-[#8B7355] text-white"
                        : "border-[#D4CFC5]/60 group-hover:border-[#8B7355]/30"
                )}
                animate={isSelected ? { scale: [1, 0.8, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                {isSelected && (
                    <m.svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <m.polyline
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.2, ease: "easeOut", delay: 0.1 }}
                            points="4 12 9 17 20 6"
                        />
                    </m.svg>
                )}
            </m.div>

        </m.button>
    );
}
