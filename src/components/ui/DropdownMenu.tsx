"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    /** Anchor element for positioning */
    anchorEl: HTMLElement | null;
    align?: "left" | "right";
}

export function DropdownMenu({
    isOpen,
    onClose,
    children,
    anchorEl,
    align = "right",
}: DropdownMenuProps) {
    const [mounted, setMounted] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{
        top: number;
        right?: number;
        left?: number;
    }>({ top: 0 });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen || !anchorEl) return;

        const rect = anchorEl.getBoundingClientRect();
        if (align === "right") {
            setPos({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
            });
        } else {
            setPos({ top: rect.bottom + 4, left: rect.left });
        }
    }, [isOpen, anchorEl, align]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div
            ref={menuRef}
            data-dropdown-menu
            className="fixed z-[9998] w-44 overflow-hidden rounded-lg border border-brand-charcoal/10 bg-white py-1 shadow-xl"
            style={pos}
        >
            {children}
        </div>,
        document.body,
    );
}

interface DropdownMenuItemProps {
    onClick: () => void;
    icon?: ReactNode;
    children: ReactNode;
    danger?: boolean;
}

export function DropdownMenuItem({
    onClick,
    icon,
    children,
    danger,
}: DropdownMenuItemProps) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                danger
                    ? "text-red-600 hover:bg-red-50"
                    : "text-brand-charcoal/80 hover:bg-brand-charcoal/[0.06]"
            }`}
        >
            {icon}
            <span>{children}</span>
        </button>
    );
}
