"use client";

import { useEffect } from "react";
import { useMounted } from "./use-mounted";
import { useIsMobile } from "./useMediaQuery";

interface UseBodyScrollLockOptions {
    /** Whether the lock is active */
    enabled: boolean;
    /** Use iOS-safe fixed positioning technique to prevent elastic/overscroll bounce */
    iosSafe?: boolean;
}

/**
 * 全局引用计数滚动锁。
 *
 * 页面上可能同时存在多个加锁者（如首页 iosSafe 锁 + AuthModal iosSafe 锁 + 问卷页普通锁），
 * 旧实现里每个 hook 实例各自捕获/恢复 body 样式，解锁顺序交错时会互相踩踏：
 * 例如弹窗开着时导航离开，页面锁先把 body 恢复了，弹窗关闭时又把它捕获到的
 * `overflow: hidden; position: fixed; top: -Npx` 写回到新页面上，导致新页面被冻结/上移。
 *
 * 现在改为模块级单例管理：
 * - 第一个加锁者捕获并锁定，后续加锁只递增计数；
 * - 只有最后一个解锁者负责恢复，中间解锁不影响样式；
 * - iOS fixed 定位单独计数：任一 iosSafe 锁存在时生效，全部释放后移除；
 * - enabled=false 的实例完全不触碰 body 样式（旧实现会在 effect 重跑时覆写 overflow）。
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

function acquireLock(useIos: boolean) {
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

function releaseLock(useIos: boolean) {
    if (lockCount === 0 || !saved) return;

    if (useIos && iosLockCount > 0) {
        iosLockCount--;
        // 仍有其他普通锁存在时，仅移除 fixed 定位，保留 overflow 锁定
        if (iosLockCount === 0 && lockCount > 1) {
            removeFixedPositioning();
            window.scrollTo(0, savedScrollY);
        }
    }

    lockCount--;
    if (lockCount === 0) {
        if (iosLockCount > 0) {
            removeFixedPositioning();
            iosLockCount = 0;
        }
        document.body.style.overflow = saved.overflow;
        document.body.removeAttribute("data-scroll-locked");
        // 应用过 fixed 定位时，body 曾脱离文档流，需恢复加锁前的滚动位置，
        // 否则 iOS 解锁后页面会跳回顶部
        if (fixedApplied) {
            window.scrollTo(0, savedScrollY);
        }
        saved = null;
        fixedApplied = false;
    }
}

/**
 * Lock body scroll while preserving scroll position.
 *
 * - Simple mode: sets `overflow: hidden` on `<body>`, restores on cleanup.
 * - iOS-safe mode (iosSafe=true): additionally uses `position: fixed` technique
 *   to prevent iOS Safari's elastic/overscroll bounce. Saves and restores
 *   `window.scrollY` so the page doesn't jump.
 *
 * 多个实例可同时使用，样式由全局引用计数统一管理（见文件顶部说明）。
 *
 * @example
 * // Simple lock (e.g., full-page modal, face-scan page)
 * useBodyScrollLock({ enabled: isOpen });
 *
 * @example
 * // iOS-safe lock (e.g., auth modal with mobile overlay)
 * useBodyScrollLock({ enabled: isOpen, iosSafe: true });
 */
export function useBodyScrollLock({ enabled, iosSafe = false }: UseBodyScrollLockOptions) {
    const mounted = useMounted();
    const isMobile = useIsMobile();

    useEffect(() => {
        // Skip SSR — body is not available during server rendering
        if (!mounted || !enabled) return;

        const useIos = iosSafe && isMobile;
        acquireLock(useIos);
        return () => releaseLock(useIos);
    }, [enabled, iosSafe, isMobile, mounted]);
}
