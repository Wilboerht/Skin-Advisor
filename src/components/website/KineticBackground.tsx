"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";

/**
 * KineticBackground - NIHPLOD 品牌动力学背景组件
 * 
 * 作用：底层 3D 交互背景效果。
 * 已同步至 nihplod.cn 最新配置。
 */
export function KineticBackground() {
    const glow1Ref = useRef<HTMLDivElement>(null);
    const glow2Ref = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;

            const { clientX, clientY } = e;
            const x = (clientX / window.innerWidth - 0.5);
            const y = (clientY / window.innerHeight - 0.5);

            // 光晕视差：维持与原版一致的漂浮感
            if (glow1Ref.current) {
                glow1Ref.current.style.transform = `translate(${x * 60}px, ${y * 60}px) scale(1.1)`;
            }
            if (glow2Ref.current) {
                glow2Ref.current.style.transform = `translate(${-x * 40}px, ${-y * 40}px) scale(1.1)`;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <div ref={containerRef} className="kinetic-background-wrapper">
            {/* 底层 3D 动力学背景 */}
            <div className="kinetic-bg-base" />
            <div className="kinetic-dot-pattern" />

            <div ref={glow1Ref} className="kinetic-glow kinetic-glow-1" />
            <div ref={glow2Ref} className="kinetic-glow kinetic-glow-2" />

            {/* 全局背景水印 - 复刻原版静态配置 */}
            <div className="kinetic-watermark">
                <Image
                    src="/images/watermark.webp"
                    alt="Watermark"
                    width={2800}
                    height={800}
                    style={{ objectFit: 'contain' }}
                    priority
                />
            </div>

            {/* 矿物纹质感叠加层 */}
            <div className="texture-overlay absolute inset-0 opacity-[0.04]" />
        </div>
    );
}

export default KineticBackground;

