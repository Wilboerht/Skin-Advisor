"use client";

import { useEffect, useRef } from "react";
import { useMounted } from "./use-mounted";
import { useIsMobile } from "./useMediaQuery";

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
    const savedScrollY = useRef(0);

    useEffect(() => {
        // Skip SSR — body is not available during server rendering
        if (!mounted) return;

        const shouldUseIos = iosSafe && isMobile;
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalWidth = document.body.style.width;
        const originalTop = document.body.style.top;

        if (enabled) {
            document.body.style.overflow = "hidden";
            if (shouldUseIos) {
                savedScrollY.current = window.scrollY;
                document.body.style.position = "fixed";
                document.body.style.width = "100%";
                document.body.style.top = `-${savedScrollY.current}px`;
            }
        } else {
            document.body.style.overflow = originalOverflow || "";
            if (shouldUseIos) {
                document.body.style.position = originalPosition;
                document.body.style.width = originalWidth;
                document.body.style.top = originalTop;
            }
        }

        return () => {
            // Restore on clean-up (unmount or enabled→false)
            document.body.style.overflow = originalOverflow || "";
            if (shouldUseIos) {
                document.body.style.position = originalPosition;
                document.body.style.width = originalWidth;
                document.body.style.top = originalTop;
                // Restore scroll position
                if (originalTop?.startsWith("-")) {
                    window.scrollTo(0, parseInt(originalTop.replace("-", ""), 10) || savedScrollY.current);
                }
            }
        };
    }, [enabled, iosSafe, isMobile, mounted]);
}
