"use client";

import { LazyMotion, domAnimation } from "framer-motion";

export function AdvisorLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  // ToastProvider 由根布局统一提供，此处不再嵌套（避免挂两个 ToastContainer）
  return (
    <LazyMotion features={domAnimation}>
      <div className="w-full min-h-screen">
        {children}
      </div>
    </LazyMotion>
  );
}
