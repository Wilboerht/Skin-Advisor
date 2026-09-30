"use client";

/**
 * 用户面板共享外壳（三段式，移植自官网 user-center/PanelShell）：
 * - 最外层：flex h-full flex-col pt-4 md:pt-10（embedded 时去掉顶部留白）
 * - 桌面标题行：hidden ... md:flex（移动端标题由账户弹层全局 Header 管理）
 * - 滚动内容区：scrollbar-hide flex-1 overflow-y-auto overscroll-contain px-6 py-6 md:px-16
 */
import type { ReactNode, Ref, UIEventHandler } from "react";

export const PANEL_ROOT_CLASS = "flex h-full flex-col pt-4 md:pt-10";
export const PANEL_HEADER_CLASS =
  "hidden flex-shrink-0 border-b border-stone-200/60 px-6 pb-6 md:flex md:px-16";
export const PANEL_TITLE_CLASS = "text-xl font-medium tracking-wide text-stone-800";
export const PANEL_SCROLL_CLASS =
  "scrollbar-hide flex-1 overflow-y-auto overscroll-contain px-6 py-6 md:px-16";

interface PanelShellProps {
  /** 桌面端标题行文字 */
  title: string;
  /** 标题行右侧附加内容（如 DiaryPanel 的「去测肤 + 今日打卡」操作区） */
  headerExtra?: ReactNode;
  /** 内嵌场景使用：去掉顶部留白、不渲染标题行（滚动/内边距仍由本外壳承担） */
  embedded?: boolean;
  /** 仅隐藏标题行、保留顶部留白 */
  hideTitle?: boolean;
  testId?: string;
  /** 滚动区 ref（视图切换回顶部等场景） */
  scrollRef?: Ref<HTMLDivElement>;
  /** 滚动区滚动回调（无限滚动等场景） */
  onScroll?: UIEventHandler<HTMLDivElement>;
  /** 滚动区附加类名（如 DiaryPanel 需要 min-h-0） */
  scrollClassName?: string;
  children: ReactNode;
}

export function PanelShell({
  title,
  headerExtra,
  embedded,
  hideTitle,
  testId,
  scrollRef,
  onScroll,
  scrollClassName,
  children,
}: PanelShellProps) {
  return (
    <div
      className={embedded ? "flex h-full flex-col" : PANEL_ROOT_CLASS}
      data-testid={testId}
    >
      {!embedded && !hideTitle && (
        <div
          className={`${PANEL_HEADER_CLASS}${headerExtra ? " items-center gap-4" : ""}`}
        >
          <h2 className={PANEL_TITLE_CLASS}>{title}</h2>
          {headerExtra}
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={
          scrollClassName ? `${PANEL_SCROLL_CLASS} ${scrollClassName}` : PANEL_SCROLL_CLASS
        }
      >
        {children}
      </div>
    </div>
  );
}
