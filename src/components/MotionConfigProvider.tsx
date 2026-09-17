"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * 全站 Framer Motion 降级配置。
 *
 * reducedMotion="user"：系统开启"减弱动效"时，所有 m/motion 动画自动降级为瞬时切换。
 * 注意 globals.css 里的 prefers-reduced-motion 只约束 CSS 动画，
 * Framer Motion 走 rAF，必须由 MotionConfig 接管，否则弹层 spring 动效不受控。
 */
export function MotionConfigProvider({ children }: { children: ReactNode }) {
    return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
