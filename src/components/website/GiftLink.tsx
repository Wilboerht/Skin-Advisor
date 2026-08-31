"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GiftModal } from "@/components/website/GiftModal";

interface GiftLinkProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * GiftLink — 原地打开"测肤有礼"活动弹窗的按钮（替代跳转到 /?gift=1 的链接）
 * 样式完全由调用方 className 决定，视觉上与原 Link 一致；
 * 弹窗内"前往测试"未提供 onStartTest 时退化为跳首页链接（见 GiftModal）。
 * 弹窗经 Portal 挂到 body，避免被父元素的 mask/transform 等样式影响。
 */
export function GiftLink({ className, style, children }: GiftLinkProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        {children}
      </button>
      {mounted && createPortal(
        <GiftModal isOpen={open} onClose={() => setOpen(false)} />,
        document.body
      )}
    </>
  );
}
