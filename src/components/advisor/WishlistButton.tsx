"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import { isInWishlist, toggleWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
    productId: string;
    className?: string;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
    onToggle?: (isWishlisted: boolean) => void;
}

export function WishlistButton({
    productId,
    className,
    size = "md",
    showLabel = false,
    onToggle
}: WishlistButtonProps) {
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // 检查初始状态
    useEffect(() => {
        setIsWishlisted(isInWishlist(productId));

        // 监听心愿单更新事件
        const handleUpdate = (e: CustomEvent) => {
            if (e.detail.productId === productId || e.detail.action === 'clear') {
                setIsWishlisted(isInWishlist(productId));
            }
        };

        window.addEventListener('wishlist-updated', handleUpdate as EventListener);
        return () => {
            window.removeEventListener('wishlist-updated', handleUpdate as EventListener);
        };
    }, [productId]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsAnimating(true);
        const newState = toggleWishlist(productId);
        setIsWishlisted(newState);
        onToggle?.(newState);

        // 动画结束后重置
        setTimeout(() => setIsAnimating(false), 300);
    }, [productId, onToggle]);

    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-10 h-10"
    };

    const iconSizes = {
        sm: 14,
        md: 18,
        lg: 22
    };

    return (
        <button
            onClick={handleClick}
            className={cn(
                "group relative flex items-center justify-center rounded-full transition-all duration-200",
                "hover:bg-red-50 active:scale-95",
                "focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2",
                sizeClasses[size],
                className
            )}
            aria-label={isWishlisted ? "从心愿单移除" : "添加到心愿单"}
            title={isWishlisted ? "从心愿单移除" : "添加到心愿单"}
        >
            <Heart
                size={iconSizes[size]}
                className={cn(
                    "transition-all duration-200",
                    isWishlisted
                        ? "fill-red-500 text-red-500"
                        : "fill-transparent text-gray-400 group-hover:text-red-400",
                    isAnimating && "scale-125"
                )}
            />

            {/* 点击动画效果 */}
            {isAnimating && isWishlisted && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="absolute w-full h-full rounded-full bg-red-100 animate-ping opacity-50" />
                </span>
            )}

            {showLabel && (
                <span className={cn(
                    "ml-1 text-xs font-medium",
                    isWishlisted ? "text-red-500" : "text-gray-500"
                )}>
                    {isWishlisted ? "已收藏" : "收藏"}
                </span>
            )}
        </button>
    );
}

export default WishlistButton;
