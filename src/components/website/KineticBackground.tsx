"use client";

import React, { useEffect, useRef } from "react";

/**
 * KineticBackground - NIHPLOD 品牌动力学背景组件 (纯净版)
 * 
 * 作用：底层 3D 交互背景效果。
 * 包含：深度色彩基底、交互式视差水印、动态光晕、点阵图案、以及矿物纹理。
 */
export function KineticBackground() {
    const watermarkRef = useRef<HTMLDivElement>(null);
    const glow1Ref = useRef<HTMLDivElement>(null);
    const glow2Ref = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;

            const { clientX, clientY } = e;
            const x = (clientX / window.innerWidth - 0.5);
            const y = (clientY / window.innerHeight - 0.5);

            // 水印视差：轻微反向跟随，增加深邃感
            if (watermarkRef.current) {
                watermarkRef.current.style.transform = `translate(calc(-50% + ${-x * 40}px), calc(-50% + ${-y * 40}px)) scale(1.05)`;
            }

            // 光晕视差：错位漂浮
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

            <div ref={watermarkRef} className="kinetic-watermark">
                <img
                    src="/images/watermark.webp"
                    alt="NIHPLOD Watermark"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                />
            </div>

            {/* 矿物纹质感叠加层 (使用全局定义的 texture-overlay) */}
            <div className="texture-overlay absolute inset-0 opacity-[0.04]" />
        </div>
    );
}

export default KineticBackground;

