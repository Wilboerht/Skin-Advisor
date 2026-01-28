"use client";

import { useState, useEffect } from "react";
import { Link } from "next-view-transitions";
import { Heart } from "lucide-react";
import { getWishlistCount } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

interface WishlistNavButtonProps {
    className?: string;
    showCount?: boolean;
}

export function WishlistNavButton({ className, showCount = true }: WishlistNavButtonProps) {
    const [count, setCount] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        // 初始化
        setCount(getWishlistCount());

        // 监听更新
        const handleUpdate = (e: CustomEvent) => {
            const newCount = getWishlistCount();

            if (e.detail.action === 'add') {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 300);
            }

            setCount(newCount);
        };

        window.addEventListener('wishlist-updated', handleUpdate as EventListener);
        return () => {
            window.removeEventListener('wishlist-updated', handleUpdate as EventListener);
        };
    }, []);

    return (
        <Link
            href="/wishlist"
            className={cn(
                "relative flex items-center justify-center p-2 rounded-full",
                "hover:bg-gray-100 transition-colors",
                className
            )}
            title="我的心愿单"
        >
            <Heart
                className={cn(
                    "w-5 h-5 transition-all duration-200",
                    count > 0 ? "text-red-500 fill-red-500" : "text-gray-500",
                    isAnimating && "scale-125"
                )}
            />

            {/* 数量徽章 */}
            {showCount && count > 0 && (
                <span className={cn(
                    "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center",
                    "px-1 text-[10px] font-bold text-white bg-red-500 rounded-full",
                    "transition-transform duration-200",
                    isAnimating && "scale-110"
                )}>
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </Link>
    );
}

export default WishlistNavButton;
