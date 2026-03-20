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
 * 1. 提供 LayoutContext (管理抽屉状态)
 * 2. 渲染全局单一的 KineticBackground
 * 3. 增加 BentoBackground (抽屉收起时显示)
 * 4. 增加全局单一的 BottomNavBar (复刻 nihplod.cn 版)
 * 5. 包装页面内容
 */
export function WebsiteLayoutClient({ children }: { children: ReactNode }) {
    return (
        <LayoutProvider>
            {/* 底层 3D 动力学背景 (简化版) */}
            <KineticBackground />

            {/* Bento Grid 背景 (仅在收起时显示) */}
            <BentoBackground />

            {/* 全局底部导航栏 (Dock 样式) */}
            <BottomNavBar />

            {/* 布局 Provider */}
            {children}
        </LayoutProvider>
    );
}

