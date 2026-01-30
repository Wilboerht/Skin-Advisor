"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Link } from "next-view-transitions";
import { m, AnimatePresence } from "framer-motion";
import {
    Heart,
    Trash2,
    ShoppingCart,
    ChevronLeft,
    ExternalLink,
    Package,
    AlertCircle,
    Share2
} from "lucide-react";
import {
    getWishlistProductIds,
    removeFromWishlist,
    clearWishlist,
    getGuestId,
    fetchWishlistFromServer,
    type WishlistItem
} from "@/lib/wishlist";
import { useAuth } from "@/hooks/useAuth";
import {
    getProductLinks,
    openAffiliateLink,
    ECOMMERCE_PLATFORMS,
    EcommercePlatform
} from "@/lib/affiliate-links";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface WishlistProduct {
    id: string;
    name: string;
    nameEn?: string | null;
    category: string;
    image: string;
    price: string;
    description?: string;
    step?: string | null;
    affiliateLinks?: Record<string, string> | null;
}

export default function WishlistPage() {
    const { user } = useAuth();
    const router = useRouter();
    const toast = useToast();
    const [products, setProducts] = useState<WishlistProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [removing, setRemoving] = useState<string | null>(null);

    // 加载心愿单产品
    const loadWishlist = useCallback(async () => {
        setLoading(true);
        try {
            let productIds = getWishlistProductIds();

            // 如果已登录，合并服务端数据
            if (user?.id) {
                const serverItems = await fetchWishlistFromServer({ userId: user.id });
                if (serverItems.length > 0) {
                    const serverIds = serverItems.map((i: WishlistItem) => i.productId);
                    // 合并去重
                    productIds = Array.from(new Set([...productIds, ...serverIds]));
                }
            }

            if (productIds.length === 0) {
                setProducts([]);
                setLoading(false);
                return;
            }

            // 从 API 获取产品详情
            const response = await fetch('/api/admin/products');
            if (response.ok) {
                const allProducts: WishlistProduct[] = await response.json();
                const wishlistProducts = allProducts.filter(p => productIds.includes(p.id));
                // 保持心愿单顺序（这里暂时简单用 ID 顺序，优化可用 addedAt）
                setProducts(wishlistProducts);
            }
        } catch (error) {
            console.error('Failed to load wishlist:', error);
            // toast.error('加载心愿单失败'); // 避免轻微网络错误干扰体验
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadWishlist();

        // 监听心愿单更新
        const handleUpdate = () => loadWishlist();
        window.addEventListener('wishlist-updated', handleUpdate);
        return () => window.removeEventListener('wishlist-updated', handleUpdate);
    }, [loadWishlist]);

    // 移除产品
    const handleRemove = useCallback((productId: string) => {
        setRemoving(productId);
        setTimeout(() => {
            removeFromWishlist(productId);
            setProducts(prev => prev.filter(p => p.id !== productId));
            setRemoving(null);
            toast.success('已从心愿单移除');
        }, 300);
    }, [toast]);

    // 清空心愿单
    const handleClearAll = useCallback(() => {
        if (confirm('确定要清空心愿单吗？')) {
            clearWishlist();
            setProducts([]);
            toast.success('心愿单已清空');
        }
    }, [toast]);

    // 购买产品
    const handleBuy = useCallback((product: WishlistProduct, platform?: EcommercePlatform) => {
        const links = getProductLinks(product.affiliateLinks);
        if (links.length === 0) {
            router.push(`/products/${product.id}`);
            return;
        }

        const link = platform
            ? links.find(l => l.platform === platform)
            : links[0];

        if (link) {
            openAffiliateLink(link.url, product.id, link.platform);
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">返回</span>
                    </button>

                    <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                        我的心愿单
                    </h1>

                    <div className="w-16" /> {/* Spacer for centering */}
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    // 加载状态
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex gap-4">
                                <div className="w-24 h-24 bg-gray-100 rounded-lg" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                                    <div className="h-5 bg-gray-100 rounded w-2/3" />
                                    <div className="h-4 bg-gray-100 rounded w-1/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    // 空状态
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <Heart className="w-10 h-10 text-gray-300" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">心愿单是空的</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            浏览产品时点击 ❤️ 收藏喜欢的产品
                        </p>
                        <Link
                            href="/result"
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
                        >
                            <Package className="w-4 h-4" />
                            查看推荐产品
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* 操作栏 */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-500">
                                共 {products.length} 件商品
                            </span>
                            <button
                                onClick={handleClearAll}
                                className="text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                清空
                            </button>
                        </div>

                        {/* 产品列表 */}
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {products.map((product, index) => (
                                    <m.div
                                        key={product.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{
                                            opacity: removing === product.id ? 0.5 : 1,
                                            y: 0,
                                            scale: removing === product.id ? 0.95 : 1
                                        }}
                                        exit={{ opacity: 0, x: -100 }}
                                        transition={{ duration: 0.2, delay: index * 0.05 }}
                                        className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex">
                                            {/* 产品图片 */}
                                            <Link
                                                href={`/products/${product.id}`}
                                                className="relative w-28 h-28 flex-shrink-0 bg-gray-50"
                                            >
                                                <Image
                                                    src={product.image}
                                                    alt={product.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="112px"
                                                />
                                            </Link>

                                            {/* 产品信息 */}
                                            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                        {product.category}
                                                    </span>
                                                    <Link href={`/products/${product.id}`}>
                                                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors">
                                                            {product.name}
                                                        </h3>
                                                    </Link>
                                                </div>

                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {product.price}
                                                    </span>

                                                    <div className="flex items-center gap-2">
                                                        {/* 删除按钮 */}
                                                        <button
                                                            onClick={() => handleRemove(product.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                            title="移除"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>

                                                        {/* 购买按钮 */}
                                                        <button
                                                            onClick={() => handleBuy(product)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full hover:bg-gray-800 transition-colors"
                                                        >
                                                            <ShoppingCart className="w-3.5 h-3.5" />
                                                            去购买
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 电商平台选择 (如果有多个链接) */}
                                        {product.affiliateLinks && Object.keys(product.affiliateLinks).length > 1 && (
                                            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400 uppercase tracking-wider">购买渠道:</span>
                                                <div className="flex gap-1.5">
                                                    {getProductLinks(product.affiliateLinks).map(link => (
                                                        <button
                                                            key={link.platform}
                                                            onClick={() => handleBuy(product, link.platform)}
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors hover:opacity-80"
                                                            style={{
                                                                backgroundColor: link.config.bgColor,
                                                                color: link.config.color
                                                            }}
                                                        >
                                                            {link.config.icon} {link.config.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </m.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* 底部提示 */}
                        <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-medium mb-1">温馨提示</p>
                                <p className="text-amber-700">
                                    心愿单数据已保存在本地，登录后可同步到云端，跨设备查看。
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
