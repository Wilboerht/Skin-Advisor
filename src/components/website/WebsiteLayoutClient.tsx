"use client";

import { ReactNode } from "react";
import { LayoutProvider } from "@/contexts/LayoutContext";
import { KineticBackground } from "@/components/website/KineticBackground";

/**
 * WebsiteLayoutClient
 * 
 * 作用：
 * 1. 提供 LayoutContext (管理抽屉状态)
 * 2. 渲染全局单一的 KineticBackground
 * 3. 包装页面内容
 */
export function WebsiteLayoutClient({ children }: { children: ReactNode }) {
    return (
        <LayoutProvider>
            {/* 底层 3D 动力学背景 (简化版) */}
            <KineticBackground />

            {/* 布局 Provider */}
            {children}
        </LayoutProvider>
    );
}
