"use client";

import React from "react";

/**
 * KineticBackground - NIHPLOD 品牌动力学背景组件
 * 
 * 作用：底层背景效果，使用 ba.nihplod.cn 首页的背景颜色和光团
 */
export function KineticBackground() {
    return (
        <div className="kinetic-background-wrapper">
            {/* 底层背景 */}
            <div className="kinetic-bg-base" />
            <div className="kinetic-dot-pattern" />

            {/* 动态光团已移除 */}

            {/* 矿物纹质感叠加层 */}
            <div className="texture-overlay absolute inset-0 opacity-[0.03]" />
        </div>
    );
}

export default KineticBackground;
