"use client";

import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { m, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = "hidden";
            document.body.style.paddingRight = `${scrollbarWidth}px`;
            document.addEventListener("keydown", handleKeyDown);
        } else {
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
        }
        return () => {
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
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
                        transition={{ duration: 0.25 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                    />

                    {/* Modal Card */}
                    <m.div
                        initial={{ opacity: 0, scale: 0.94, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="relative flex max-h-[85vh] w-full max-w-[960px] flex-col overflow-hidden rounded-[22px] bg-[#FAF6F0] shadow-2xl lg:h-[580px] lg:max-h-[600px] lg:flex-row"
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

                        {/* Left - Image */}
                        <div className="relative h-[36%] w-full flex-shrink-0 bg-[#F0EBE3] lg:h-full lg:w-[45%]">
                            {product.image ? (
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1024px) 100vw, 42vw"
                                    quality={90}
                                    priority
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-[#8c7a6b]/50">
                                    <span className="text-sm">暂无图片</span>
                                </div>
                            )}
                        </div>

                        {/* Right - Product Info */}
                        <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-8 scrollbar-none">
                            {/* Category */}
                            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-[#8c7a6b]">
                                {product.category}
                            </div>

                            {/* Product Name */}
                            <h2 className="mb-0.5 text-[24px] font-bold leading-snug text-[#3d2f25] lg:text-[28px]">
                                {product.name}
                            </h2>
                            {product.nameEn && (
                                <p className="mb-3 text-[11px] text-[#8c7a6b] tracking-wide">{product.nameEn}</p>
                            )}

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
                                                    <p className="pb-4 text-[13px] leading-[1.7] text-[#5c4937]">
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
