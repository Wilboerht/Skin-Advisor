"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface LayoutContextType {
    /** 底部导航菜单是否展开 */
    isNavMenuOpen: boolean;
    /** 设置底部导航菜单展开状态 */
    setNavMenuOpen: (isOpen: boolean) => void;
    /** 是否显示便当盒背景（仅手动点击收起按钮时为 true） */
    showBento: boolean;
    /** 设置便当盒背景可见性 */
    setShowBento: (show: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
    const [isNavMenuOpen, setNavMenuOpen] = useState(false);
    const [showBento, setShowBento] = useState(false);

    return (
        <LayoutContext.Provider value={{ isNavMenuOpen, setNavMenuOpen, showBento, setShowBento }}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    const context = useContext(LayoutContext);
    if (context === undefined) {
        throw new Error("useLayout must be used within a LayoutProvider");
    }
    return context;
}
