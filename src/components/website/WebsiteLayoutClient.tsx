"use client";

import { ReactNode } from "react";
import { KineticBackground } from "@/components/website/KineticBackground";

/**
 * WebsiteLayoutClient
 * 
 * 作用：
 * 1. 渲染全局单一的 KineticBackground
 * 2. 包装页面内容
 */
export function WebsiteLayoutClient({ children }: { children: ReactNode }) {
    return (
        <>
            {/* 底层 3D 动力学背景 (简化版) */}
            <KineticBackground />

            {/* 布局内容 */}
            {children}
        </>
    );
}
