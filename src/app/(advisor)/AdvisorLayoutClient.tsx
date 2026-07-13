"use client";

import { LazyMotion, domAnimation } from "framer-motion";
import { ToastProvider } from "@/components/ui/Toast";

export function AdvisorLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <ToastProvider>
        <div className="w-full min-h-screen">
          {children}
        </div>
      </ToastProvider>
    </LazyMotion>
  );
}
