import { m, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";

interface BaseModalProps {
    isOpen: boolean;
    onClose?: () => void;
    children: React.ReactNode;
    className?: string;
    backdropClassName?: string;
    showCloseButton?: boolean;
}

export function BaseModal({
    isOpen,
    onClose,
    children,
    className = "p-8 text-center bg-white",
    backdropClassName = "bg-[#FDFBF7]/80 backdrop-blur-sm",
    showCloseButton = false,
}: BaseModalProps) {
    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <m.div
                        className={`absolute inset-0 ${backdropClassName}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <m.div
                        className={`relative z-10 w-full max-w-sm shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-[#3D4430]/5 ${className}`}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {showCloseButton && onClose && (
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 z-20 text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors bg-transparent border-none cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                        {children}
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );

    if (typeof document !== "undefined") {
        return createPortal(modalContent, document.body);
    }
    return null;
}
