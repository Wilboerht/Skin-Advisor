/**
 * 客户端本地日历日工具 — 全站唯一实现。
 * 使用方：护肤档案时间线、打卡弹层、测肤自动日记（useAsyncAnalysis）。
 */

/** 客户端本地日历日 → YYYY-MM-DD（"当日"判据，与 PRD 时区方案一致） */
export function localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
