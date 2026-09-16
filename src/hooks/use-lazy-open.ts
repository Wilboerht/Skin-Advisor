"use client";

import { useEffect, useState } from "react";

/**
 * useLazyOpen — 弹窗懒加载 latch
 *
 * 返回 true 后调用方可安全渲染 next/dynamic 的弹窗组件：
 * - 首次 open 前为 false：chunk 与子树完全不进入首屏（dynamic 组件不渲染就不下载）
 * - 首次 open 后恒为 true：保持挂载，AnimatePresence 的退场动画不被提前卸载打断
 *
 * 注意返回值为 `everOpened || isOpen`：打开当帧即渲染（不依赖 effect 补一拍），
 * 首次动态 chunk 加载期间由浏览器并行完成，无需额外 loading 态。
 */
export function useLazyOpen(isOpen: boolean): boolean {
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    if (isOpen) setEverOpened(true);
  }, [isOpen]);

  return everOpened || isOpen;
}
