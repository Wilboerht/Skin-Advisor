"use client";

import dynamic from "next/dynamic";
import { useLegalDocModal } from "@/components/website/LegalDocModalContext";
import { useLazyOpen } from "@/hooks/use-lazy-open";

// 法务文档弹层（含 iframe）延迟到首次打开才加载
const LegalDocModal = dynamic(() => import("@/components/website/LegalDocModal").then((mod) => mod.LegalDocModal), { ssr: false });

/**
 * LegalDocModalGate — LegalDocModal 的懒挂载门卫（与 DiaryModalGate 同构）
 *
 * 挂在根 layout（LegalDocModalProvider 内），首次打开前不渲染真实弹窗。
 */
export function LegalDocModalGate() {
  const { doc } = useLegalDocModal();
  const shouldRender = useLazyOpen(doc !== null);

  if (!shouldRender) return null;
  return <LegalDocModal />;
}
