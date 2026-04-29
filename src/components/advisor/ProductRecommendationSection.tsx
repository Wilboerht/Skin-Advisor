"use client";

import { useState, useEffect, useRef } from "react";
import { m } from "framer-motion";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard, ProductCardData } from "./ProductCard";
import { cn } from "@/lib/utils";

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
    onProductClick?: (productId: string) => void;
    className?: string;
}

export function ProductRecommendationSection({
    products,
    isLoading = false,
    faceAnalysis,
    onProductClick,
    className
}: ProductRecommendationSectionProps) {
    const [processedProducts, setProcessedProducts] = useState<ProductCardData[]>([]);
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

        const processed = products.map(product => {
            const baseScore = product.score ?? 50;
            const matchScore = Math.min(99, Math.round((baseScore / 150) * 100));

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

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const cardWidth = container.firstElementChild?.clientWidth || 320;
        const scrollAmount = cardWidth * 3 + 16 * 3;
        container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    };

    if (!isLoading && products.length === 0) {
        return (
            <div className="py-12 text-center">
                <h4 className="text-base font-medium text-[#3d2f25] mb-2">暂无产品推荐</h4>
                <p className="text-sm text-[#8c7a6b]">更多精选产品即将上线，敬请期待</p>
            </div>
        );
    }

    return (
        <section className={cn("relative w-[80%] mx-auto py-10", className)}>
            {/* 标题 */}
            <m.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-10"
            >
                <h2 className="text-2xl font-bold text-[#3d2f25] tracking-wide">甄选产品推荐</h2>
                <p className="text-sm text-[#8c7a6b] mt-2">基于您的肤质分析，为您精选以下产品</p>
            </m.div>

            {/* 轮播区域 */}
            <div className="relative group">
                {/* 左箭头 */}
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full
                               bg-white/90 backdrop-blur-sm shadow-lg border border-[#E9E9E7]
                               flex items-center justify-center text-[#3d2f25]
                               opacity-0 group-hover:opacity-100 transition-all duration-300
                               hover:bg-white hover:scale-110 hover:shadow-xl"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                {/* 右箭头 */}
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full
                               bg-white/90 backdrop-blur-sm shadow-lg border border-[#E9E9E7]
                               flex items-center justify-center text-[#3d2f25]
                               opacity-0 group-hover:opacity-100 transition-all duration-300
                               hover:bg-white hover:scale-110 hover:shadow-xl"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                {/* 左虚化遮罩 */}
                <div className="absolute left-0 top-0 bottom-0 w-[6%] sm:w-[8%] md:w-[10%] z-10 pointer-events-none
                                bg-gradient-to-r from-[#FDFBF7] via-[#FDFBF7]/95 to-transparent" />
                {/* 右虚化遮罩 */}
                <div className="absolute right-0 top-0 bottom-0 w-[6%] sm:w-[8%] md:w-[10%] z-10 pointer-events-none
                                bg-gradient-to-l from-[#FDFBF7] via-[#FDFBF7]/95 to-transparent" />

                {/* 滚动容器 */}
                {isLoading ? (
                    <div className="flex gap-4 px-[2%] sm:px-[4%] md:px-[6%]">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="flex-shrink-0 w-[85vw] sm:w-[45vw] md:w-[32vw] lg:w-[28vw]">
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 h-[380px] animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        ref={scrollRef}
                        className="flex gap-4 overflow-x-auto snap-x snap-mandatory
                                   px-[2%] sm:px-[4%] md:px-[6%]
                                   pb-4 pt-4"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {processedProducts.map((product, index) => (
                            <div
                                key={product.id}
                                className="flex-shrink-0
                                           w-[85vw] sm:w-[45vw] md:w-[32vw] lg:w-[28vw] xl:w-[25vw]
                                           snap-center"
                            >
                                <div className="relative">
                                    {/* 推荐胶囊 — 前3个显示 */}
                                    {index < 3 && (
                                        <m.div
                                            initial={{ opacity: 0, y: -10, scale: 0.8 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ delay: index * 0.12 + 0.3, type: 'spring', stiffness: 400, damping: 20 }}
                                            className="absolute -top-3 left-1/2 -translate-x-1/2 z-20"
                                        >
                                            <span className="inline-flex items-center gap-1.5
                                                             px-4 py-1.5 rounded-full
                                                             bg-gradient-to-r from-[#C8A97E] to-[#D4B78F]
                                                             text-white text-xs font-bold shadow-lg
                                                             border border-white/30">
                                                <Sparkles className="w-3 h-3" />
                                                推荐
                                            </span>
                                        </m.div>
                                    )}

                                    <ProductCard
                                        product={product}
                                        index={index}
                                        onProductClick={onProductClick}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 底部提示 */}
            <p className="text-xs text-[#8c7a6b] text-center mt-6">
                💡 左右滑动或点击箭头查看更多产品
            </p>
        </section>
    );
}

export default ProductRecommendationSection;
