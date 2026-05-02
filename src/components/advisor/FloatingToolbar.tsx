"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Share2,
    RotateCcw,
    MessageCircle,
    GripVertical,
    Home,
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
    onChat?: () => void;
    onHome?: () => void;
    onHoverChange?: (hovered: boolean) => void;
    visible?: boolean;
    className?: string;
}

const defaultActions = (
    onSharePoster?: () => void,
    onRetake?: () => void,
    onChat?: () => void,
    onHome?: () => void
): ToolbarAction[] => [
    {
        id: "share",
        icon: <Share2 className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "分享海报",
        onClick: onSharePoster,
        variant: "primary",
    },
    {
        id: "chat",
        icon: <MessageCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "顾问咨询",
        onClick: onChat,
    },
    {
        id: "retake",
        icon: <RotateCcw className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "重新测试",
        onClick: onRetake,
    },
    {
        id: "home",
        icon: <Home className="w-[18px] h-[18px]" strokeWidth={1.5} />,
        label: "回到首页",
        onClick: onHome,
    },
];

export function FloatingToolbar({
    actions,
    onSharePoster,
    onRetake,
    onChat,
    onHome,
    onHoverChange,
    visible = true,
    className = "",
}: FloatingToolbarProps) {
    const [isHovered, setIsHovered] = useState(false);

    if (!visible) return null;

    const toolbarActions = actions ?? defaultActions(onSharePoster, onRetake, onChat, onHome);

    const handleHoverChange = (hovered: boolean) => {
        setIsHovered(hovered);
        onHoverChange?.(hovered);
    };

    return (
        <motion.div
            className={`fixed right-4 top-1/2 -translate-y-1/2 z-[200] h-[280px] flex flex-col justify-end ${className}`}
            initial={false}
        >
            {/* 菜单项 - 绝对定位，底部和按钮对齐，向上展开 */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
                        className="absolute bottom-0 right-0 flex flex-col-reverse items-end gap-2 will-change-transform"
                        onMouseEnter={() => handleHoverChange(true)}
                        onMouseLeave={() => handleHoverChange(false)}
                    >
                        {toolbarActions.map((action, index) => (
                            <motion.button
                                key={action.id}
                                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                transition={{
                                    duration: 0.3,
                                    ease: [0.22, 1, 0.36, 1],
                                    delay: 0.15 + index * 0.05,
                                }}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => action.onClick?.()}
                                className={`
                                    group flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full
                                    backdrop-blur-xl border shadow-lg
                                    cursor-pointer
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
                                    `}
                                >
                                    {action.icon}
                                </div>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Collapsed trigger button - 位置固定，只做淡出 */}
            <motion.button
                onMouseEnter={() => handleHoverChange(true)}
                onMouseLeave={() => handleHoverChange(false)}
                onTouchStart={() => handleHoverChange(!isHovered)}
                animate={{
                    opacity: isHovered ? 0 : 1,
                    scale: isHovered ? 0.85 : 1,
                }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="
                    w-[52px] py-3 rounded-[20px]
                    bg-gradient-to-b from-[#FDFBF7]/95 to-[#F5F0E8]/95
                    backdrop-blur-xl
                    border border-[#4A3728]/8
                    shadow-[0_4px_16px_rgba(74,55,40,0.08)]
                    hover:shadow-[0_6px_20px_rgba(74,55,40,0.12)]
                    flex flex-col items-center gap-2
                    text-[#4A3728]
                    cursor-pointer
                    will-change-transform
                "
            >
                <div className="w-7 h-7 rounded-full bg-[#4A3728]/6 flex items-center justify-center">
                    <GripVertical className="w-3.5 h-3.5 text-[#4A3728]/70" strokeWidth={2} />
                </div>
                <div className="flex flex-col items-center leading-tight">
                    <span className="text-xs font-medium tracking-wider text-[#4A3728]/60">更多</span>
                    <span className="text-xs font-medium tracking-wider text-[#4A3728]/60">功能</span>
                </div>
            </motion.button>


        </motion.div>
    );
}
