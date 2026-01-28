"use client";

import { useState, useEffect, useMemo } from "react";
import { m } from "framer-motion";
import { Gift, AlertCircle, TrendingUp, Zap } from "lucide-react";
import { StepProductGroup } from "./StepProductGroup";
import { ProductRecommendationSkeleton } from "./ProductCardSkeleton";
import { ProductCardData } from "./ProductCard";
import {
    SkincareStep,
    STEP_ORDER,
    groupProductsByStep,
    inferStepFromCategory,
    SKINCARE_STEPS
} from "@/lib/skincare-steps";
import {
    EnvironmentData,
    calculateEnvironmentBonus,
    getTopPriorityStep,
    getCurrentSeason
} from "@/lib/env-recommendation";
import { cn } from "@/lib/utils";

// 维度名称映射
const DIMENSION_LABELS: Record<string, string> = {
    spots: "色斑",
    wrinkles: "皱纹",
    pores: "毛孔",
    uvDamage: "光老化",
    sensitivity: "敏感度",
    acne: "痘痘",
    waterOil: "水油平衡",
    skinTone: "肤色均匀",
    firmness: "紧致度",
    radiance: "光泽度",
    darkCircles: "黑眼圈",
    skinTypeScore: "屏障稳定"
};

interface ProductRecommendationSectionProps {
    products: ProductCardData[];
    isLoading?: boolean;
    envData?: EnvironmentData | null;
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
    envData,
    faceAnalysis,
    onAddToRoutine,
    onProductClick,
    className
}: ProductRecommendationSectionProps) {
    const [processedProducts, setProcessedProducts] = useState<ProductCardData[]>([]);

    // 环境数据处理
    const environment: EnvironmentData = useMemo(() => ({
        uvIndex: envData?.uvIndex ?? 5,
        humidity: envData?.humidity ?? 60,
        aqi: envData?.aqi ?? 50,
        season: getCurrentSeason()
    }), [envData]);

    // 计算环境加成
    const envBonuses = useMemo(() => calculateEnvironmentBonus(environment), [environment]);
    const topPriorityStep = useMemo(() => getTopPriorityStep(environment), [environment]);

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

            // 检查环境加成
            const envBonus = envBonuses.find(b => b.step === step);
            const environmentBonus = envBonus?.priority === 'high' ? envBonus.reason : null;

            // 关联维度评分 (简单逻辑：根据类别关联维度)
            let dimensionLink: ProductCardData['dimensionLink'] = null;
            if (faceAnalysis?.dimensions) {
                const categoryToDimension: Record<string, string> = {
                    '精华': 'radiance',
                    '面霜': 'waterOil',
                    '防晒': 'uvDamage',
                    '洁面': 'pores',
                    '眼霜': 'darkCircles'
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
                environmentBonus,
                dimensionLink
            } as ProductCardData;
        });

        // 按环境优先级排序
        if (topPriorityStep) {
            processed.sort((a, b) => {
                const aIsPriority = (a as any).step === topPriorityStep.step;
                const bIsPriority = (b as any).step === topPriorityStep.step;
                if (aIsPriority && !bIsPriority) return -1;
                if (!aIsPriority && bIsPriority) return 1;
                return (b.matchScore ?? 0) - (a.matchScore ?? 0);
            });
        }

        setProcessedProducts(processed);
    }, [products, envBonuses, topPriorityStep, faceAnalysis]);

    // 按步骤分组
    const groupedProducts = useMemo(() => {
        return groupProductsByStep(processedProducts.map(p => ({
            ...p,
            step: (p as any).step || inferStepFromCategory(p.category)
        })));
    }, [processedProducts]);

    // 获取有产品的步骤列表 (按顺序)
    const stepsWithProducts = useMemo(() => {
        return STEP_ORDER.filter(step => groupedProducts.has(step));
    }, [groupedProducts]);

    // 完全没有产品时的空状态
    if (!isLoading && products.length === 0) {
        return (
            <div className={cn("rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden", className)}>
                {/* 标题 */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <Gift className="w-5 h-5 text-gray-700" />
                    <span className="text-lg font-semibold text-gray-900">甄选产品推荐</span>
                </div>

                {/* 空状态 */}
                <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-base font-medium text-gray-900 mb-2">暂无产品推荐</h4>
                    <p className="text-sm text-gray-500">
                        系统正在为您匹配最适合的护肤产品，请稍后再查看。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden", className)}>
            {/* 标题栏 */}
            <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Gift className="w-5 h-5 text-gray-700" />
                        <span className="text-lg font-semibold text-gray-900">甄选产品推荐</span>
                        <span className="text-xs text-gray-400 font-normal">
                            按护肤步骤分类
                        </span>
                    </div>

                    {/* 统计信息 */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {products.length} 款产品
                        </span>
                        {topPriorityStep && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                                <Zap className="w-3 h-3" />
                                今日重点: {SKINCARE_STEPS[topPriorityStep.step].label}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 内容区域 */}
            <div className="p-6">
                {isLoading ? (
                    <ProductRecommendationSkeleton />
                ) : (
                    <div className="space-y-8">
                        {stepsWithProducts.map((step, index) => {
                            const stepProducts = groupedProducts.get(step) || [];
                            const envBonus = envBonuses.find(b => b.step === step);

                            return (
                                <StepProductGroup
                                    key={step}
                                    step={step}
                                    products={stepProducts as ProductCardData[]}
                                    index={index}
                                    environmentReason={envBonus?.priority === 'high' ? envBonus.reason : null}
                                    onAddToRoutine={onAddToRoutine}
                                    onProductClick={onProductClick}
                                    defaultExpanded={index < 3} // 前3个步骤默认展开
                                    maxVisible={4}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 底部说明 */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                    💡 产品推荐基于您的肤质分析和当前环境数据，仅供参考
                </p>
            </div>
        </div>
    );
}

export default ProductRecommendationSection;
