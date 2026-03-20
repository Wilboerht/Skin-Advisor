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
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "group relative w-full rounded-2xl text-left transition-all duration-300 border px-6 py-5 flex items-center gap-5 backdrop-blur-md",
                isSelected
                    ? "bg-[#4A3728]/20 border-[#4A3728]/40 text-[#4A3728] shadow-xl shadow-[#4A3728]/5 scale-[1.02] ring-1 ring-[#4A3728]/5"
                    : "bg-white/85 border-white/60 text-[#1A1A1A] hover:border-white/80 hover:scale-[1.01] shadow-sm hover:shadow-md"
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
                    isSelected ? "text-[#4A3728]" : "text-[#1A1A1A]"
                )}>
                    {label}
                </p>
                {description && (
                    <p className={cn(
                        "text-xs font-light leading-relaxed",
                        isSelected ? "text-[#4A3728]/70" : "text-[#5E5E5E]"
                    )}>
                        {description}
                    </p>
                )}
            </div>

            {/* Checkmark - Only shows when selected, very minimal */}
            <div className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300",
                isSelected
                    ? "border-[#4A3728] bg-[#4A3728] text-white"
                    : "border-[#E5E5E5] group-hover:border-[#1A1A1A]/30"
            )}>
                {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
            </div>

        </m.button>
    );
}
