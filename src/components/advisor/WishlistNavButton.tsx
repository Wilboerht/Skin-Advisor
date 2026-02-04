"use client";

import { useState, useEffect } from "react";
import { Link } from "next-view-transitions";
import { Heart } from "lucide-react";
import { getWishlistCount, fetchWishlistFromServer, type WishlistItem } from "@/lib/wishlist";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface WishlistNavButtonProps {
    className?: string;
    showCount?: boolean;
}

export function WishlistNavButton({ className, showCount = true }: WishlistNavButtonProps) {
    const { user } = useAuth();
    const [count, setCount] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!user?.id) {
            setCount(0);
            return;
        }

        // 从服务器获取心愿单数量
        const loadCount = async () => {
            try {
                const items = await fetchWishlistFromServer({ userId: user.id });
                setCount(items.length);
            } catch (e) {
                console.error('Failed to load wishlist count:', e);
                setCount(0);
            }
        };

        loadCount();

        // 监听更新
        const handleUpdate = (e: CustomEvent) => {
            if (e.detail.action === 'add') {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 300);
                setCount(prev => prev + 1);
            } else if (e.detail.action === 'remove') {
                setCount(prev => Math.max(0, prev - 1));
            } else if (e.detail.action === 'clear') {
                setCount(0);
            } else {
                // Reload from server for other actions
                loadCount();
            }
        };

        window.addEventListener('wishlist-updated', handleUpdate as EventListener);
        return () => {
            window.removeEventListener('wishlist-updated', handleUpdate as EventListener);
        };
    }, [user]);

    // 未登录用户不显示此按钮
    if (!user) {
        return null;
    }

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
