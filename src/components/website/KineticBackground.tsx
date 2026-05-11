"use client";

import React from "react";
import Image from "next/image";

/**
 * KineticBackground - NIHPLOD 品牌动力学背景组件
 * 
 * 作用：底层 3D 交互背景效果。
 * 已同步至 nihplod.cn 最新配置。
 */
export function KineticBackground() {
    return (
        <div className="kinetic-background-wrapper">
            {/* 底层 3D 动力学背景 */}
            <div className="kinetic-bg-base" />
            <div className="kinetic-dot-pattern" />

            {/* 全局背景水印 - 复刻原版静态配置 */}
            <div className="kinetic-watermark">
                {/* PC 端水印 */}
                <Image
                    src="/images/watermark.webp"
                    alt="Watermark PC"
                    width={2800}
                    height={800}
                    style={{ objectFit: 'contain' }}
                    className="hidden md:block"
                    priority
                />
                {/* 移动端水印 - 竖版 SVG */}
                <div className="block md:hidden absolute inset-0">
                    <Image
                        src="/images/watermark-mobile.svg"
                        alt="Watermark Mobile"
                        fill
                        priority
                        style={{ objectFit: 'fill' }}
                        className="opacity-90"
                    />
                </div>
            </div>

            {/* 矿物纹质感叠加层 */}
            <div className="texture-overlay absolute inset-0 opacity-[0.04]" />
        </div>
    );
}

export default KineticBackground;

