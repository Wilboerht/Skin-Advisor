/**
 * 分享/海报保存的设备与浏览器判定（客户端）
 *
 * 从 ResultClient 抽取为纯函数，便于单测覆盖以下已修复的误判：
 * - 触屏 Windows 笔记本（maxTouchPoints > 1）不应被当作移动端走系统分享；
 * - 微信内置浏览器需区分移动端（长按保存）与桌面端（右键另存）。
 */

/** 移动端判定：UA 命中移动端关键字，或触屏设备（iPad 桌面 UA 走此分支）。
 *  明确排除 Windows：触屏笔记本主输入仍是鼠标，不应弹系统分享面板。 */
export function isMobileDevice(userAgent: string, maxTouchPoints: number): boolean {
    if (/iPhone|iPad|iPod|Android/i.test(userAgent)) return true;
    if (maxTouchPoints > 1 && !/Windows/i.test(userAgent)) return true;
    return false;
}

/** 微信内置浏览器（含移动端与桌面端） */
export function isWeChatBrowser(userAgent: string): boolean {
    return /MicroMessenger/i.test(userAgent);
}
