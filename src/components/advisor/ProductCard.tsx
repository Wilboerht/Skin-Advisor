"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { m } from "framer-motion";
import { ChevronRight, ExternalLink, ShoppingCart } from "lucide-react";
import {
    AffiliateLinks,
    getProductLinks,
    getPrimaryLink,
    openAffiliateLink,
} from "@/lib/affiliate-links";
import { cn } from "@/lib/utils";

export interface ProductCardData {
    id: string;
    name: string;
    category: string;
    image: string;
    images?: string[] | null;
    price: string;
    reason: string;
    description?: string | null;
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
    /** 推荐来源：ai（AI 精选）| persona（IP 池内）| algorithm（池外补充） */
    source?: "ai" | "persona" | "algorithm";
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
}: ProductCardProps) {
    if (variant === "horizontal") {
        return (
            <HorizontalProductCard
                product={product}
                onProductClick={onProductClick}
            />
        );
    }

    if (variant === "compact") {
        return (
            <CompactProductCard
                product={product}
                index={index}
                onProductClick={onProductClick}
                onViewDetail={onViewDetail}
            />
        );
    }

    return (
        <DefaultProductCard
            product={product}
            index={index}
            onProductClick={onProductClick}
        />
    );
}

function CompactProductCard({
    product,
    index = 0,
    onProductClick,
    onViewDetail,
}: {
    product: ProductCardData;
    index?: number;
    onProductClick?: (productId: string) => void;
    onViewDetail?: (product: ProductCardData) => void;
}) {
    const [imageError, setImageError] = useState(false);

    const handleCardClick = useCallback(() => {
        onProductClick?.(product.id);
    }, [product.id, onProductClick]);

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="group relative overflow-hidden rounded-[20px] bg-[#FAF6F0] shadow-sm transition-all duration-300 hover:shadow-md"
            onClick={handleCardClick}
        >
            <div className="flex flex-row lg:block">
                {/* 图片区域 */}
                <div className="relative h-[120px] w-[120px] shrink-0 overflow-hidden p-2 lg:aspect-square lg:h-auto lg:w-auto lg:p-3">
                    <ProductImage
                        product={product}
                        imageError={imageError}
                        onImageError={() => setImageError(true)}
                        compact
                    />
                </div>

                {/* 内容区域 */}
                <div className="flex min-w-0 flex-1 flex-col p-3 lg:p-4">
                    <div>
                        {/* 产品名称 */}
                        <h4 className="mb-1 line-clamp-2 text-base font-bold leading-snug text-[#1a1a1a] lg:mb-2 lg:text-lg">
                            {product.name}
                        </h4>

                        {/* 功效标签 */}
                        {product.benefits && product.benefits.length > 0 && (
                            <p className="mb-1 truncate text-xs text-[#C8A97E] lg:text-xs">
                                {product.benefits.join(" | ")}
                            </p>
                        )}

                        {/* 推荐理由 */}
                        <p className="line-clamp-1 text-xs text-[#8c7a6b] lg:text-[#666]">
                            {product.reason}
                        </p>
                    </div>

                    {/* 价格 - mobile only (固定在底部) */}
                    <span className="mt-auto text-base font-bold text-[#1a1a1a] lg:hidden">
                        {product.price ? product.price.replace('¥', '¥ ') : '咨询价格'}
                    </span>

                    {/* 底部操作栏 - desktop only */}
                    <div className="hidden items-center justify-between pt-3 lg:flex">
                        <span className="text-xl font-bold text-[#1a1a1a]">
                            {product.price ? product.price.replace('¥', '¥ ') : '咨询价格'}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewDetail?.(product);
                            }}
                            className="group/btn inline-flex items-center gap-1.5 rounded-full border border-[#5c4937]/30 bg-transparent px-4 py-2 text-[13px] font-medium text-[#5c4937] transition-colors hover:border-[#5c4937]/50 hover:bg-[#5c4937]/5"
                        >
                            查看详情
                            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                        </button>
                    </div>
                </div>
            </div>
        </m.div>
    );
}

