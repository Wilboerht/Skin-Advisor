"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useFocusTrap<T extends HTMLElement>(isOpen: boolean) {
    const containerRef = useRef<T>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        previousActiveElement.current = document.activeElement as HTMLElement | null;

        const container = containerRef.current;
        if (!container) return;

        // 动态获取可聚焦元素（支持模态框内容动态变化，如 loading → 内容）
        const getFocusableElements = () =>
            Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
                (el) => el.offsetParent !== null // 排除不可见元素
            );

        const focusableElements = getFocusableElements();
        const firstElement = focusableElements[0];

        // 聚焦第一个可聚焦元素，或容器本身
        if (firstElement) {
            firstElement.focus();
        } else {
            container.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;

            // 每次 Tab 时实时查询，确保动态内容变化后焦点循环仍正确
            const currentFocusable = getFocusableElements();
            if (currentFocusable.length === 0) {
                e.preventDefault();
                return;
            }

            const first = currentFocusable[0];
            const last = currentFocusable[currentFocusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first || !container.contains(document.activeElement)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last || !container.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previousActiveElement.current?.focus();
        };
    }, [isOpen]);

    return containerRef;
}
