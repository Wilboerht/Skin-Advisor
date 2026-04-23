"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Share2,
    RotateCcw,
    ArrowUp,
    MessageCircle,
    HelpCircle,
} from "lucide-react";

interface ToolbarAction {
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    variant?: "default" | "primary" | "danger";
}

interface FloatingToolbarProps {
    actions?: ToolbarAction[];
    onSharePoster?: () => void;
    onRetake?: () => void;
    onScrollTop?: () => void;
    onChat?: () => void;
    className?: string;
}

const defaultActions = (
    onSharePoster?: () => void,
    onRetake?: () => void,
    onScrollTop?: () => void,
    onChat?: () => void
): ToolbarAction[] => [
    {
        id: "share",
        icon: <Share2 className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "分享海报",
        onClick: onSharePoster,
        variant: "primary",
    },
    {
        id: "retake",
        icon: <RotateCcw className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "重新测试",
        onClick: onRetake,
    },
    {
        id: "chat",
        icon: <MessageCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "AI 咨询",
        onClick: onChat,
    },
    {
        id: "top",
        icon: <ArrowUp className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "回到顶部",
        onClick: onScrollTop,
    },
];

export function FloatingToolbar({
    actions,
    onSharePoster,
    onRetake,
    onScrollTop,
    onChat,
    className = "",
}: FloatingToolbarProps) {
    const [isHovered, setIsHovered] = useState(false);

    const toolbarActions = actions ?? defaultActions(onSharePoster, onRetake, onScrollTop, onChat);

    const handleScrollTop = () => {
        if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        onScrollTop?.();
    };

    return (
        <motion.div
            className={`fixed right-4 top-1/2 -translate-y-1/2 z-[200] flex flex-col items-end gap-2 ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={false}
        >
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="flex flex-col gap-2 items-end"
                    >
                        {toolbarActions.map((action, index) => (
                            <motion.button
                                key={action.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.04 }}
                                onClick={() => {
                                    if (action.id === "top") {
                                        handleScrollTop();
                                    } else {
                                        action.onClick?.();
                                    }
                                }}
                                className={`
                                    group flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full
                                    backdrop-blur-xl border shadow-lg
                                    transition-all duration-300 cursor-pointer
                                    ${action.variant === "primary"
                                        ? "bg-[#4A3728]/90 border-[#4A3728]/20 text-[#FDFBF7] hover:bg-[#4A3728] shadow-[#4A3728]/20"
                                        : action.variant === "danger"
                                            ? "bg-red-500/90 border-red-500/20 text-white hover:bg-red-500"
                                            : "bg-[#FDFBF7]/85 border-[#4A3728]/10 text-[#4A3728] hover:bg-white hover:shadow-xl"
                                    }
                                `}
                            >
                                <span className="text-[13px] font-medium tracking-wide whitespace-nowrap">
                                    {action.label}
                                </span>
                                <div
                                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center
                                        ${action.variant === "primary"
                                            ? "bg-white/15"
                                            : "bg-[#4A3728]/5 group-hover:bg-[#4A3728]/10"
                                        }
                                        transition-colors duration-300
                                    `}
                                >
                                    {action.icon}
                                </div>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Collapsed trigger button */}
            <motion.button
                animate={{
                    scale: isHovered ? 0.8 : 1,
                    opacity: isHovered ? 0 : 1,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="
                    w-11 h-11 rounded-full
                    bg-[#FDFBF7]/90 backdrop-blur-xl
                    border border-[#4A3728]/10
                    shadow-lg hover:shadow-xl
                    flex items-center justify-center
                    text-[#4A3728]
                    transition-shadow duration-300
                    cursor-pointer
                "
            >
                <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
            </motion.button>
        </motion.div>
    );
}
