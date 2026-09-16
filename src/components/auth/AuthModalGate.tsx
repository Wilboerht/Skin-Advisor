"use client";

import dynamic from "next/dynamic";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useLazyOpen } from "@/hooks/use-lazy-open";

// SSO 迁移后弹窗只在 forgot_password / wechat_bind 场景出现，
// 但组件含完整版 framer-motion 依赖，必须延迟到首次打开才加载
const AuthModal = dynamic(() => import("@/components/auth/AuthModal").then((mod) => mod.AuthModal), { ssr: false });

/**
 * AuthModalGate — AuthModal 的懒挂载门卫
 *
 * 挂在根 layout（AuthModalProvider 内），首次打开前不渲染真实弹窗，
 * 避免其 chunk（含 AuthModal 与 framer-motion 特性包）进入全站首屏。
 */
export function AuthModalGate() {
  const { isOpen } = useAuthModal();
  const shouldRender = useLazyOpen(isOpen);

  if (!shouldRender) return null;
  return <AuthModal />;
}
