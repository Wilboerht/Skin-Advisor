"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import { Gift, AlertCircle, TrendingUp } from "lucide-react";
import { ProductRecommendationSkeleton } from "./ProductCardSkeleton";
import { ProductCard, ProductCardData } from "./ProductCard";
import { inferStepFromCategory } from "@/lib/skincare-steps";
import { cn } from "@/lib/utils";

// 维度名称映射
const DIMENSION_LABELS: Record<string, string> = {
    spots: "色斑",
    wrinkles: "皱纹",
    uvDamage: "光老化",
    sensitivity: "敏感度",
    acne: "痘痘",
    waterOil: "水油平衡",
    skinTone: "肤色均匀",
    firmness: "紧致度",
    radiance: "光泽度",
    darkCircles: "黑眼圈"
};

interface ProductRecommendationSectionProps {
    products: ProductCardData[];
    isLoading?: boolean;
    faceAnalysis?: {
        dimensions?: Record<string, { score: number }>;
    } | null;
    onAddToRoutine?: (productId: string) => void;
    onProductClick?: (productId: string) => void;
    className?: string;
}

export function ProductRecommendationSection({
    products,
    isLoading = false,
    faceAnalysis,
    onAddToRoutine,
    onProductClick,
    className
}: ProductRecommendationSectionProps) {
    const [processedProducts, setProcessedProducts] = useState<ProductCardData[]>([]);

    // 处理产品数据：添加步骤、匹配度、环境推荐、维度关联
    useEffect(() => {
        if (!products || products.length === 0) {
            setProcessedProducts([]);
            return;
        }

        const processed = products.map(product => {
            // 推断护肤步骤
            const step = (product as any).step || inferStepFromCategory(product.category);

            // 计算匹配度 (基于 score，如果有的话)
            const baseScore = product.score ?? 50;
            const matchScore = Math.min(99, Math.round((baseScore / 150) * 100));

            // 关联维度评分 (简单逻辑：根据类别关联维度)
            let dimensionLink: ProductCardData['dimensionLink'] = null;
            if (faceAnalysis?.dimensions) {
                const categoryToDimension: Record<string, string> = {
                    '精华': 'radiance',
                    '精华液': 'radiance',
                    '安瓶': 'radiance',
                    '面霜': 'waterOil',
                    '乳液': 'waterOil',
                    '防晒': 'uvDamage',
                    '防晒霜': 'uvDamage',
                    '洁面': 'waterOil',
                    '洁面乳': 'waterOil',
                    '眼霜': 'darkCircles',
                    '爽肤水': 'skinTone',
                    '化妆水': 'skinTone',
                    '面膜': 'sensitivity',
                    '护肤油': 'waterOil',
                };
                const dimKey = categoryToDimension[product.category];
                if (dimKey && faceAnalysis.dimensions[dimKey]) {
                    dimensionLink = {
                        dimension: DIMENSION_LABELS[dimKey] || dimKey,
                        score: faceAnalysis.dimensions[dimKey].score
                    };
                }
            }

            return {
                ...product,
                step,
                matchScore,
                dimensionLink
            } as ProductCardData;
        });

        // 按匹配度排序
        processed.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

        setProcessedProducts(processed);
    }, [products, faceAnalysis]);

    // 取匹配度最高的前3个产品
    const topProducts = processedProducts.slice(0, 3);

    // 完全没有产品时的空状态
    if (!isLoading && products.length === 0) {
        return (
            <div className={cn("rounded-[32px] backdrop-blur-xl border border-white/20 overflow-hidden", className)}
                style={{
                    background: 'linear-gradient(135deg, rgba(230, 215, 195, 0.4) 0%, rgba(200, 180, 155, 0.3) 100%)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
            >
                {/* 标题 */}
                <div className="px-6 py-4 border-b border-white/20 flex items-center gap-3">
                    <Gift className="w-5 h-5 text-white drop-shadow-sm" />
                    <span className="text-lg font-semibold text-white drop-shadow-sm">甄选产品推荐</span>
                </div>

                {/* 空状态 */}
                <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-white/60" />
                    </div>
                    <h4 className="text-base font-medium text-white drop-shadow-sm mb-2">暂无产品推荐</h4>
                    <p className="text-sm text-white/70">
                        系统正在为您匹配最适合的护肤产品，请稍后再查看。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-[32px] backdrop-blur-xl border border-white/20 overflow-hidden", className)}
            style={{
                background: 'linear-gradient(135deg, rgba(230, 215, 195, 0.4) 0%, rgba(200, 180, 155, 0.3) 100%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
        >
            {/* 标题栏 */}
            <div className="px-6 py-4 border-b border-white/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Gift className="w-5 h-5 text-white drop-shadow-sm" />
                        <span className="text-lg font-semibold text-white drop-shadow-sm">甄选产品推荐</span>
                        <span className="text-xs text-white/60 font-normal">
                            为您精选
                        </span>
                    </div>

                    {/* 统计信息 */}
                    <div className="flex items-center gap-4 text-xs text-white/70">
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {products.length} 款产品
                        </span>
                    </div>
                </div>
            </div>

            {/* 内容区域 */}
            <div className="p-6">
                {isLoading ? (
                    <ProductRecommendationSkeleton />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                onAddToRoutine={onAddToRoutine}
                                onProductClick={onProductClick}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 底部说明 */}
            <div className="px-6 py-4 bg-white/10 border-t border-white/20">
                <p className="text-xs text-white/70 text-center">
                    💡 产品推荐基于您的肤质分析和当前环境数据，仅供参考
                </p>
            </div>
        </div>
    );
}

export default ProductRecommendationSection;
