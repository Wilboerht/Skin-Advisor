"use client";

import { ReactNode } from "react";
import { LayoutProvider } from "@/contexts/LayoutContext";
import { KineticBackground } from "@/components/website/KineticBackground";
import { BentoBackground } from "@/components/website/BentoBackground";
import { BottomNavBar } from "@/components/website/BottomNavBar";

/**
 * WebsiteLayoutClient
 * 
 * 作用：
 * 1. 提供 LayoutContext (管理底部导航菜单和 Bento 背景状态)
 * 2. 渲染全局单一的 KineticBackground
 * 3. 增加 BentoBackground (showBento 为 true 时显示)
 * 4. 增加 BottomNavBar (Dock 式底部导航)
 * 5. 包装页面内容
 */
export function WebsiteLayoutClient({ children }: { children: ReactNode }) {
    return (
        <LayoutProvider>
            {/* 底层 3D 动力学背景 (简化版) */}
            <KineticBackground />

            {/* Bento Grid 背景 (仅在收起时显示) */}
            <BentoBackground />

            {/* 底部导航 (全局单例) */}
            <BottomNavBar />

            {/* 布局 Provider */}
            {children}
        </LayoutProvider>
    );
}

