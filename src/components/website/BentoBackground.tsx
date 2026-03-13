"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Link } from "next-view-transitions";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useLayout } from "@/contexts/LayoutContext";
import { BookUser, ChevronRight, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Bento Grid 便当盒背景组件 (nihplod.cn 完全复刻版)
 */
export function BentoBackground() {
    const { showBento } = useLayout();
    const pathname = usePathname();
    const isHomepage = pathname === "/";
    const containerRef = useRef<HTMLDivElement>(null);
    const cellsRef = useRef<HTMLDivElement[]>([]);
    const { user, logout } = useAuth();
    const { openAuthModal } = useAuthModal();

    useEffect(() => {
        const container = containerRef.current;
        const cells = cellsRef.current;
        if (!container || cells.length === 0 || !showBento) return;

        const handleMouseMove = (e: MouseEvent) => {
            const x = e.clientX / window.innerWidth - 0.5;
            const y = e.clientY / window.innerHeight - 0.5;

            cells.forEach((cell, index) => {
                if (!cell) return;
                const factor = (index + 1) * 1.5;
                cell.style.transform = `
                    translate(${x * factor}px, ${y * factor}px) 
                    rotateX(${-y * 4}deg) 
                    rotateY(${x * 4}deg)
                `;
            });
        };

        const handleMouseLeave = () => {
            cells.forEach((cell) => {
                if (!cell) return;
                cell.style.transform = 'translate(0, 0) rotateX(0) rotateY(0)';
            });
        };

        const mediaQuery = window.matchMedia('(min-width: 768px) and (hover: hover)');
        if (mediaQuery.matches) {
            container.addEventListener('mousemove', handleMouseMove);
            container.addEventListener('mouseleave', handleMouseLeave);
        }

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [showBento]);

    const addCellRef = (el: HTMLDivElement | null, index: number) => {
        if (el) cellsRef.current[index] = el;
    };

    const handleLoginClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openAuthModal('login');
    };

    return (
        <AnimatePresence>
            {showBento && isHomepage && (
                <motion.div
                    key="bento-bg"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed inset-0 z-[6] overflow-hidden pointer-events-none"
                >
                    <div ref={containerRef} className="kinetic-container pointer-events-none [&>*]:pointer-events-auto">
                        {/* 左侧大卡片 - 跨两行 */}
                        <div
                            ref={(el) => addCellRef(el, 0)}
                            className="kinetic-cell kinetic-cell-large kinetic-image-cell group cursor-pointer"
                        >
                            <Link href="#" className="absolute inset-0 z-20" aria-label="了解产品" />
                            <Image
                                src="https://wp-cdn.4ce.cn/v2/vmQtAla.jpeg"
                                alt="Brand Story"
                                fill
                                className="kinetic-cell-image transition-all duration-500 group-hover:grayscale-0"
                                sizes="(max-width: 600px) 100vw, 30vw"
                            />
                            <div className="absolute inset-0 z-10 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-black/20 pointer-events-none">
                                <span className="text-white text-2xl font-bold tracking-[0.25em] border-b-2 border-white/60 pb-1.5">探索产品</span>
                            </div>
                        </div>

                        {/* Row 1, Col 2: 文字卡 */}
                        <div
                            ref={(el) => addCellRef(el, 1)}
                            className="kinetic-cell kinetic-text-cell kinetic-cell-yellow"
                        >
                            <div className="kinetic-name" style={{ marginBottom: '12px', lineHeight: '1.3' }}>更少步骤<br />更多呵护</div>
                            <div className="kinetic-desc" style={{ fontSize: '13px', lineHeight: '1.5', letterSpacing: '0.05em', textTransform: 'none', fontWeight: 400, opacity: 0.8 }}>美丽不该复杂，<br />专注美好生活</div>
                        </div>

                        {/* Row 1, Col 3-4: 合并后的宽图片卡 */}
                        <div
                            ref={(el) => addCellRef(el, 2)}
                            className="kinetic-cell kinetic-image-cell group cursor-pointer"
                            style={{ gridColumn: "span 2", aspectRatio: "auto" }}
                        >
                            <Link href="#" className="absolute inset-0 z-20" aria-label="官方指南" />
                            <Image
                                src="/images/kinetic-cat.webp"
                                alt="Cat Aesthetic"
                                fill
                                className="kinetic-cell-image transition-all duration-500 group-hover:grayscale-0"
                                sizes="(max-width: 600px) 100vw, 50vw"
                            />
                            <div className="absolute inset-0 z-10 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-black/20 pointer-events-none">
                                <span className="text-white text-2xl font-bold tracking-[0.25em] border-b-2 border-white/60 pb-1.5">官方指南</span>
                            </div>
                        </div>

                        <div
                            ref={(el) => addCellRef(el, 3)}
                            className="kinetic-cell kinetic-image-cell group cursor-pointer"
                        >
                            <Link href="#" className="absolute inset-0 z-20" aria-label="关于旎柏" />
                            <Image
                                src="/images/kinetic-desktop.webp"
                                alt="Product Desktop"
                                fill
                                className="kinetic-cell-image !filter-none transition-all duration-500 hidden lg:block"
                                sizes="(max-width: 1024px) 100vw, 25vw"
                            />
                            <Image
                                src="/images/kinetic-mobile.webp"
                                alt="Product Mobile"
                                fill
                                className="kinetic-cell-image !filter-none transition-all duration-500 block lg:hidden"
                                sizes="100vw"
                            />
                        </div>


                        {/* Row 2, Col 3: 文字卡 */}
                        <div
                            ref={(el) => addCellRef(el, 4)}
                            className="kinetic-cell kinetic-text-cell kinetic-cell-orange"
                        >
                            <div className="kinetic-name">逆转时光</div>
                            <div className="kinetic-desc" style={{ fontSize: '13px', letterSpacing: '0.05em', textTransform: 'none', fontWeight: 400, opacity: 0.8 }}>REVERSE TIME</div>
                        </div>

                        {/* Row 2, Col 4: 登录/CTA卡 */}
                        <div
                            ref={(el) => addCellRef(el, 5)}
                            className={`kinetic-cell kinetic-login-cell ${user ? "kinetic-cell-user-premium" : "cursor-pointer"}`}
                            onClick={!user ? handleLoginClick : undefined}
                        >
                            <div className="flex flex-col items-center justify-center w-full relative z-20 gap-4">
                                {user ? (
                                    <>
                                        <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden bg-white border border-zinc-200 shadow-sm flex items-center justify-center">
                                            {user.name ? (
                                                <span className="text-xl font-bold text-zinc-900">{user.name[0].toUpperCase()}</span>
                                            ) : (
                                                <BookUser className="h-8 w-8 text-zinc-300" />
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <div className="text-zinc-400 text-[10px] tracking-[0.2em] uppercase mb-1">欢迎回来</div>
                                            <div className="text-zinc-900 text-base font-bold">{user.name || "正式会员"}</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); logout(); }}
                                            className="mt-2 text-[11px] text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1"
                                        >
                                            <LogOut size={12} /> 退出登录
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center border border-white/60">
                                            <Image src="/images/profile-icon.svg" alt="Profile" width={36} height={36} className="opacity-40" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleLoginClick}
                                            className="w-full py-2 sm:py-3 rounded-xl bg-white/40 backdrop-blur-sm border border-white/60 text-stone-800 text-xs sm:text-sm tracking-[0.2em] font-medium transition-all hover:bg-white/60 shadow-sm"
                                        >
                                            立即登录
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default BentoBackground;

