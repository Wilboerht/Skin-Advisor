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

// 嵌套弹层栈：仅最上层弹层响应 Escape，避免"一次 Esc 连关多层"
interface TrapEntry {
    id: symbol;
    container: HTMLElement;
}
const trapStack: TrapEntry[] = [];

// 背景 inert：让屏幕阅读器/键盘无法进入弹层背后的页面内容
const inertedElements = new Set<HTMLElement>();

function restoreInert(): void {
    for (const element of inertedElements) {
        element.inert = false;
    }
    inertedElements.clear();
}

function applyInert(container: HTMLElement): void {
    let node: HTMLElement | null = container;
    while (node) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) break;
        for (const sibling of Array.from(parent.children)) {
            if (sibling === node || !(sibling instanceof HTMLElement)) continue;
            const tag = sibling.tagName;
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK") continue;
            if (sibling.inert || inertedElements.has(sibling)) continue;
            sibling.inert = true;
            inertedElements.add(sibling);
        }
        if (parent === document.body) break;
        node = parent;
    }
}

export function useFocusTrap<T extends HTMLElement>(isOpen: boolean, onEscape?: () => void) {
    const containerRef = useRef<T>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);
    // 用 ref 持有回调，避免调用方传入内联函数导致 effect 反复重建
    const onEscapeRef = useRef(onEscape);
    useEffect(() => {
        onEscapeRef.current = onEscape;
    }, [onEscape]);

    useEffect(() => {
        if (!isOpen) return;

        previousActiveElement.current = document.activeElement as HTMLElement | null;

        const container = containerRef.current;
        if (!container) return;

        const trapId = Symbol("focus-trap");
        trapStack.push({ id: trapId, container });
        // 重新计算背景 inert：嵌套弹层打开时，内层成为唯一可交互区域
        restoreInert();
        applyInert(container);

        // 动态获取可聚焦元素（支持模态框内容动态变化，如 loading → 内容）
        const getFocusableElements = () =>
            Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
                (el) => el.offsetParent !== null // 排除不可见元素
            );

        const focusableElements = getFocusableElements();
        const firstElement = focusableElements[0];

        // 聚焦第一个可聚焦元素，或容器本身
        // 触屏设备（hover: none）跳过自动聚焦，避免 iOS 弹虚拟键盘；
        // preventScroll 防止 iOS Safari 因程序化聚焦把页面滚动进可视区而跳动
        const isTouchDevice = window.matchMedia("(hover: none)").matches;
        if (!isTouchDevice) {
            (firstElement ?? container).focus({ preventScroll: true });
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            // 只有最上层弹层处理键盘事件，避免嵌套弹层互相抢焦点/重复关闭
            if (trapStack[trapStack.length - 1]?.id !== trapId) return;
            if (e.key === "Escape") {
                onEscapeRef.current?.();
                return;
            }
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
            const idx = trapStack.findIndex((entry) => entry.id === trapId);
            if (idx >= 0) trapStack.splice(idx, 1);
            restoreInert();
            const top = trapStack[trapStack.length - 1];
            if (top) applyInert(top.container);
            previousActiveElement.current?.focus({ preventScroll: true });
        };
    }, [isOpen]);

    return containerRef;
}
