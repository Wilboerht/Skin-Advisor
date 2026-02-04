"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import { isInWishlist, addToWishlist, removeFromWishlist } from "@/lib/wishlist";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
    productId: string;
    className?: string;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
    onToggle?: (isWishlisted: boolean) => void;
    onLoginRequired?: () => void;
}

export function WishlistButton({
    productId,
    className,
    size = "md",
    showLabel = false,
    onToggle,
    onLoginRequired
}: WishlistButtonProps) {
    const { user } = useAuth();
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // 检查初始状态（只有登录用户才检查）
    useEffect(() => {
        if (user) {
            setIsWishlisted(isInWishlist(productId));
        } else {
            setIsWishlisted(false);
        }

        // 监听心愿单更新事件
        const handleUpdate = (e: CustomEvent) => {
            if (user && (e.detail.productId === productId || e.detail.action === 'clear')) {
                setIsWishlisted(isInWishlist(productId));
            }
        };

        window.addEventListener('wishlist-updated', handleUpdate as EventListener);
        return () => {
            window.removeEventListener('wishlist-updated', handleUpdate as EventListener);
        };
    }, [productId, user]);

    const handleClick = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 未登录用户点击时提示登录
        if (!user) {
            onLoginRequired?.();
            return;
        }

        setIsAnimating(true);
        setIsSyncing(true);

        const newState = !isWishlisted;

        try {
            if (newState) {
                // 添加到心愿单
                addToWishlist(productId);
                // 同步到服务器
                await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId, userId: user.id })
                });
            } else {
                // 从心愿单移除
                removeFromWishlist(productId);
                // 同步到服务器
                await fetch(`/api/wishlist?productId=${productId}&userId=${user.id}`, {
                    method: 'DELETE'
                });
            }
            setIsWishlisted(newState);
            onToggle?.(newState);
        } catch (error) {
            console.error('Wishlist sync error:', error);
            // 回滚本地状态
            if (newState) {
                removeFromWishlist(productId);
            } else {
                addToWishlist(productId);
            }
        } finally {
            setIsSyncing(false);
            setTimeout(() => setIsAnimating(false), 300);
        }
    }, [productId, user, isWishlisted, onToggle, onLoginRequired]);

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
            disabled={isSyncing}
            className={cn(
                "group relative flex items-center justify-center rounded-full transition-all duration-200",
                "hover:bg-red-50 active:scale-95",
                "focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-wait",
                sizeClasses[size],
                className
            )}
            aria-label={!user ? "登录后可收藏" : isWishlisted ? "从心愿单移除" : "添加到心愿单"}
            title={!user ? "登录后可收藏" : isWishlisted ? "从心愿单移除" : "添加到心愿单"}
        >
            <Heart
                size={iconSizes[size]}
                className={cn(
                    "transition-all duration-200",
                    isWishlisted
                        ? "fill-red-500 text-red-500"
                        : !user
                            ? "fill-transparent text-gray-300"
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
                    {!user ? "登录收藏" : isWishlisted ? "已收藏" : "收藏"}
                </span>
            )}
        </button>
    );
}

export default WishlistButton;
