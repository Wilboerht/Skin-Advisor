"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface DiaryModalContextType {
  isOpen: boolean;
  openDiaryModal: () => void;
  closeDiaryModal: () => void;
}

const DiaryModalContext = createContext<DiaryModalContextType | undefined>(undefined);

/**
 * DiaryModalProvider — 「护肤档案」弹层的全局开关（与 AuthModalContext 同构）
 * 入口：底部 Dock、账户弹层等；弹层本体 <DiaryModal /> 挂载于根 layout。
 */
export function DiaryModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openDiaryModal = useCallback(() => setIsOpen(true), []);
  const closeDiaryModal = useCallback(() => setIsOpen(false), []);

  return (
    <DiaryModalContext.Provider value={{ isOpen, openDiaryModal, closeDiaryModal }}>
      {children}
    </DiaryModalContext.Provider>
  );
}

export function useDiaryModal() {
  const context = useContext(DiaryModalContext);
  if (!context) throw new Error("useDiaryModal must be used within DiaryModalProvider");
  return context;
}
