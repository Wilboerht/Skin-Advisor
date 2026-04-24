"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ProductCard, ProductCardData } from "./ProductCard";
import { SkincareStep, SKINCARE_STEPS } from "@/lib/skincare-steps";
import { cn } from "@/lib/utils";

interface StepProductGroupProps {
    step: SkincareStep;
    products: ProductCardData[];
    index?: number;
    onProductClick?: (productId: string) => void;
    defaultExpanded?: boolean;
    maxVisible?: number;
}

export function StepProductGroup({
    step,
    products,
    index = 0,
    onProductClick,
    defaultExpanded = true,
    maxVisible = 4
}: StepProductGroupProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [showAll, setShowAll] = useState(false);

    const stepConfig = SKINCARE_STEPS[step];
    const visibleProducts = showAll ? products : products.slice(0, maxVisible);
    const hasMore = products.length > maxVisible;

    if (products.length === 0) return null;

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            className="space-y-4"
        >
            {/* 步骤标题栏 */}
            <div
                className="flex items-center justify-between px-1 cursor-pointer group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    {/* 步骤图标 */}
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-lg",
                        "bg-gradient-to-br from-white/20 to-white/10 border border-white/30",
                        "group-hover:from-white/30 group-hover:to-white/20 group-hover:border-white/40",
                        "transition-all duration-200"
                    )}>
                        {stepConfig.icon}
                    </div>

                    <div>
                        {/* 中文标题 */}
                        <h3 className="text-base font-semibold text-white drop-shadow-sm flex items-center gap-2">
                            第{index + 1}步: {stepConfig.label}
                            <span className="text-xs font-normal text-white/60">
                                ({products.length}款)
                            </span>
                        </h3>

                        {/* 英文标题 + 环境提示 */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-white/60">
                                {stepConfig.labelEn}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 展开/收起按钮 */}
                <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <ChevronDown
                        className={cn(
                            "w-5 h-5 text-white/60 transition-transform duration-200",
                            isExpanded && "rotate-180"
                        )}
                    />
                </button>
            </div>

            {/* 产品网格 */}
            <AnimatePresence>
                {isExpanded && (
                    <m.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {visibleProducts.map((product, idx) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    index={idx}
                                    onProductClick={onProductClick}
                                />
                            ))}
                        </div>

                        {/* 查看更多按钮 */}
                        {hasMore && !showAll && (
                            <div className="mt-4 text-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAll(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    查看更多 ({products.length - maxVisible}款)
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* 收起按钮 */}
                        {showAll && hasMore && (
                            <div className="mt-4 text-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAll(false);
                                    }}
                                    className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
                                >
                                    收起
                                    <ChevronDown className="w-4 h-4 rotate-180" />
                                </button>
                            </div>
                        )}
                    </m.div>
                )}
            </AnimatePresence>
        </m.div>
    );
}

export default StepProductGroup;
