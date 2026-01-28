"use client";

import { useState, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Info, Beaker, Sparkles, Target } from "lucide-react";

export interface IngredientDetail {
    name: string;
    effect: string;
    concentration?: string;
}

interface IngredientTooltipProps {
    ingredients: string[] | IngredientDetail[];
    benefits?: string[];
    howToUse?: string;
    children: React.ReactNode;
    position?: "top" | "bottom" | "left" | "right";
}

export function IngredientTooltip({
    ingredients,
    benefits,
    howToUse,
    children,
    position = "top"
}: IngredientTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const showTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(true);
    };

    const hideTooltip = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 150);
    };

    // 解析成分数据
    const parsedIngredients: IngredientDetail[] = ingredients.map(ing => {
        if (typeof ing === 'string') {
            return { name: ing, effect: '' };
        }
        return ing;
    });

    const positionClasses = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2"
    };

    const arrowClasses = {
        top: "top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent",
        bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent",
        left: "left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent",
        right: "right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent"
    };

    return (
        <div
            ref={containerRef}
            className="relative inline-block"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onTouchStart={showTooltip}
            onTouchEnd={hideTooltip}
        >
            {children}

            <AnimatePresence>
                {isVisible && (
                    <m.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-50 ${positionClasses[position]}`}
                        onMouseEnter={showTooltip}
                        onMouseLeave={hideTooltip}
                    >
                        {/* 主内容卡片 */}
                        <div className="w-72 p-4 bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-xl text-white">

                            {/* 核心成分 */}
                            {parsedIngredients.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                        <Beaker className="w-3 h-3" />
                                        核心成分
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {parsedIngredients.slice(0, 5).map((ing, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/90"
                                                title={ing.effect || undefined}
                                            >
                                                {ing.name}
                                                {ing.concentration && (
                                                    <span className="ml-1 text-[10px] text-white/60">
                                                        {ing.concentration}
                                                    </span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 主要功效 */}
                            {benefits && benefits.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                        <Sparkles className="w-3 h-3" />
                                        主要功效
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {benefits.slice(0, 4).map((benefit, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300"
                                            >
                                                {benefit}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 使用方法 */}
                            {howToUse && (
                                <div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                        <Target className="w-3 h-3" />
                                        使用方法
                                    </div>
                                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">
                                        {howToUse}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 箭头 */}
                        <div
                            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
                        />
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * 简单的成分标签（用于卡片内展示）
 */
interface IngredientTagsProps {
    ingredients: string[];
    maxShow?: number;
    size?: "sm" | "md";
}

export function IngredientTags({
    ingredients,
    maxShow = 3,
    size = "sm"
}: IngredientTagsProps) {
    const shown = ingredients.slice(0, maxShow);
    const remaining = ingredients.length - maxShow;

    const sizeClasses = {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2 py-0.5 text-xs"
    };

    return (
        <div className="flex flex-wrap gap-1">
            {shown.map((ing, idx) => (
                <span
                    key={idx}
                    className={`inline-flex items-center rounded bg-blue-50 text-blue-600 font-medium ${sizeClasses[size]}`}
                >
                    {ing}
                </span>
            ))}
            {remaining > 0 && (
                <span className={`inline-flex items-center rounded bg-gray-100 text-gray-500 ${sizeClasses[size]}`}>
                    +{remaining}
                </span>
            )}
        </div>
    );
}

export default IngredientTooltip;
