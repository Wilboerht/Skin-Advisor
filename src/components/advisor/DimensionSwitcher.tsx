"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DimensionKey } from "@/lib/face-zones";

interface DimensionSwitcherProps {
    activeDimension: DimensionKey;
    onChange: (dim: DimensionKey) => void;
    className?: string;
}

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
    { key: "overall", label: "综合" },
    { key: "oil", label: "油光" },
    { key: "pores", label: "毛孔" },
    { key: "wrinkles", label: "皱纹" },
    { key: "spots", label: "色斑" },
    { key: "acne", label: "痘痘" },
    { key: "darkCircles", label: "黑眼圈" },
];

export function DimensionSwitcher({
    activeDimension,
    onChange,
    className
}: DimensionSwitcherProps) {
    return (
        <div role="tablist" aria-label="分析维度切换" className={cn("flex flex-wrap items-center gap-2 p-1", className)}>
            {DIMENSIONS.map((dim) => {
                const isActive = activeDimension === dim.key;
                return (
                    <button
                        key={dim.key}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(dim.key)}
                        className={cn(
                            "relative px-3 py-1.5 text-xs font-medium transition-all duration-300 rounded-full select-none outline-none",
                            isActive
                                ? "text-white shadow-sm"
                                : "text-brand-charcoal/60 hover:bg-brand-gray/50 hover:text-brand-charcoal"
                        )}
                    >
                        {isActive && (
                            <m.div
                                layoutId="activeDimension"
                                className="absolute inset-0 bg-brand-charcoal rounded-full"
                                initial={false}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">{dim.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
