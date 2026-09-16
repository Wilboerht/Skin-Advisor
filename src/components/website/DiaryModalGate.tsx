"use client";

import dynamic from "next/dynamic";
import { useDiaryModal } from "@/components/website/DiaryModalContext";
import { useLazyOpen } from "@/hooks/use-lazy-open";

// 护肤档案弹层子树较重（日历/时间线/趋势图/打卡/测肤记录），延迟到首次打开才加载
const DiaryModal = dynamic(() => import("@/components/website/DiaryModal").then((mod) => mod.DiaryModal), { ssr: false });

/**
 * DiaryModalGate — DiaryModal 的懒挂载门卫
 *
 * 挂在根 layout（DiaryModalProvider 内），首次打开前不渲染真实弹窗，
 * 避免其整串子组件进入全站首屏。
 */
export function DiaryModalGate() {
  const { isOpen } = useDiaryModal();
  const shouldRender = useLazyOpen(isOpen);

  if (!shouldRender) return null;
  return <DiaryModal />;
}
