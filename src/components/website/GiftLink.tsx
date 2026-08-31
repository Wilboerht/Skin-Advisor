"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { GiftModal } from "@/components/website/GiftModal";

interface GiftLinkProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * GiftLink — 原地打开"测肤有礼"活动弹窗的按钮（替代跳转到 /?gift=1 的链接）
 * 样式完全由调用方 className 决定，视觉上与原 Link 一致。
 * 弹窗内"开始测肤"与首页行为一致：带 ?start=1 回首页，由首页自动拉起
 * 与 CTA 相同的测肤流程（限额检查 → 隐私授权）。
 * 弹窗经 Portal 挂到 body，避免被父元素的 mask/transform 等样式影响。
 */
export function GiftLink({ className, style, children }: GiftLinkProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        {children}
      </button>
      {mounted && createPortal(
        <GiftModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onStartTest={() => {
            setOpen(false);
            router.push("/?start=1");
          }}
        />,
        document.body
      )}
    </>
  );
}
