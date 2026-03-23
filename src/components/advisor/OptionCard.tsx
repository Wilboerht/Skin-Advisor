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
                "group relative w-full rounded-2xl text-left border px-6 py-5 flex items-center gap-5 backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-300",
                isSelected
                    ? "bg-[#FDFBF7]/85 border-[#8B7355] text-[#1A1A1A] shadow-[0_20px_40px_-15px_rgba(139,115,85,0.2)] ring-1 ring-[#8B7355]/10"
                    : "bg-[#F0EDE1]/55 border-white/60 text-[#1A1A1A] hover:border-[#8B7355]/40 shadow-sm hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.05)]"
            )}
        >
            <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
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
                    "text-base font-semibold tracking-wide mb-0.5",
                    "text-[#1A1A1A]"
                )}>
                    {label}
                </p>
                {description && (
                    <p className={cn(
                        "text-xs font-light leading-relaxed",
                        isSelected ? "text-[#1A1A1A]/70" : "text-[#5E5E5E]"
                    )}>
                        {description}
                    </p>
                )}
            </div>

            {/* Checkmark - Only shows when selected, very minimal */}
            <div className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300",
                isSelected
                    ? "border-[#8B7355] bg-[#8B7355] text-white"
                    : "border-[#E5E5E5] group-hover:border-[#1A1A1A]/30"
            )}>
                {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
            </div>

        </m.button>
    );
}
