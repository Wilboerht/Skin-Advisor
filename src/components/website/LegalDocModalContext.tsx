"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type LegalDoc = "privacy" | "terms";

interface LegalDocModalContextType {
  /** 当前打开的文档；null = 关闭 */
  doc: LegalDoc | null;
  openLegalDoc: (doc: LegalDoc) => void;
  closeLegalDoc: () => void;
}

const LegalDocModalContext = createContext<LegalDocModalContextType | undefined>(undefined);

/**
 * LegalDocModalProvider — 「隐私政策/服务条款」阅读弹层的全局开关（与 AuthModalContext 同构）
 * 入口：引导弹窗授权屏、隐私授权、扫码引导、登录弹窗等；
 * 弹层本体经 LegalDocModalGate 懒挂载于根 layout。
 */
export function LegalDocModalProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<LegalDoc | null>(null);

  const openLegalDoc = useCallback((d: LegalDoc) => setDoc(d), []);
  const closeLegalDoc = useCallback(() => setDoc(null), []);

  return (
    <LegalDocModalContext.Provider value={{ doc, openLegalDoc, closeLegalDoc }}>
      {children}
    </LegalDocModalContext.Provider>
  );
}

export function useLegalDocModal() {
  const context = useContext(LegalDocModalContext);
  if (!context) throw new Error("useLegalDocModal must be used within LegalDocModalProvider");
  return context;
}
