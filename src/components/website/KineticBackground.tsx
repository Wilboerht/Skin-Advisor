"use client";

import Image from "next/image";

/**
 * KineticBackground — 米白底 + 点阵 + N 水印（与 nihplod.cn 主站一致）
 * fixed 定位、z-0、不响应事件；使用方需保证内容层在 relative z-10 以上。
 * 样式类定义见 globals.css「首页 Kinetic 背景」一节。
 * 使用页面：首页。
 */
export function KineticBackground() {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="kinetic-bg-base" />
            <div className="kinetic-dot-pattern" />
            <div className="kinetic-watermark">
                {/* PC 端水印（≥1025px 断点切换见 globals.css） */}
                <div
                    className="kinetic-watermark-pc relative"
                    style={{ filter: "brightness(0) invert(0.95)", opacity: 0.22 }}
                >
                    <Image
                        src="/images/N-web.svg"
                        alt=""
                        width={2800}
                        height={800}
                        style={{ objectFit: "contain" }}
                        unoptimized
                    />
                </div>
                {/* 移动端水印 - 竖版，深色水印在浅色背景上形成品牌纹理 */}
                <div
                    className="kinetic-watermark-mobile absolute inset-0"
                    style={{ filter: "brightness(0)" }}
                >
                    <Image
                        src="/images/watermark-mobile.webp"
                        alt=""
                        fill
                        style={{ objectFit: "cover" }}
                    />
                </div>
            </div>
        </div>
    );
}

export default KineticBackground;
