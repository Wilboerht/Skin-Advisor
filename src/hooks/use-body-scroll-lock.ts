"use client";

import { useEffect } from "react";
import { useMounted } from "./use-mounted";
import { useIsMobile } from "./useMediaQuery";
import { acquireLock, releaseLock } from "@/lib/body-scroll-lock-manager";

interface UseBodyScrollLockOptions {
    /** Whether the lock is active */
    enabled: boolean;
    /** Use iOS-safe fixed positioning technique to prevent elastic/overscroll bounce */
    iosSafe?: boolean;
}

/**
 * Lock body scroll while preserving scroll position.
 *
 * - Simple mode: sets `overflow: hidden` on `<body>`, restores on cleanup.
 * - iOS-safe mode (iosSafe=true): additionally uses `position: fixed` technique
 *   to prevent iOS Safari's elastic/overscroll bounce. Saves and restores
 *   `window.scrollY` so the page doesn't jump.
 *
 * 多个实例可同时使用，样式由全局引用计数统一管理
 *（见 `@/lib/body-scroll-lock-manager` 顶部说明）。
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
