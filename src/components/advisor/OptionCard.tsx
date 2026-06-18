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
                "group relative w-full rounded-lg md:rounded-xl text-left border px-4 sm:px-6 md:px-8 py-3 sm:py-5 md:py-6 flex items-center gap-3 sm:gap-5 backdrop-blur-md transition-all duration-300 overflow-hidden",
                isSelected
                    ? "bg-[#F8F5EE] border-[#1B3A5C]/40 shadow-[0_2px_12px_-2px_rgba(27, 58, 92, 0.08)]"
                    : "bg-[#FDFBF7] border-[#D4CFC5] hover:border-[#1B3A5C]/40 hover:bg-[#F8F5EE] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]"
            )}
        >
            {/* Left accent bar */}
            <div className={cn(
                "absolute left-0 top-3 bottom-3 sm:top-4 sm:bottom-4 md:top-5 md:bottom-5 w-[2px] md:w-[3px] transition-all duration-300",
                isSelected ? "bg-[#1B3A5C]" : "bg-transparent"
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
                    "text-[15px] md:text-base tracking-wide mb-0.5 md:mb-1 transition-colors duration-300",
                    isSelected ? "text-[#1A1A1A] font-semibold" : "text-[#1B3A5C] font-medium"
                )}>
                    {label}
                </p>
                {description && (
                    <p className={cn(
                        "text-xs md:text-sm font-light leading-relaxed transition-colors duration-300",
                        isSelected ? "text-[#1B3A5C]/80" : "text-[#5E5E5E]/80"
                    )}>
                        {description}
                    </p>
                )}
            </div>

            {/* Checkmark - Only shows when selected, very minimal */}
            <m.div
                className={cn(
                    "w-5 h-5 md:w-6 md:h-6 rounded-sm border flex items-center justify-center transition-all duration-300",
                    isSelected
                        ? "border-[#1B3A5C] bg-[#1B3A5C] text-white"
                        : "border-[#D4CFC5] group-hover:border-[#1B3A5C]/40"
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
