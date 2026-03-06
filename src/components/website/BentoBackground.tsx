"use client";

import { useEffect, useRef } from "react";
import { BookUser } from "lucide-react";
import { useLayout } from "@/contexts/LayoutContext";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Bento Grid 通用背景组件
 */
export function BentoBackground() {
    const { showBento } = useLayout();
    const pathname = usePathname();
    const isHomepage = pathname === "/";
    const containerRef = useRef<HTMLDivElement>(null);
    const cellsRef = useRef<HTMLDivElement[]>([]);

    useEffect(() => {
        const container = containerRef.current;
        const cells = cellsRef.current;
        if (!container || cells.length === 0) return;

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

    return (
        <AnimatePresence>
            {showBento && isHomepage && (
                <motion.div
                    key="bento-bg-container"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.4, delay: 0 } }}
                    transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="bento-bg-wrapper"
                >
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        :root {
                            --bento-bg: transparent; /* 改为透明以便看到底层的 KineticBackground */
                            --bento-radius: 28px;
                            --bento-transition: 0.6s cubic-bezier(0.23, 1, 0.32, 1);
                        }
                        
                        .bento-bg-wrapper {
                            position: fixed;
                            inset: 0;
                            z-index: 5; /* 低于 safe-area-content (z-20)，不会遮住抽屉 */
                            overflow: hidden;
                            background-color: var(--bento-bg);
                            pointer-events: none;
                        }
                        
                        .bento-bg-base {
                            position: absolute;
                            inset: 0;
                            background-image: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
                            pointer-events: none;
                        }
                        
                        .bento-dot-pattern {
                            position: absolute;
                            inset: 0;
                            background-image: radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
                            background-size: 40px 40px;
                            pointer-events: none;
                        }
                        
                        .bento-grid-container {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            width: 85vw;
                            max-width: 1100px;
                            height: 70vh;
                            max-height: 620px;
                            display: grid;
                            grid-template-columns: 1.1fr repeat(3, 1fr);
                            grid-template-rows: repeat(2, 1fr);
                            gap: 16px;
                            perspective: 1000px;
                            pointer-events: none;
                        }
                        
                        .bento-cell {
                            position: relative;
                            /* 不设 aspect-ratio，由网格行高精确控制 */
                            background: rgba(21, 21, 21, 0.8);
                            backdrop-filter: blur(10px);
                            -webkit-backdrop-filter: blur(10px);
                            border-radius: var(--bento-radius);
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-end;
                            padding: 30px;
                            transition: transform var(--bento-transition), box-shadow var(--bento-transition);
                            box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.05), 0 15px 30px -8px rgba(0, 0, 0, 0.1);
                            pointer-events: auto;
                            min-height: 0;
                            min-width: 0;
                        }

                        .bento-cell:not(.no-hover-effect):hover {
                            transform: translateY(-5px) scale(1.01) !important;
                            box-shadow: 12px 12px 0px rgba(0, 0, 0, 0.08), 0 20px 40px -10px rgba(0, 0, 0, 0.2);
                            z-index: 10;
                        }
                        
                        .bento-cell-large {
                            grid-row: span 2;
                            aspect-ratio: auto;
                        }
                        
                        .bento-col-span-2 {
                            grid-column: span 2;
                            aspect-ratio: auto;
                        }
                        
                        .bento-image-cell {
                            padding: 0;
                        }
                        
                        .bento-image {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                            transition: transform 1.2s var(--bento-transition);
                        }
                        
                        .bento-cell:hover .bento-image {
                            transform: scale(1.08);
                        }
                        
                        .bento-overlay {
                            position: absolute;
                            inset: 0;
                            background: linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%);
                            pointer-events: none;
                        }
                        
                        .bento-name {
                            font-size: 2rem;
                            font-weight: 800;
                            color: white;
                            line-height: 1.1;
                            margin-bottom: 8px;
                            font-family: inherit;
                        }
                        
                        .bento-desc {
                            font-size: 0.8rem;
                            color: rgba(255,255,255,0.6);
                            letter-spacing: 0.2em;
                        }
                        
                        .bento-cell-glass-gold {
                            background: linear-gradient(135deg, rgba(250, 231, 171, 0.15) 0%, rgba(250, 231, 171, 0.05) 100%);
                            backdrop-filter: blur(20px);
                            -webkit-backdrop-filter: blur(20px);
                            border: 1px solid rgba(255,255,255,0.1);
                        }
                        
                        .bento-cell-glass-silver {
                            background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
                            backdrop-filter: blur(20px);
                            -webkit-backdrop-filter: blur(20px);
                            border: 1px solid rgba(255,255,255,0.1);
                        }
                        
                        .bento-cta-cell {
                            background: rgba(239, 237, 230, 0.9);
                            justify-content: center;
                        }
                        
                        .bento-cta-bg::before {
                            content: "";
                            position: absolute;
                            width: 150px;
                            height: 150px;
                            background: rgba(201, 168, 108, 0.2);
                            filter: blur(30px);
                            border-radius: 50%;
                            top: -20px;
                            right: -20px;
                        }
                        
                        @media (max-width: 900px) {
                            .bento-grid-container {
                                grid-template-columns: repeat(2, 1fr);
                                grid-template-rows: auto;
                                width: 90vw;
                            }
                            
                            .bento-cell-large {
                                grid-row: span 1;
                                aspect-ratio: 1/1;
                            }
                        }
                        
                        @media (max-width: 600px) {
                            .bento-grid-container {
                                gap: 10px;
                                top: 45%;
                            }
                            .bento-cell {
                                border-radius: 18px;
                                padding: 20px;
                            }
                            .bento-name {
                                font-size: 1.2rem;
                            }
                        }
                        `
                    }} />

                    {/* 基础背景层 */}
                    <div className="bento-bg-base" />
                    <div className="bento-dot-pattern" />

                    {/* 3D 网格容器 */}
                    <div ref={containerRef} className="bento-grid-container">

                        {/* 1. 左侧大卡片 (跨两行) */}
                        <div
                            ref={(el) => addCellRef(el, 0)}
                            className="bento-cell bento-cell-large bento-image-cell group"
                        >
                            <img
                                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
                                alt="Background Image 1"
                                className="bento-image grayscale transition-all duration-700 group-hover:grayscale-0"
                            />
                            <div className="bento-overlay" />
                            <div className="absolute inset-0 z-10 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-black/20">
                                <span className="text-white text-2xl font-bold tracking-[0.25em] border-b-2 border-white/60 pb-1.5">探索系列</span>
                            </div>
                        </div>

                        {/* 2. 第一行文字卡 */}
                        <div
                            ref={(el) => addCellRef(el, 1)}
                            className="bento-cell bento-text-cell bento-cell-glass-gold"
                        >
                            <div className="bento-name">极简<br />美学</div>
                            <div className="bento-desc">LESS IS MORE</div>
                        </div>

                        {/* 3. 第一行宽卡片 (跨两列) */}
                        <div
                            ref={(el) => addCellRef(el, 2)}
                            className="bento-cell bento-image-cell group bento-col-span-2"
                        >
                            <img
                                src="https://images.unsplash.com/photo-1634655377962-e6e7b446e7e9?q=80&w=2564&auto=format&fit=crop"
                                alt="Background Image 2"
                                className="bento-image grayscale transition-all duration-700 group-hover:grayscale-0"
                            />
                            <div className="bento-overlay" />
                        </div>

                        {/* 4. 第二行图片卡 */}
                        <div
                            ref={(el) => addCellRef(el, 3)}
                            className="bento-cell bento-image-cell group"
                        >
                            <img
                                src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2670&auto=format&fit=crop"
                                alt="Background Image 3"
                                className="bento-image !filter-none"
                            />
                        </div>

                        {/* 5. 第二行文字卡 */}
                        <div
                            ref={(el) => addCellRef(el, 4)}
                            className="bento-cell bento-text-cell bento-cell-glass-silver"
                        >
                            <div className="bento-name">逆转<br />时光</div>
                            <div className="bento-desc">REVERSE TIME</div>
                        </div>

                        {/* 6. 交互/CTA 卡片 */}
                        <div
                            ref={(el) => addCellRef(el, 5)}
                            className="bento-cell bento-cta-cell no-hover-effect"
                        >
                            <div className="bento-cta-bg" />
                            <div className="flex flex-col items-center justify-center w-full relative z-10 gap-4">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center border border-white/60">
                                    <BookUser className="h-6 w-6 sm:h-8 sm:w-8 text-stone-600/50" />
                                </div>
                                <button
                                    className="w-full py-2 sm:py-3 rounded-xl bg-white/30 backdrop-blur-sm border border-white/50 text-stone-800 text-xs sm:text-sm tracking-[0.2em] font-medium transition-all hover:bg-white/50 cursor-pointer"
                                    onClick={() => window.location.href = "#"}
                                >
                                    立即开启
                                </button>
                            </div>
                        </div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default BentoBackground;
