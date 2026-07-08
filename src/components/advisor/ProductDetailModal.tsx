"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { m, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "./ProductCard";
import { getProductLinks, openAffiliateLink } from "@/lib/affiliate-links";
import { PlatformIcon } from "./PlatformIcon";

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: ProductCardData | null;
}

export function ProductDetailModal({ isOpen, onClose, product }: ProductDetailModalProps) {
    const [mounted, setMounted] = useState(false);
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    // 合并主图 + 图库为完整图片列表
    const galleryImages = useMemo(() => {
        if (!product) return [];
        const imgs: string[] = [];
        if (product.image) imgs.push(product.image);
        if (product.images && product.images.length > 0) {
            for (const img of product.images) {
                if (img && img !== product.image && !imgs.includes(img)) {
                    imgs.push(img);
                }
            }
        }
        return imgs;
    }, [product]);

    // 重置索引
    useEffect(() => {
        setActiveImageIndex(0);
    }, [product?.id]);

    const hasMultipleImages = galleryImages.length > 1;

    const goToPrev = useCallback(() => {
        setActiveImageIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1));
    }, [galleryImages.length]);

    const goToNext = useCallback(() => {
        setActiveImageIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1));
    }, [galleryImages.length]);

    // 触摸滑动手势
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        // 仅水平滑动超过 50px 且大于垂直滑动时触发翻页
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) goToPrev();
            else goToNext();
        }
    }, [goToPrev, goToNext]);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const toggleAccordion = (id: string) => {
        setOpenAccordion(openAccordion === id ? null : id);
    };

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    useEffect(() => {
        if (!isOpen) setOpenAccordion(null);
    }, [isOpen]);

    if (!mounted || !product) return null;

    const allLinks = getProductLinks(product.affiliateLinks);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
                    {/* Backdrop */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                    />

                    {/* Modal Card */}
                    <m.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -12 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="relative flex max-h-[85vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[22px] bg-[#FAF6F0] shadow-2xl lg:h-[680px] lg:max-h-[720px] lg:flex-row"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#3d2f25] shadow-sm transition-all hover:bg-white hover:scale-105 lg:right-5 lg:top-5"
                            aria-label="关闭"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Left - Image Gallery */}
                        <div
                            className="relative aspect-square w-full flex-shrink-0 bg-[#F5F0E8] lg:h-full lg:w-[45%] lg:aspect-auto"
                            onTouchStart={handleTouchStart}
                            onTouchEnd={handleTouchEnd}
                        >
                            {galleryImages.length > 0 ? (
                                <>
                                    <Image
                                        src={galleryImages[activeImageIndex]}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 1024px) 100vw, 42vw"
                                        quality={90}
                                        priority
                                        unoptimized={galleryImages[activeImageIndex]?.startsWith('/') || galleryImages[activeImageIndex]?.startsWith('https://')}
                                    />
                                    {/* 左右翻页按钮 */}
                                    {hasMultipleImages && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={goToPrev}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#3d2f25] shadow-sm hover:bg-white hover:scale-105 transition-all"
                                                aria-label="上一张"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={goToNext}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#3d2f25] shadow-sm hover:bg-white hover:scale-105 transition-all"
                                                aria-label="下一张"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {/* 缩略图指示器 */}
                                    {hasMultipleImages && (
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                            {galleryImages.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setActiveImageIndex(idx)}
                                                    className={cn(
                                                        "w-2 h-2 rounded-full transition-all",
                                                        idx === activeImageIndex
                                                            ? "bg-white shadow-sm w-5"
                                                            : "bg-white/50 hover:bg-white/70"
                                                    )}
                                                    aria-label={`查看第 ${idx + 1} 张图`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center text-[#8c7a6b]/50">
                                    <span className="text-sm">暂无图片</span>
                                </div>
                            )}
                        </div>

                        {/* Right - Product Info */}
                        <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-8 no-scrollbar">
                            {/* Category */}
                            <div className="mb-3">
                                <span className="inline-block rounded-full bg-[#3d2f25]/8 px-3 py-1 text-[11px] font-medium text-[#5c4937]">
                                    {product.category}
                                </span>
                            </div>

                            {/* Product Name */}
                            <h2 className="mb-0.5 text-[24px] font-bold leading-snug text-[#3d2f25] lg:text-[28px]">
                                {product.name}
                            </h2>

                            {/* Price */}
                            <div className="mb-4 text-lg font-bold text-[#3d2f25]">
                                ¥ {product.price || "咨询价格"}
                            </div>

                            {/* Reason */}
                            <section className="mb-4">
                                <p className="text-[15px] leading-[1.7] text-[#5c4937]">
                                    {product.reason}
                                </p>
                            </section>

                            {/* 小红书链接 */}
                            <section className="mb-5">
                                {(() => {
                                    const keyword = `nihplod ${product.category}`;
                                    const encodedKeyword = encodeURIComponent(keyword);
                                    const webUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodedKeyword}`;
                                    const schemeUrl = `xhsdiscover://search/result?keyword=${encodedKeyword}`;
                                    const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                                    return (
                                        <>
                                            <a
                                                href={isMobile ? schemeUrl : webUrl}
                                                target={isMobile ? undefined : "_blank"}
                                                rel="noopener noreferrer"
                                                className="group inline-flex items-center gap-2 text-[14px] text-[#3d2f25] transition-opacity hover:opacity-60"
                                            >
                                                <span>去小红书了解更多</span>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-hover:translate-x-1">
                                                    <path d="M5 12h14" />
                                                    <path d="m12 5 7 7-7 7" />
                                                </svg>
                                            </a>
                                            {isMobile && (
                                                <p className="mt-1.5 text-[11px] text-[#8c7a6b]/60">
                                                    若未唤起小红书App，请手动搜索「{keyword}」
                                                </p>
                                            )}
                                        </>
                                    );
                                })()}
                            </section>

                            {/* Accordions */}
                            <section className="border-t border-[#3d2f25]/8">
                                {/* Key Ingredients */}
                                {product.keyIngredients && product.keyIngredients.length > 0 && (
                                    <div className="border-b border-[#3d2f25]/8">
                                        <button
                                            type="button"
                                            onClick={() => toggleAccordion("ingredients")}
                                            className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[14px] font-semibold text-[#3d2f25]"
                                        >
                                            <span>核心成分</span>
                                            <span className={cn(
                                                "text-[18px] transition-transform duration-200 text-[#8c7a6b]",
                                                openAccordion === "ingredients" && "rotate-45"
                                            )}>+</span>
                                        </button>
                                        <AnimatePresence>
                                            {openAccordion === "ingredients" && (
                                                <m.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <p className="pb-4 text-[15px] text-[#5c4937]">
                                                        {product.keyIngredients.join("、")}
                                                    </p>
                                                </m.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Benefits */}
                                {product.benefits && product.benefits.length > 0 && (
                                    <div className="border-b border-[#3d2f25]/8">
                                        <button
                                            type="button"
                                            onClick={() => toggleAccordion("benefits")}
                                            className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[14px] font-semibold text-[#3d2f25]"
                                        >
                                            <span>主要功效</span>
                                            <span className={cn(
                                                "text-[18px] transition-transform duration-200 text-[#8c7a6b]",
                                                openAccordion === "benefits" && "rotate-45"
                                            )}>+</span>
                                        </button>
                                        <AnimatePresence>
                                            {openAccordion === "benefits" && (
                                                <m.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <p className="pb-4 text-[15px] text-[#5c4937]">
                                                        {product.benefits.join("、")}
                                                    </p>
                                                </m.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* How to Use */}
                                {product.howToUse && (
                                    <div className="border-b border-[#3d2f25]/8">
                                        <button
                                            type="button"
                                            onClick={() => toggleAccordion("usage")}
                                            className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[14px] font-semibold text-[#3d2f25]"
                                        >
                                            <span>使用方法</span>
                                            <span className={cn(
                                                "text-[18px] transition-transform duration-200 text-[#8c7a6b]",
                                                openAccordion === "usage" && "rotate-45"
                                            )}>+</span>
                                        </button>
                                        <AnimatePresence>
                                            {openAccordion === "usage" && (
                                                <m.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <p className="pb-4 text-[15px] leading-[1.7] text-[#5c4937]">
                                                        {product.howToUse}
                                                    </p>
                                                </m.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Purchase Links */}
                                <div className="pt-4">
                                    <div className="mb-4 text-[14px] font-semibold text-[#3d2f25]">官方旗舰店</div>
                                    <div className="flex flex-wrap gap-4">
                                        {allLinks.length > 0 ? (
                                            allLinks.map((link) => (
                                                <a
                                                    key={link.platform}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="transition-opacity hover:opacity-60"
                                                >
                                                    <PlatformIcon platform={link.config.name} />
                                                </a>
                                            ))
                                        ) : (
                                            <span className="text-[12px] text-[#8c7a6b]">暂无购买链接</span>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </m.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