function DefaultProductCard({
    product,
    index = 0,
    onProductClick,
}: {
    product: ProductCardData;
    index?: number;
    onProductClick?: (productId: string) => void;
}) {
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

    const allLinks = getProductLinks(product.affiliateLinks);
    const primaryLink = getPrimaryLink(product.affiliateLinks);

    const handleCardClick = useCallback(() => {
        onProductClick?.(product.id);
    }, [product.id, onProductClick]);

    const handleBuyClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onProductClick?.(product.id);

        if (allLinks.length > 1) {
            setShowPlatforms(prev => !prev);
        } else if (primaryLink) {
            openAffiliateLink(primaryLink.url, product.id, primaryLink.platform);
        }
    }, [allLinks, primaryLink, product.id, onProductClick]);

    const handlePlatformClick = useCallback((platform: typeof allLinks[0]) => {
        openAffiliateLink(platform.url, product.id, platform.platform);
        setShowPlatforms(false);
    }, [product.id]);

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:shadow-lg"
            onClick={handleCardClick}
        >
            {/* 图片区域 */}
            <div className="relative aspect-square overflow-hidden bg-white/5">
                <ProductImage
                    product={product}
                    imageError={imageError}
                    onImageError={() => setImageError(true)}
                />
            </div>

            {/* 内容区域 */}
            <div className="p-4">
                {/* 产品名称 */}
                <h4 className="mb-1 text-sm font-semibold text-white group-hover:text-blue-300 line-clamp-2">
                    {product.name}
                </h4>

                {/* 推荐理由 */}
                <p className="mb-3 text-xs text-white/70 line-clamp-2">
                    {product.reason}
                </p>

                {allLinks.length > 0 ? (
                    <div className="relative" ref={platformRef}>
                        <button
                            onClick={handleBuyClick}
                            className="flex items-center gap-1 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/30"
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
                            <div className="absolute bottom-full right-0 z-20 mb-1 min-w-[120px] rounded-lg border border-white/10 bg-white/10 py-1 shadow-xl backdrop-blur-sm">
                                {allLinks.map(link => (
                                    <button
                                        key={link.platform}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePlatformClick(link);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-white/10"
                                        style={{ color: link.config.color }}
                                    >
                                        <span>{link.config.icon}</span>
                                        {link.config.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <ChevronRight className="w-4 h-4 text-white/50" />
                )}
            </div>
        </m.div>
    );
}

function ProductImage({
    product,
    imageError,
    onImageError,
    compact = false,
}: {
    product: ProductCardData;
    imageError: boolean;
    onImageError: () => void;
    compact?: boolean;
}) {
    const isLocalImage = product.image?.startsWith('/') && !product.image?.startsWith('//');
    // 外部 HTTPS 图片用 unoptimized 绕过 Next.js Image 代理，避免广告拦截器误杀
    const useUnoptimized = isLocalImage || product.image?.startsWith('https://');

    if (imageError) {
        return (
            <div className={cn(
                "flex h-full w-full items-center justify-center",
                compact ? "text-[#8c7a6b]/50" : "text-white/30"
            )}>
                <ShoppingCart className={cn("h-12 w-12", compact && "h-8 w-8")} />
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden rounded-[12px] lg:rounded-[16px]">
            <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 1023px) 120px, (max-width: 1200px) 33vw, 25vw"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIRAAAgIBAwUBAAAAAAAAAAAAAwQBAgAFBhESEyExQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAAFBv/EABoRAAICAwAAAAAAAAAAAAAAAAECAAMEESH/2gAMAwEAAhEDEEAAAAGqpnWZZMmf/9k="
                unoptimized={useUnoptimized}
                onError={onImageError}
            />
        </div>
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
    const isLocalImage = product.image?.startsWith('/') && !product.image?.startsWith('//');

    return (
        <m.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="group flex cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:shadow-lg"
            onClick={() => onProductClick?.(product.id)}
        >
            {/* 图片 */}
            <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden bg-white/5">
                {!imageError ? (
                    <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="128px"
                        unoptimized={isLocalImage}
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                        <ShoppingCart className="h-8 w-8" />
                    </div>
                )}
            </div>

            {/* 内容 */}
            <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                        {product.category}
                    </span>
                    <h4 className="mt-0.5 text-sm font-semibold text-white line-clamp-1">
                        {product.name}
                    </h4>
                    <p className="mt-1 text-xs text-white/70 line-clamp-2">
                        {product.reason}
                    </p>
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{product.price}</span>
                </div>
            </div>
        </m.div>
    );
}

export default ProductCard;
