"use client";
import React from "react";

import { m, AnimatePresence } from "framer-motion";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayout } from "@/contexts/LayoutContext";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { 
    ShopIcon, 
    RitualIcon, 
    FAQIcon, 
    StoryIcon, 
    HomeIcon 
} from "@/components/website/NavIcons";

/**
 * 导航项配置
 */
interface NavItem {
    href: string;
    label: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
}

const allNavItems: NavItem[] = [
    { href: "/products", label: "探索产品", labelEn: "Products", icon: ShopIcon },
    { href: "/guide", label: "官方指南", labelEn: "Guide", icon: RitualIcon },
    { href: "/faq", label: "常见问题", labelEn: "FAQ", icon: FAQIcon },
    { href: "/about", label: "关于旎柏", labelEn: "About", icon: StoryIcon },
    { href: "/", label: "首页", labelEn: "Home", icon: HomeIcon },
];

/**
 * 底部导航栏组件 - 全局单例
 * 复刻自 nihplod.cn，包含样式、功能、动画
 */
export function BottomNavBar() {
    const pathname = usePathname();
    const { isDrawerOpen, setDrawerOpen, isNavMenuOpen, setNavMenuOpen } = useLayout();
    const { isOpen: isAuthModalOpen } = useAuthModal();

    const currentPage = allNavItems.find(item => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)))?.href || "/";

    const primaryNav = allNavItems.find(item => item.href === currentPage) || allNavItems[4];
    const otherNavItems = allNavItems.filter(item => item.href !== currentPage);

    const handleNavClick = (href: string, e: React.MouseEvent) => {
        const isCurrentPage = href === currentPage || (href !== "/" && pathname.startsWith(href));
        if (isCurrentPage) {
            e.preventDefault();
            setDrawerOpen(true);
        }
    };

    const PrimaryIcon = primaryNav.icon;

    // 当抽屉展开或登录弹窗激活时，隐藏导航栏
    const isVisible = !isDrawerOpen && !isAuthModalOpen;

    return (
        <>
            {/* 移动端菜单遮罩层 */}
            <AnimatePresence>
                {isNavMenuOpen && isVisible && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
                        onClick={() => setNavMenuOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* 底部导航栏 - 抽屉展开时平滑滑出 */}
            <AnimatePresence>
                {isVisible && (
                    <m.header
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{
                            duration: 0.6,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                        className="fixed bottom-4 left-0 right-0 z-50 mx-auto w-full max-w-[95%] pointer-events-none lg:bottom-6 lg:max-w-[700px] xl:max-w-[800px] 2xl:max-w-[1200px]"
                        role="banner"
                    >
                        {/* 移动端弹出菜单 */}
                        <AnimatePresence>
                            {isNavMenuOpen && (
                                <m.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                    className="absolute bottom-[calc(100%+12px)] right-0 z-50 w-48 rounded-[20px] bg-[#F0EDE1]/95 p-2 shadow-2xl backdrop-blur-xl pointer-events-auto lg:hidden border border-brand-gold/10"
                                >
                                    <div className="flex flex-col gap-1.5">
                                        {otherNavItems.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setNavMenuOpen(false)}
                                                    className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-all active:scale-[0.97] active:bg-brand-beige/20 bg-transparent"
                                                >
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/5 shadow-inner">
                                                        <Icon className="h-5 w-5 text-brand-gold" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold tracking-wide text-brand-charcoal">{item.label}</span>
                                                        <span className="font-serif text-[10px] uppercase tracking-widest text-brand-gold/50">{item.labelEn}</span>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </m.div>
                            )}
                        </AnimatePresence>
                        <nav
                            className={cn(
                                "flex items-center justify-between pointer-events-auto",
                                "rounded-2xl bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-md",
                                "lg:rounded-[20px] lg:bg-[#F0EDE1] lg:px-10 lg:py-0 lg:h-[100px]",
                                "lg:shadow-[0_20px_50px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.8)]",
                                "lg:backdrop-blur-none"
                            )}
                            aria-label="主要导航"
                        >
                            {/* 移动端左侧主导航 */}
                            <Link
                                href={primaryNav.href}
                                onClick={(e) => handleNavClick(primaryNav.href, e)}
                                className="group flex items-center gap-2 transition-opacity active:opacity-70 lg:hidden"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gold/10">
                                    <PrimaryIcon className="h-6 w-6 text-brand-gold" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-brand-charcoal">
                                        {primaryNav.label}
                                    </span>
                                    <span className="font-serif text-[10px] uppercase tracking-wide text-brand-gold/70">
                                        {primaryNav.labelEn}
                                    </span>
                                </div>
                            </Link>

                            {/* 桌面端左侧固定导航 (Story) */}
                            {(() => {
                                const storyItem = allNavItems.find(item => item.href === "/about")!;
                                const Icon = storyItem.icon;

                                return (
                                    <div className="hidden items-center gap-8 lg:flex">
                                        <Link
                                            href={storyItem.href}
                                            onClick={(e) => handleNavClick(storyItem.href, e)}
                                            className="group flex items-center gap-3 px-2 transition-opacity duration-300 hover:opacity-70"
                                        >
                                            <Icon className="h-9 w-9 text-brand-gold transition-transform duration-500 group-hover:scale-105" />
                                            <span className="font-serif text-[18px] font-medium tracking-wide text-brand-charcoal">
                                                关于旎柏
                                            </span>
                                        </Link>
                                        <div className="h-10 w-px bg-brand-charcoal/15" />
                                    </div>
                                );
                            })()}

                            {/* 移动端：菜单按钮 */}
                            <button
                                type="button"
                                onClick={() => setNavMenuOpen(!isNavMenuOpen)}
                                className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-beige/30 transition-colors active:bg-brand-beige/50 lg:hidden"
                                aria-label={isNavMenuOpen ? "关闭菜单" : "打开菜单"}
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    {isNavMenuOpen ? (
                                        <m.div
                                            key="close"
                                            initial={{ opacity: 0, rotate: -90 }}
                                            animate={{ opacity: 1, rotate: 0 }}
                                            exit={{ opacity: 0, rotate: 90 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <X className="h-5 w-5 text-brand-charcoal" />
                                        </m.div>
                                    ) : (
                                        <m.div
                                            key="menu"
                                            initial={{ opacity: 0, rotate: 90 }}
                                            animate={{ opacity: 1, rotate: 0 }}
                                            exit={{ opacity: 0, rotate: -90 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <Menu className="h-5 w-5 text-brand-charcoal" />
                                        </m.div>
                                    )}
                                </AnimatePresence>
                            </button>

                            {/* 桌面端右侧固定导航列表 */}
                            <div className="hidden items-center gap-3 lg:flex lg:gap-[40px]">
                                {allNavItems.filter(item => item.href !== "/about").map((item) => {
                                    const Icon = item.icon;
                                    const isHome = item.href === "/";

                                    return (
                                        <React.Fragment key={item.href}>
                                            {isHome && (
                                                <div className="h-10 w-px bg-black/20" />
                                            )}
                                            <Link
                                                href={item.href}
                                                onClick={(e) => handleNavClick(item.href, e)}
                                                className={cn(
                                                    "group flex flex-col items-center gap-1 py-2 text-[15px] font-medium text-[#1a1a1a] transition-all duration-[600ms] ease-[cubic-bezier(0.19,1,0.22,1)]",
                                                    "hover:opacity-70"
                                                )}
                                            >
                                                <Icon className="h-8 w-8 text-[#C3BC9F] transition-all duration-[600ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-y-[-2px] group-hover:text-brand-gold" />
                                                <span>
                                                    {item.label}
                                                </span>
                                            </Link>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </nav>
                    </m.header>
                )}
            </AnimatePresence>
        </>
    );
}
