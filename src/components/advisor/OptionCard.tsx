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
    role?: "radio" | "checkbox";
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
    role = "radio",
}: OptionCardProps) {
    return (
        <m.button
            type="button"
            onClick={onClick}
            role={role}
            aria-checked={isSelected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: index * 0.05,
                ease: [0.2, 0.8, 0.2, 1], // Power easing
            }}
            whileHover={{ 
                // Subtle hover: no lift, only color/shadow transition handled by Tailwind
                transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } 
            }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "group relative w-full rounded-lg md:rounded-xl text-left border px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5 flex items-center gap-3 sm:gap-4 backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-300 overflow-hidden touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B7355]/50 focus-visible:ring-offset-1",
                isSelected
                    ? "bg-[#F8F5EE] border-[#8B7355] shadow-[0_8px_30px_-8px_rgba(139,115,85,0.18)] ring-1 ring-[#8B7355]/10"
                    : "bg-transparent border-[#D4CFC5]/50 hover:border-[#8B7355]/30 hover:bg-[#F8F5EE]/30"
            )}
        >
            {/* Left accent bar - gradient, rounded, only visible when selected */}
            <div className={cn(
                "absolute left-0 top-4 bottom-4 sm:top-5 sm:bottom-5 md:top-6 md:bottom-6 w-[2px] md:w-[3px] rounded-r-full transition-all duration-300",
                isSelected
                    ? "bg-gradient-to-b from-[#8B7355] via-[#A68B6A] to-[#8B7355] opacity-100"
                    : "bg-transparent opacity-0"
            )} />
            <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none rounded-lg" />
            {/* Emoji - Simplified */}
            {emoji && (
                <div className={cn(
                    "text-2xl transition-all duration-300",
                    isSelected ? "opacity-100 scale-105" : "opacity-70 group-hover:opacity-100"
                )}>
                    {emoji}
                </div>
            )}

            {/* Text Content */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-[15px] md:text-base tracking-[0.06em] mb-0.5 md:mb-1 transition-colors duration-300",
                    isSelected ? "text-brand-charcoal font-semibold" : "text-brand-charcoal/70 font-medium"
                )}>
                    {label}
                </p>
                {description && (
                    <p className={cn(
                        "text-xs md:text-sm leading-relaxed transition-colors duration-300",
                        isSelected ? "text-brand-charcoal/70 font-normal" : "text-brand-charcoal/60 font-light"
                    )}>
                        {description}
                    </p>
                )}
            </div>

            {/* Checkmark - Rounded, elevated when selected */}
            <m.div
                className={cn(
                    "w-5 h-5 md:w-6 md:h-6 rounded-full border flex items-center justify-center transition-all duration-300",
                    isSelected
                        ? "border-[#8B7355] bg-[#8B7355] text-white shadow-[0_2px_8px_rgba(139,115,85,0.3)]"
                        : "border-[#D4CFC5] group-hover:border-[#8B7355]/40"
                )}
                animate={isSelected ? { scale: [1, 0.85, 1.1, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                {isSelected && (
                    <m.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, ease: "easeOut", delay: 0.1 }}
                    >
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </m.div>
                )}
            </m.div>

        </m.button>
    );
}
