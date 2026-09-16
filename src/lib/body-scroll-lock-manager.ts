/**
 * body 滚动锁的单例引用计数管理器（纯模块，不含 React 依赖）。
 *
 * 页面上可能同时存在多个加锁者（如首页 iosSafe 锁 + AuthModal iosSafe 锁 + 问卷页普通锁），
 * 旧实现里每个 hook 实例各自捕获/恢复 body 样式，解锁顺序交错时会互相踩踏：
 * 例如弹窗开着时导航离开，页面锁先把 body 恢复了，弹窗关闭时又把它捕获到的
 * `overflow: hidden; position: fixed; top: -Npx` 写回到新页面上，导致新页面被冻结/上移。
 *
 * 模块级单例管理：
 * - 第一个加锁者捕获并锁定，后续加锁只递增计数；
 * - 只有最后一个解锁者负责恢复 overflow，中间解锁不影响样式；
 * - iOS fixed 定位单独计数：任一 iosSafe 锁存在时生效，最后一个 iosSafe 锁释放时
 *   无条件移除（即使还有普通锁存活）——否则 body 会残留 position: fixed / top: -Npx，
 *   整页冻结无法滚动；
 * - 由 useBodyScrollLock 调用；enabled=false 的实例完全不触碰 body 样式。
 */

interface SavedBodyStyle {
    overflow: string;
    position: string;
    width: string;
    top: string;
}

let lockCount = 0;
let iosLockCount = 0;
let saved: SavedBodyStyle | null = null;
let savedScrollY = 0;
/** 本轮锁周期内是否应用过 fixed 定位（决定解锁时是否需要恢复滚动位置） */
let fixedApplied = false;

function removeFixedPositioning() {
    if (!saved) return;
    document.body.style.position = saved.position;
    document.body.style.width = saved.width;
    document.body.style.top = saved.top;
}

/**
 * 恢复加锁前的滚动位置。全局 html 是 scroll-behavior: smooth（globals.css），
 * 直接 window.scrollTo 会播放平滑滚动动画——解锁瞬间页面"慢悠悠滚回去"，
 * 看起来就是模态框关闭卡顿。临时切 auto 立即跳转后还原。
 */
function restoreScrollPosition() {
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, savedScrollY);
    html.style.scrollBehavior = prevBehavior;
}

export function acquireLock(useIos: boolean) {
    if (lockCount === 0) {
        saved = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            width: document.body.style.width,
            top: document.body.style.top,
        };
        savedScrollY = window.scrollY;
        fixedApplied = false;
        document.body.style.overflow = "hidden";
        // 打标供全局 CSS 响应（如模态框打开时底部 Dock 自动收起）
        document.body.setAttribute("data-scroll-locked", "");
    }
    lockCount++;

    if (useIos) {
        iosLockCount++;
        if (iosLockCount === 1) {
            document.body.style.position = "fixed";
            document.body.style.width = "100%";
            document.body.style.top = `-${savedScrollY}px`;
            fixedApplied = true;
        }
    }
}

export function releaseLock(useIos: boolean) {
    if (lockCount === 0 || !saved) return;

    if (useIos && iosLockCount > 0) {
        iosLockCount--;
        // 最后一个 iosSafe 锁释放：无条件移除 fixed 定位（overflow 是否保留由剩余普通锁决定）。
        // 旧逻辑要求 lockCount > 1 才移除，导致"唯一一把锁就是 iosSafe 锁"这一最常见场景下
        // body 永久残留 position: fixed / top: -Npx，整页冻结
        if (iosLockCount === 0) {
            removeFixedPositioning();
            restoreScrollPosition();
        }
    }

    lockCount--;
    if (lockCount === 0) {
        if (iosLockCount > 0) {
            // 计数漂移兜底（正常路径下 iosLockCount 此时必然已为 0）
            removeFixedPositioning();
            iosLockCount = 0;
        }
        document.body.style.overflow = saved.overflow;
        document.body.removeAttribute("data-scroll-locked");
        // 应用过 fixed 定位时，body 曾脱离文档流，需恢复加锁前的滚动位置，
        // 否则 iOS 解锁后页面会跳回顶部
        if (fixedApplied) {
            restoreScrollPosition();
        }
        saved = null;
        fixedApplied = false;
    }
}
