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
    onViewDetail?: (product: ProductCardData) => void;
    variant?: "default" | "compact" | "horizontal";
    showMatchScore?: boolean;
}

export function ProductCard({
    product,
    index = 0,
    onProductClick,
    onViewDetail,
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
        onViewDetail?.(product);
    }, [product.id, onProductClick, onViewDetail, product]);

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
    const getReasonText = () => product.reason;

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
                "group relative overflow-hidden transition-all duration-300",
                isCompact
                    ? "bg-[#FAF6F0] rounded-[20px] shadow-sm hover:shadow-md cursor-default"
                    : "rounded-xl border bg-white/10 backdrop-blur-sm border-white/10 hover:border-white/20 hover:shadow-lg cursor-pointer"
            )}
            onClick={handleCardClick}
        >
            {/* 图片区域 */}
            <div className={cn("relative overflow-hidden", isCompact ? "aspect-[4/3] p-3" : "bg-white/5 aspect-square")}>
                {!imageError ? (
                    <div className="relative w-full h-full overflow-hidden rounded-[16px]">
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIRAAAgIBAwUBAAAAAAAAAAAAAwQBAgAFBhESEyExQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAAFBv/EABoRAAICAwAAAAAAAAAAAAAAAAECAAMEESH/2gAMAwEAAhEDEEAAAAGqpnWZZMmf/9k="
                            onError={() => setImageError(true)}
                        />
                    </div>
                ) : (
                    <div className={cn("w-full h-full flex items-center justify-center", isCompact ? "text-[#8c7a6b]/50" : "text-white/30")}>
                        <ShoppingCart className="w-12 h-12" />
                    </div>
                )}
            </div>

            {/* 内容区域 */}
            <div className={cn(isCompact ? "p-4" : "p-4")}>
                {/* 产品名称 */}
                <h4 className={cn("leading-snug line-clamp-2", isCompact ? "text-lg font-bold text-[#1a1a1a] mb-2" : "text-sm font-semibold text-white mb-1 group-hover:text-blue-300")}>
                    {product.name}
                </h4>

                {/* 功效标签 */}
                {product.benefits && product.benefits.length > 0 && isCompact && (
                    <p className="text-[13px] text-[#C8A97E] mb-2 truncate">
                        {product.benefits.join(" | ")}
                    </p>
                )}

                {/* 推荐理由 */}
                <p className={cn("leading-relaxed", isCompact ? "text-[13px] text-[#666] mb-4 line-clamp-2" : "text-xs text-white/70 mb-3 line-clamp-2")}>
                    {getReasonText()}
                </p>

                {/* 底部操作栏 */}
                <div className={cn("flex items-center justify-between", isCompact ? "" : "pt-3 border-t border-white/10")}>
                    <span className={cn("font-bold", isCompact ? "text-xl text-[#1a1a1a]" : "text-sm text-white")}>
                        {product.price ? `¥ ${product.price}` : '咨询价格'}
                    </span>

                    <div className="flex items-center gap-1.5">
                        {/* 查看详情 / 购买按钮 */}
                        {isCompact ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewDetail?.(product);
                                }}
                                className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-full bg-[#C8A97E] text-white hover:bg-[#B89A6E] transition-colors"
                            >
                                查看详情
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        ) : (
                            <>
                                {allLinks.length > 0 && (
                                    <div className="relative" ref={platformRef}>
                                        <button
                                            onClick={handleBuyClick}
                                            className={cn(
                                                "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors",
                                                "rounded-full bg-white/20 text-white hover:bg-white/30"
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
                                                "bg-white/10 backdrop-blur-sm border border-white/10"
                                            )}>
                                                {allLinks.map(link => (
                                                    <button
                                                        key={link.platform}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePlatformClick(link);
                                                        }}
                                                        className="w-full px-3 py-1.5 text-left text-xs font-medium flex items-center gap-2 transition-colors hover:bg-white/10"
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
                                    <ChevronRight className="w-4 h-4 text-white/50" />
                                )}
                            </>
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
                        className="object-cover"
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
