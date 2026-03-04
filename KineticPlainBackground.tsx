"use client";

import React, { useEffect, useRef } from "react";

/**
 * KineticPlainBackground - NIHPLOD 品牌动力学背景组件 (纯净版)
 * 
 * 作用：完全复刻官网的 3D 交互背景效果，移除了前景的 Bento Grid 卡片。
 * 包含：深度色彩基底、交互式视差水印、动态光晕、点阵图案、以及矿物纹理。
 * 
 * 使用说明：
 * 1. 直接将此文件复制到你的项目中。
 * 2. 确保项目根目录下有 /public/images/watermark.webp 文件（或在组件内修改图片路径）。
 */
export function KineticPlainBackground() {
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
                glow1Ref.current.style.transform = `translate(${x * 60}px, ${y * 60}px)`;
            }
            if (glow2Ref.current) {
                glow2Ref.current.style.transform = `translate(${-x * 40}px, ${-y * 40}px)`;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
        :root {
          --k-bg: rgb(142, 128, 114);
          --k-accent: #333333;
          --k-transition: 1s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .k-plain-wrapper {
          position: fixed;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          background-color: var(--k-bg);
          pointer-events: none;
        }

        /* 核心渐变基底 */
        .k-plain-base {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4) 0%, transparent 100%);
        }

        /* 动力学点阵 */
        .k-plain-dots {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
          background-size: 40px 40px;
          opacity: 0.8;
        }

        /* 品牌水印视差层 */
        .k-plain-watermark {
          position: absolute;
          top: 46%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 150vw;
          max-width: 2800px;
          opacity: 0.15;
          filter: grayscale(1) brightness(2.5);
          mix-blend-mode: overlay;
          transition: transform var(--k-transition);
          z-index: 1;
        }

        /* 动态背景光晕 */
        .k-plain-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.12;
          transition: transform 1.5s var(--k-transition);
        }

        .k-plain-glow-1 {
          width: 800px;
          height: 800px;
          background: var(--k-accent);
          top: -200px;
          right: -200px;
          animation: k-float-1 25s ease-in-out infinite;
        }

        .k-plain-glow-2 {
          width: 600px;
          height: 600px;
          background: linear-gradient(135deg, var(--k-accent), #666);
          bottom: -150px;
          left: -150px;
          animation: k-float-2 30s ease-in-out infinite;
        }

        @keyframes k-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1.1); }
          50% { transform: translate(100px, 50px) scale(1); }
        }

        @keyframes k-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-80px, -40px) scale(1.1); }
        }

        /* 扫描线细节 */
        .k-plain-wrapper::after {
          content: "";
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(0deg, 
            transparent, 
            transparent 2px, 
            rgba(255, 255, 255, 0.01) 2px, 
            rgba(255, 255, 255, 0.01) 4px
          );
          z-index: 2;
        }

        /* 矿物纹质感叠加层 */
        .k-plain-texture {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          opacity: 0.04;
          z-index: 3;
        }

        @media (max-width: 768px) {
          .k-plain-watermark { width: 200vw; }
          .k-plain-glow { filter: blur(60px); opacity: 0.08; }
        }
      `}} />

            <div ref={containerRef} className="k-plain-wrapper">
                {/* 透明度层级：基底 -> 点阵 -> 光晕 -> 水印 -> 扫描线 -> 纹理 */}
                <div className="k-plain-base" />
                <div className="k-plain-dots" />

                <div ref={glow1Ref} className="k-plain-glow k-plain-glow-1" />
                <div ref={glow2Ref} className="k-plain-glow k-plain-glow-2" />

                <div ref={watermarkRef} className="k-plain-watermark">
                    <img
                        src="/images/watermark.webp"
                        alt="NIHPLOD Watermark"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                </div>

                <div className="k-plain-texture" />
            </div>
        </>
    );
}

export default KineticPlainBackground;
