"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { m } from "framer-motion";
import { ChevronRight, Plus, ExternalLink, ShoppingCart } from "lucide-react";
import { WishlistButton } from "./WishlistButton";
import { IngredientTooltip, IngredientTags } from "./IngredientTooltip";
import {
    AffiliateLinks,
    getProductLinks,
    getPrimaryLink,
    openAffiliateLink,
    ECOMMERCE_PLATFORMS
} from "@/lib/affiliate-links";
import { cn } from "@/lib/utils";

export interface ProductCardData {
    id: string;
    name: string;
    nameEn?: string | null;
    category: string;
    image: string;
    price: string;
    reason: string;
    score?: number;
    matchScore?: number; // 匹配度百分比
    keyIngredients?: string[];
    benefits?: string[];
    howToUse?: string | null;
    affiliateLinks?: AffiliateLinks | null;
    dimensionLink?: {
        dimension: string;
        score: number;
    } | null; // 关联的维度评分
}

interface ProductCardProps {
    product: ProductCardData;
    index?: number;
    onAddToRoutine?: (productId: string) => void;
    onProductClick?: (productId: string) => void;
    variant?: "default" | "compact" | "horizontal";
    showMatchScore?: boolean;
}

export function ProductCard({
    product,
    index = 0,
    onAddToRoutine,
    onProductClick,
    variant = "default",
    showMatchScore = true
}: ProductCardProps) {
    const [imageError, setImageError] = useState(false);
    const [showPlatforms, setShowPlatforms] = useState(false);

    const primaryLink = getPrimaryLink(product.affiliateLinks);
    const allLinks = getProductLinks(product.affiliateLinks);

    const handleCardClick = useCallback(() => {
        onProductClick?.(product.id);
    }, [product.id, onProductClick]);

    const handleAddToRoutine = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onAddToRoutine?.(product.id);
    }, [product.id, onAddToRoutine]);

    const handleBuyClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (allLinks.length > 1) {
            setShowPlatforms(prev => !prev);
        } else if (primaryLink) {
            openAffiliateLink(primaryLink.url, product.id, primaryLink.platform);
        }
    }, [allLinks, primaryLink, product.id]);

    const handlePlatformClick = useCallback((platform: typeof allLinks[0]) => {
        openAffiliateLink(platform.url, product.id, platform.platform);
        setShowPlatforms(false);
    }, [product.id]);

    // 生成个性化推荐理由
    const getReasonText = () => {
        if (product.dimensionLink) {
            return `针对您的 ${product.dimensionLink.dimension} ${product.dimensionLink.score}分，${product.reason}`;
        }
        return product.reason;
    };

    if (variant === "horizontal") {
        return (
            <HorizontalProductCard
                product={product}
                onAddToRoutine={onAddToRoutine}
                onProductClick={onProductClick}
            />
        );
    }

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className={cn(
                "group relative bg-white rounded-xl border border-gray-100 overflow-hidden",
                "hover:border-gray-200 hover:shadow-lg transition-all duration-300",
                "cursor-pointer"
            )}
            onClick={handleCardClick}
        >
            {/* 匹配度徽章 */}
            {showMatchScore && product.matchScore && (
                <div className="absolute top-2 left-2 z-10">
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold",
                        product.matchScore >= 90
                            ? "bg-emerald-500 text-white"
                            : product.matchScore >= 75
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-600"
                    )}>
                        {product.matchScore}% 匹配
                    </span>
                </div>
            )}

            {/* 收藏按钮 */}
            <div className="absolute top-2 right-2 z-10">
                <WishlistButton productId={product.id} size="sm" />
            </div>

            {/* 图片区域 */}
            <div className="relative aspect-square overflow-hidden bg-gray-50">
                {!imageError ? (
                    <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIRAAAgIBAwUBAAAAAAAAAAAAAwQBAgAFBhESEyExQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAAFBv/EABoRAAICAwAAAAAAAAAAAAAAAAECAAMEESH/2gAMAwEAAhEDEEAAAAGqpnWZZMmf/9k="
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingCart className="w-12 h-12" />
                    </div>
                )}
            </div>

            {/* 内容区域 */}
            <div className="p-4">
                {/* 分类 */}
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                    {product.category}
                </span>

                {/* 产品名称 */}
                <h4 className="text-sm font-semibold text-gray-900 mb-1 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.name}
                </h4>

                {/* 英文名 */}
                {product.nameEn && (
                    <p className="text-[10px] text-gray-400 mb-2 line-clamp-1">
                        {product.nameEn}
                    </p>
                )}

                {/* 成分标签 (可悬浮查看详情) */}
                {product.keyIngredients && product.keyIngredients.length > 0 && (
                    <IngredientTooltip
                        ingredients={product.keyIngredients}
                        benefits={product.benefits}
                        howToUse={product.howToUse || undefined}
                        position="top"
                    >
                        <div className="mb-2">
                            <IngredientTags ingredients={product.keyIngredients} maxShow={2} />
                        </div>
                    </IngredientTooltip>
                )}

                {/* 推荐理由 */}
                <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                    {getReasonText()}
                </p>

                {/* 底部操作栏 */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                        {product.price || '咨询价格'}
                    </span>

                    <div className="flex items-center gap-1.5">
                        {/* 加入流程按钮 */}
                        {onAddToRoutine && (
                            <button
                                onClick={handleAddToRoutine}
                                className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"
                                title="加入护肤流程"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}

                        {/* 购买按钮 */}
                        {allLinks.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={handleBuyClick}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                                >
                                    去购买
                                    {allLinks.length > 1 ? (
                                        <ChevronRight className={cn(
                                            "w-3 h-3 transition-transform",
                                            showPlatforms && "rotate-90"
                                        )} />
                                    ) : (
                                        <ExternalLink className="w-3 h-3" />
                                    )}
                                </button>

                                {/* 多平台选择下拉 */}
                                {showPlatforms && allLinks.length > 1 && (
                                    <div className="absolute bottom-full right-0 mb-1 py-1 bg-white rounded-lg shadow-xl border border-gray-100 min-w-[120px] z-20">
                                        {allLinks.map(link => (
                                            <button
                                                key={link.platform}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePlatformClick(link);
                                                }}
                                                className="w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                                style={{ color: link.config.color }}
                                            >
                                                <span>{link.config.icon}</span>
                                                {link.config.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 无购买链接时显示箭头 */}
                        {allLinks.length === 0 && (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                    </div>
                </div>
            </div>
        </m.div>
    );
}

/**
 * 横向布局产品卡片 (用于精选/TOP推荐)
 */
function HorizontalProductCard({
    product,
    onAddToRoutine,
    onProductClick
}: {
    product: ProductCardData;
    onAddToRoutine?: (productId: string) => void;
    onProductClick?: (productId: string) => void;
}) {
    const [imageError, setImageError] = useState(false);
    const primaryLink = getPrimaryLink(product.affiliateLinks);

    return (
        <m.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="group flex bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer"
            onClick={() => onProductClick?.(product.id)}
        >
            {/* 图片 */}
            <div className="relative w-32 h-32 flex-shrink-0 overflow-hidden bg-gray-50">
                {!imageError ? (
                    <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="128px"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingCart className="w-8 h-8" />
                    </div>
                )}
            </div>

            {/* 内容 */}
            <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {product.category}
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900 mt-0.5 line-clamp-1">
                        {product.name}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {product.reason}
                    </p>
                </div>

                <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-gray-900">{product.price}</span>
                    <div className="flex items-center gap-2">
                        <WishlistButton productId={product.id} size="sm" />
                        {onAddToRoutine && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddToRoutine(product.id);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                                + 加入流程
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </m.div>
    );
}

export default ProductCard;
