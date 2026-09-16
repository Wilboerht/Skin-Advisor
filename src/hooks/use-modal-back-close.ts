"use client";

import { useEffect, useRef } from "react";
import { getModalHistory } from "@/lib/modal-history";

/** 会话内唯一 id 序列（HMR 重置无影响：旧会话已随组件卸载清理） */
let modalIdSeq = 0;

/**
 * useModalBackClose — 移动端返回键/返回手势关闭弹层
 *
 * 用法：`useModalBackClose(isOpen, onClose)`。弹层打开期间按返回键先关弹层，
 * 关闭后再按返回才离开页面；UI 主动关闭时会自动清理历史哨兵（无栈残留）。
 *
 * 支持嵌套（档案 → 打卡）与同 tick 交接（我的 → 护肤档案），详见 modal-history.ts。
 */
export function useModalBackClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const id = `modal-${++modalIdSeq}`;
    getModalHistory().open(id, () => onCloseRef.current());
    return () => getModalHistory().close(id);
  }, [isOpen]);
}
