"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { m } from "framer-motion";
import { ChevronRight, ExternalLink, ShoppingCart } from "lucide-react";
import { IngredientTags } from "./IngredientTooltip";
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
    onProductClick?: (productId: string) => void;
    variant?: "default" | "compact" | "horizontal";
    showMatchScore?: boolean;
}

export function ProductCard({
    product,
    index = 0,
    onProductClick,
    variant = "default",
    showMatchScore = true
}: ProductCardProps) {
    const [imageError, setImageError] = useState(false);
    const [showPlatforms, setShowPlatforms] = useState(false);
    const platformRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭平台下拉
    useEffect(() => {
        if (!showPlatforms) return;
        const handleClick = (e: MouseEvent) => {
            if (platformRef.current && !platformRef.current.contains(e.target as Node)) {
                setShowPlatforms(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showPlatforms]);

    const primaryLink = getPrimaryLink(product.affiliateLinks);
    const allLinks = getProductLinks(product.affiliateLinks);

    const handleCardClick = useCallback(() => {
        onProductClick?.(product.id);
    }, [product.id, onProductClick]);

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
                onProductClick={onProductClick}
            />
        );
    }

    const isCompact = variant === "compact";

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className={cn(
                "group relative rounded-xl border overflow-hidden",
                "hover:shadow-lg transition-all duration-300",
                "cursor-pointer",
                isCompact
                    ? "bg-[#FAF6F0] border-[#E8E0D4] hover:border-[#D4C8B8]"
                    : "bg-white/10 backdrop-blur-sm border-white/10 hover:border-white/20"
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
                                : "bg-white/10 text-white/70"
                    )}>
                        {product.matchScore}% 匹配
                    </span>
                </div>
            )}

            {/* 图片区域 */}
            <div className={cn("relative overflow-hidden", isCompact ? "bg-[#F0EBE3] aspect-square" : "bg-white/5 aspect-square")}>
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
                    <div className={cn("w-full h-full flex items-center justify-center", isCompact ? "text-[#8c7a6b]/50" : "text-white/30")}>
                        <ShoppingCart className="w-12 h-12" />
                    </div>
                )}
            </div>

            {/* 内容区域 */}
            <div className={cn(isCompact ? "p-3" : "p-4")}>
                {/* 分类 */}
                <span className={cn("font-bold uppercase tracking-wider block", isCompact ? "text-[9px] text-[#8c7a6b] mb-0.5" : "text-[10px] text-white/50 mb-1")}>
                    {product.category}
                </span>

                {/* 产品名称 */}
                <h4 className={cn("font-semibold leading-snug line-clamp-2 transition-colors", isCompact ? "text-xs text-[#3d2f25] mb-0.5 group-hover:text-[#5c4937]" : "text-sm text-white mb-1 group-hover:text-blue-300")}>
                    {product.name}
                </h4>

                {/* 英文名 */}
                {product.nameEn && (
                    <p className={cn("text-[10px] mb-2 line-clamp-1", isCompact ? "text-[#8c7a6b]" : "text-white/50")}>
                        {product.nameEn}
                    </p>
                )}

                {/* 成分标签 */}
                {product.keyIngredients && product.keyIngredients.length > 0 && (
                    <div className={isCompact ? "mb-1.5" : "mb-2"}>
                        <IngredientTags ingredients={product.keyIngredients} maxShow={2} />
                    </div>
                )}

                {/* 推荐理由 */}
                <p className={cn("leading-relaxed", isCompact ? "text-[11px] text-[#5c4937] mb-2 line-clamp-1" : "text-xs text-white/70 mb-3 line-clamp-2")}>
                    {getReasonText()}
                </p>

                {/* 底部操作栏 */}
                <div className={cn("flex items-center justify-between", isCompact ? "pt-2 border-t border-[#E8E0D4]" : "pt-3 border-t border-white/10")}>
                    <span className={cn("font-semibold", isCompact ? "text-xs text-[#3d2f25]" : "text-sm text-white")}>
                        {product.price || '咨询价格'}
                    </span>

                    <div className="flex items-center gap-1.5">
                        {/* 购买按钮 */}
                        {allLinks.length > 0 && (
                            <div className="relative" ref={platformRef}>
                                <button
                                    onClick={handleBuyClick}
                                    className={cn(
                                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                                        isCompact
                                            ? "bg-[#3d2f25] text-white hover:bg-[#2a2018]"
                                            : "bg-white/20 text-white hover:bg-white/30"
                                    )}
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
                                    <div className={cn(
                                        "absolute bottom-full right-0 mb-1 py-1 rounded-lg shadow-xl min-w-[120px] z-20",
                                        isCompact
                                            ? "bg-[#FAF6F0] border border-[#E8E0D4]"
                                            : "bg-white/10 backdrop-blur-sm border border-white/10"
                                    )}>
                                        {allLinks.map(link => (
                                            <button
                                                key={link.platform}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePlatformClick(link);
                                                }}
                                                className={cn(
                                                    "w-full px-3 py-1.5 text-left text-xs font-medium flex items-center gap-2 transition-colors",
                                                    isCompact ? "hover:bg-[#F0EBE3]" : "hover:bg-white/10"
                                                )}
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
                            <ChevronRight className={cn("w-4 h-4", isCompact ? "text-[#8c7a6b]" : "text-white/50")} />
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
    onProductClick
}: {
    product: ProductCardData;
    onProductClick?: (productId: string) => void;
}) {
    const [imageError, setImageError] = useState(false);
    const primaryLink = getPrimaryLink(product.affiliateLinks);

    return (
        <m.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="group flex bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden hover:border-white/20 hover:shadow-lg transition-all duration-300 cursor-pointer"
            onClick={() => onProductClick?.(product.id)}
        >
            {/* 图片 */}
            <div className="relative w-32 h-32 flex-shrink-0 overflow-hidden bg-white/5">
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
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                        <ShoppingCart className="w-8 h-8" />
                    </div>
                )}
            </div>

            {/* 内容 */}
            <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                        {product.category}
                    </span>
                    <h4 className="text-sm font-semibold text-white mt-0.5 line-clamp-1">
                        {product.name}
                    </h4>
                    <p className="text-xs text-white/70 mt-1 line-clamp-2">
                        {product.reason}
                    </p>
                </div>

                <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-white">{product.price}</span>
                </div>
            </div>
        </m.div>
    );
}

export default ProductCard;
