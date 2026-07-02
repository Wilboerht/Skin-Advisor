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

        const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus the first focusable element, or the container itself if none
        if (firstElement) {
            firstElement.focus();
        } else {
            container.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;

            if (focusableElements.length === 0) {
                e.preventDefault();
                return;
            }

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
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
