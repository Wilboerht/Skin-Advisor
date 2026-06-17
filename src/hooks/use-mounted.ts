"use client";

import { useEffect, useState } from "react";

/**
 * 返回组件是否已在客户端挂载。
 * 用于避免 SSR/SSG 阶段渲染依赖 DOM 尺寸的组件（如图表）。
 */
export function useMounted() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return mounted;
}
