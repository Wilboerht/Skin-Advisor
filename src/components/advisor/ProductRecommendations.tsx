"use client";

import { Link } from "next-view-transitions";
import { m } from "framer-motion";
import { ArrowRight, Star, ShoppingBag } from "lucide-react";

interface Product {
    id: string;
    name: string;
    nameEn?: string;
    category: string;
    reason: string;
    image: string;
    price?: string;
}

interface ProductRecommendationsProps {
    products: Product[];
}

export function ProductRecommendations({ products }: ProductRecommendationsProps) {
    if (!products || products.length === 0) return null;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* 标题 */}
            <div className="flex items-center gap-2 px-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/10">
                    <Star className="h-3.5 w-3.5 text-brand-gold" />
                </div>
                <h3 className="font-serif text-base font-light tracking-wide text-brand-charcoal">
                    为您甄选的护肤方案
                </h3>
            </div>

            {/* 产品列表 */}
            <div className="grid gap-4 sm:grid-cols-2">
                {products.map((product, index) => (
                    <m.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-brand-beige/50 bg-white shadow-sm transition-all hover:border-brand-gold/30 hover:shadow-md"
                    >
                        <div className="flex flex-1 gap-4 p-4">
                            {/* 产品图片 */}
                            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-brand-cream/50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                            </div>

                            {/* 产品信息 */}
                            <div className="flex flex-1 flex-col justify-between">
                                <div>
                                    <div className="mb-1 text-xs text-brand-charcoal/40">{product.category}</div>
                                    <h4 className="mb-1 font-medium text-brand-charcoal">{product.name}</h4>
                                    {product.nameEn && (
                                        <p className="mb-2 text-xs font-light tracking-wide text-brand-charcoal/40 font-serif">
                                            {product.nameEn}
                                        </p>
                                    )}
                                </div>

                                {product.reason && (
                                    <div className="mt-2 rounded-lg bg-brand-gold/5 p-2 text-xs text-brand-charcoal/70">
                                        💡 <span className="text-brand-gold">推荐理由：</span>{product.reason}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 底部操作栏 */}
                        <div className="flex items-center justify-between border-t border-brand-beige/30 bg-brand-cream/30 px-4 py-3">
                            <span className="text-sm font-medium text-brand-charcoal">{product.price || "咨询客服"}</span>
                            <Link
                                href={`/products/${product.id}`}
                                className="flex items-center gap-1 text-xs text-brand-gold transition-colors hover:text-brand-gold-dark"
                            >
                                查看详情 <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </m.div>
                ))}
            </div>
        </div>
    );
}
