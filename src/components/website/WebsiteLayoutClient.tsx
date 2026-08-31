"use client";

import { ReactNode } from "react";

/**
 * WebsiteLayoutClient — 包装页面内容
 * （Kinetic 背景由各页面按需显式渲染：首页、护肤档案，见 KineticBackground 组件）
 */
export function WebsiteLayoutClient({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
        </>
    );
}
