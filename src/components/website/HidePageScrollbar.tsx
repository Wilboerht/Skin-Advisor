"use client";

import { useEffect } from "react";

/**
 * HidePageScrollbar — 挂载期间隐藏页面级滚动条（保留滚动功能）
 * 通过在 <html> 上切换 hide-page-scrollbar 类实现，卸载时还原。
 * 用于 /skin-types 等希望视觉上去掉滚动条的页面。
 */
export function HidePageScrollbar() {
  useEffect(() => {
    document.documentElement.classList.add("hide-page-scrollbar");
    return () => document.documentElement.classList.remove("hide-page-scrollbar");
  }, []);
  return null;
}
