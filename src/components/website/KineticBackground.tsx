"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

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

            {/* 动态流体全屏光团 (来自 ba.nihplod.cn) */}
            {/* 1. 琥珀色 - 主色调 */}
            <motion.div
                className="absolute w-[750px] h-[750px] md:w-[1200px] md:h-[1200px] rounded-full pointer-events-none blur-[140px] md:blur-[180px] z-0"
                style={{ background: "radial-gradient(circle, #8B7355 0%, #8B7355 8%, transparent 65%)" }}
                animate={{
                    x: ['5vw', '55vw', '15vw', '60vw', '5vw'],
                    y: ['10vh', '45vh', '80vh', '30vh', '10vh'],
                    scale: [1, 1.25, 0.85, 1.15, 1],
                    opacity: [0.15, 0.3, 0.2, 0.32, 0.15],
                    scaleX: [1, 1.4, 0.7, 1.2, 1],
                    scaleY: [1, 0.6, 1.3, 0.8, 1],
                }}
                transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
            />
            {/* 2. 暖亚麻 - 逆向漂移 */}
            <motion.div
                className="absolute w-[650px] h-[650px] md:w-[1100px] md:h-[1100px] rounded-full pointer-events-none blur-[130px] md:blur-[170px] z-0"
                style={{ background: "radial-gradient(circle, #E5DED4 0%, #D4BC9B 10%, transparent 68%)" }}
                animate={{
                    x: ['70vw', '20vw', '60vw', '15vw', '70vw'],
                    y: ['15vh', '70vh', '25vh', '60vh', '15vh'],
                    scale: [0.9, 1.15, 1.05, 0.8, 0.9],
                    opacity: [0.18, 0.35, 0.25, 0.4, 0.18],
                    scaleX: [1.1, 0.8, 1.3, 0.9, 1.1],
                    scaleY: [0.8, 1.2, 0.75, 1.15, 0.8],
                }}
                transition={{ duration: 65, repeat: Infinity, ease: "linear" }}
            />
            {/* 3. 香槟金 - 交叉扰动 */}
            <motion.div
                className="absolute w-[550px] h-[550px] md:w-[950px] md:h-[950px] rounded-full pointer-events-none blur-[100px] md:blur-[150px] z-0"
                style={{ background: "radial-gradient(circle, #F7E7CE 0%, #F1E5AC 12%, transparent 65%)" }}
                animate={{
                    x: ['10vw', '60vw', '20vw', '55vw', '10vw'],
                    y: ['75vh', '20vh', '40vh', '70vh', '75vh'],
                    scale: [0.85, 1.25, 0.9, 1.2, 0.85],
                    opacity: [0.2, 0.38, 0.28, 0.42, 0.2],
                    scaleX: [1.2, 0.85, 1.1, 0.75, 1.2],
                    scaleY: [0.75, 1.2, 0.9, 1.25, 0.75],
                }}
                transition={{ duration: 42, repeat: Infinity, ease: "linear" }}
            />
            {/* 4. 淡玫瑰金 - 对角漂移 */}
            <motion.div
                className="absolute w-[500px] h-[500px] md:w-[850px] md:h-[850px] rounded-full pointer-events-none blur-[110px] md:blur-[160px] z-0"
                style={{ background: "radial-gradient(circle, #E5D0C8 0%, #C9A89A 10%, transparent 68%)" }}
                animate={{
                    x: ['65vw', '15vw', '55vw', '20vw', '65vw'],
                    y: ['70vh', '25vh', '65vh', '80vh', '70vh'],
                    scale: [0.8, 1.1, 0.95, 1.15, 0.8],
                    opacity: [0.12, 0.22, 0.15, 0.25, 0.12],
                    scaleX: [0.9, 1.3, 1, 0.85, 0.9],
                    scaleY: [1.1, 0.7, 1.2, 1.05, 1.1],
                }}
                transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
            />
            {/* 5. 象牙白 - 中心环绕 */}
            <motion.div
                className="absolute w-[600px] h-[600px] md:w-[1000px] md:h-[1000px] rounded-full pointer-events-none blur-[120px] md:blur-[170px] z-0"
                style={{ background: "radial-gradient(circle, #F0EBE3 0%, #DDD5C8 12%, transparent 65%)" }}
                animate={{
                    x: ['50vw', '25vw', '75vw', '30vw', '50vw'],
                    y: ['50vh', '25vh', '50vh', '75vh', '50vh'],
                    scale: [1, 0.85, 1.1, 0.9, 1],
                    opacity: [0.18, 0.32, 0.22, 0.35, 0.18],
                    scaleX: [1, 0.75, 1.15, 1.05, 1],
                    scaleY: [1, 1.25, 0.8, 1.1, 1],
                }}
                transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
            />

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
            <div className="texture-overlay absolute inset-0 opacity-[0.03]" />
        </div>
    );
}

export default KineticBackground;
