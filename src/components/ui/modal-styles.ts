/**
 * 全站模态框圆角规范：
 * - 移动端 28px
 * - 桌面端 40px（2.5rem）
 * 与登录模态框 / 账户弹层保持一致。
 */
export const MODAL_RADIUS = "rounded-[28px] sm:rounded-[40px]";

/** 移动端底部弹层：只保留上圆角，桌面端恢复四角 */
export const MODAL_BOTTOM_SHEET_RADIUS = "max-sm:rounded-b-none";

export const SHEET_SIDE_RADIUS = {
    right: "rounded-l-[28px] sm:rounded-l-[40px]",
    left: "rounded-r-[28px] sm:rounded-r-[40px]",
    top: "rounded-b-[28px] sm:rounded-b-[40px]",
    bottom: "rounded-t-[28px] sm:rounded-t-[40px]",
} as const;
