"use client";

import { useState, useEffect, useRef } from "react";
import { m } from "framer-motion";
import { ProductCard, ProductCardData } from "./ProductCard";
import { ProductDetailModal } from "./ProductDetailModal";
import { cn } from "@/lib/utils";
import { DIMENSION_LABELS } from "@/lib/advisor-utils";

interface ProductRecommendationSectionProps {
    products: ProductCardData[];
    isLoading?: boolean;
    personaLabel?: string;
    faceAnalysis?: {
        dimensions?: Record<string, { score: number }>;
    } | null;
    onProductClick?: (productId: string) => void;
    className?: string;
    centered?: boolean;
}

export function ProductRecommendationSection({
    products,
    isLoading = false,
    personaLabel,
    faceAnalysis,
    onProductClick,
    className,
    centered = false
}: ProductRecommendationSectionProps) {
    const [processedProducts, setProcessedProducts] = useState<ProductCardData[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<ProductCardData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasCentered = useRef(false);
    const prevProductsRef = useRef<ProductCardData[]>([]);

    // 当产品列表变化时重置居中状态
    useEffect(() => {
        const prevIds = prevProductsRef.current.map(p => p.id).join(',');
        const currIds = products.map(p => p.id).join(',');
        if (prevIds !== currIds) {
            hasCentered.current = false;
            prevProductsRef.current = products;
        }
    }, [products]);

    useEffect(() => {
        if (!products || products.length === 0) {
            setProcessedProducts([]);
            return;
        }

        // calculateScore 的理论最高分估算：
        // 关注点匹配每匹配一项 +30（通常 2-4 项），年龄段 +25，肤质 +20，预算 +15，推荐 +10。
        // 常规自然匹配下最高分约为 150；强制推荐商品会被额外 +1000 提升排序，
        // 这里用 150 作为匹配度百分比的归一化基准，使其封顶在 99%。
        const MAX_HEURISTIC_SCORE = 150;

        const processed = products.map(product => {
            const baseScore = product.score ?? 0;
            const matchScore = baseScore > 0 ? Math.min(99, Math.round((baseScore / MAX_HEURISTIC_SCORE) * 100)) : 0;

            let dimensionLink: ProductCardData['dimensionLink'] = null;
            if (faceAnalysis?.dimensions) {
                const categoryToDimension: Record<string, string> = {
                    // 与后台 admin CATEGORY_OPTIONS 严格对齐
                    '精华露': 'radiance',
                    '面霜': 'waterOil',
                    '洁面': 'waterOil',
                    '护理油': 'waterOil',
                    '面膜': 'sensitivity',
                    '防晒': 'uvDamage',
                    '磨砂膏': 'waterOil',
                    // 身体乳、护手霜 非面部护理品，无需关联面部分析维度
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
                matchScore,
                dimensionLink
            } as ProductCardData;
        });

        // 保持后端排序（AI 精选在前，算法补充在后），不再按 matchScore 重排
        setProcessedProducts(processed);
    }, [products, faceAnalysis]);

    // 初始化滚动位置：让前3个推荐卡片居中显示
    useEffect(() => {
        if (!scrollRef.current || processedProducts.length === 0 || hasCentered.current) return;

        const container = scrollRef.current;
        const cards = Array.from(container.children) as HTMLElement[];
        if (cards.length < 3) {
            hasCentered.current = true;
            return;
        }

        const containerWidth = container.clientWidth;
        const card1 = cards[0];
        const card3 = cards[2];

        if (card1 && card3) {
            const scrollLeft = card1.offsetLeft;
            const contentRight = card3.offsetLeft + card3.offsetWidth;
            const contentWidth = contentRight - scrollLeft;
            const targetScroll = scrollLeft - (containerWidth - contentWidth) / 2;

            container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'instant' });
            hasCentered.current = true;
        }
    }, [processedProducts]);

    if (!isLoading && products.length === 0) {
        return (
            <div className="py-12 text-center">
                <h4 className="text-base font-medium text-[#3d2f25] mb-2">暂无产品推荐</h4>
                <p className="text-sm text-[#8c7a6b]">更多精选产品即将上线，敬请期待</p>
            </div>
        );
    }

    return (
        <section className={cn("relative w-full pb-0 lg:pb-10", className)}>
            {/* 标题 */}
            <m.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-6"
            >
                <h2 className="text-lg lg:text-2xl font-bold text-[#3d2f25] tracking-wide">
                    {personaLabel ? `你的「${personaLabel}」甄选推荐` : "甄选产品推荐"}
                </h2>
                <p className="text-xs lg:text-sm text-[#8c7a6b] mt-2">
                    {personaLabel
                        ? "基于您的肌肤检测结果，从专属方案中精选最适合入手的 3 件"
                        : "基于您的肤质分析，为您精选以下产品"}
                </p>
            </m.div>

            {/* 产品展示区域 */}
            <div className="relative">
                {/* 滚动容器 */}
                {isLoading ? (
                    <div className={cn("flex gap-3 px-[2%] sm:px-[4%] md:px-[6%]", centered && "justify-center")}>
                        {[0, 1, 2].map(i => (
                            <div key={i} className="flex-shrink-0 w-[85vw] sm:w-[45vw] md:w-[32vw] lg:w-[28vw]">
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 h-[380px] animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        ref={scrollRef}
                        className={cn(
                            "flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 pt-3",
                            centered ? "flex-col lg:flex-row lg:justify-center pb-0 pt-0 lg:pb-2 lg:pt-2" : "px-[2%] sm:px-[4%] md:px-[6%]"
                        )}
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', overscrollBehaviorX: 'contain' }}
                    >
                        {processedProducts.map((product, index) => (
                            <div
                                key={product.id}
                                className={cn(
                                    "snap-center",
                                    centered
                                        ? "w-full lg:flex-1 lg:min-w-[220px] lg:max-w-[290px]"
                                        : "flex-shrink-0 w-[85vw] sm:w-[45vw] md:w-[32vw] lg:w-[28vw] xl:w-[25vw]"
                                )}
                            >
                                <div className="relative">
                                    <ProductCard
                                        product={product}
                                        index={index}
                                        onProductClick={onProductClick}
                                        onViewDetail={centered ? (p) => { setSelectedProduct(p); setIsModalOpen(true); } : undefined}
                                        variant={centered ? "compact" : "default"}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!centered && (
                <p className="text-xs text-[#8c7a6b] text-center mt-6">
                    💡 左右滑动或点击箭头查看更多产品
                </p>
            )}

            <ProductDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                product={selectedProduct}
            />
        </section>
    );
}

export default ProductRecommendationSection;
