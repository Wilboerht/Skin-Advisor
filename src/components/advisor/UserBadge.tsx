"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useNavPush } from "@/hooks/use-nav-push";

interface UserBadgeProps {
    /** 当前派系中文名（如"水润派"）；未就绪/无派系时不展示 */
    personaLabel?: string;
}

// 会员等级角标与文案：REGULAR 视为普通（无角标）；历史值 ADVANCED 按金卡兜底
const MEMBERSHIP_BADGES: Record<string, { letter: string; color: string; label: string }> = {
    SILVER: { letter: "S", color: "#9AA3AF", label: "银卡会员" },
    GOLD: { letter: "G", color: "#C9A227", label: "金卡会员" },
    DIAMOND: { letter: "D", color: "#8E7CC3", label: "钻石会员" },
    ADVANCED: { letter: "G", color: "#C9A227", label: "金卡会员" },
};

export default function UserBadge({ personaLabel }: UserBadgeProps) {
    const { user, isInitialized } = useAuth();
    const { openAuthModal } = useAuthModal();
    // 预取档案页，点击跳转即时反馈
    const { push: navPush, isPending } = useNavPush(["/profile"]);
    const [avatarFailed, setAvatarFailed] = useState(false);
    // 用户/头像变化时重置失败标记（避免换账号后沿用上一个头像的失败态）
    useEffect(() => { setAvatarFailed(false); }, [user?.avatar]);

    const badge = useMemo(() => {
        const level = user?.membershipLevel;
        if (!level || level === "REGULAR") return undefined;
        return MEMBERSHIP_BADGES[level];
    }, [user?.membershipLevel]);

    const nickname = user?.name?.trim() || "我的档案";
    const initial = nickname.slice(0, 1).toUpperCase();

    // 桌面端第二行：会员等级 · 派系
    const subtitle = [badge?.label, personaLabel].filter(Boolean).join(" · ");

    // 未初始化：骨架占位（宽度与登录态实际占用接近，避免挂载后跳动）
    if (!isInitialized) {
        return (
            <div
                aria-hidden="true"
                className="w-[140px] h-8 lg:w-[180px] rounded-full bg-brand-charcoal/5 animate-pulse"
            />
        );
    }

    // 未登录：登录引导位（结果页注册转化高点）
    if (!user) {
        return (
            <button
                onClick={() => openAuthModal("login")}
                className="inline-flex items-center justify-center h-8 px-3.5 rounded-full border border-brand-charcoal/20 text-[12px] font-light tracking-[0.08em] text-brand-charcoal/70 hover:text-brand-charcoal hover:border-brand-charcoal/40 transition-colors whitespace-nowrap"
            >
                登录 / 注册
            </button>
        );
    }

    return (
        <button
            onClick={() => navPush("/profile")}
            disabled={isPending}
            className="group flex items-center gap-2 rounded-full py-1 pl-1 pr-2 lg:pr-3 hover:bg-brand-charcoal/5 transition-colors"
            aria-label={`${nickname}的个人档案`}
        >
            {/* 头像（含等级角标） */}
            <span className="relative shrink-0">
                {user.avatar && !avatarFailed ? (
                    <Image
                        src={user.avatar}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        className="w-7 h-7 lg:w-8 lg:h-8 rounded-full object-cover border border-brand-charcoal/10"
                        onError={() => setAvatarFailed(true)}
                    />
                ) : (
                    <span className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-[var(--color-brand-cocoa)]/15 border border-brand-charcoal/10 flex items-center justify-center text-[12px] lg:text-[13px] font-medium text-[var(--color-brand-cocoa)]">
                        {initial}
                    </span>
                )}
                {badge && (
                    <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white leading-none"
                        style={{ backgroundColor: badge.color }}
                        title={badge.label}
                    >
                        {badge.letter}
                    </span>
                )}
            </span>

            {/* 移动端仅昵称；桌面端昵称 + 等级·派系两行 */}
            <span className="flex flex-col items-start leading-tight">
                <span className="max-w-[96px] lg:max-w-[140px] truncate text-[12px] font-medium text-brand-charcoal group-hover:text-[var(--color-brand-cocoa)] transition-colors">
                    {nickname}
                </span>
                {subtitle && (
                    <span className="hidden lg:block max-w-[140px] truncate text-[10px] font-light tracking-[0.04em] text-brand-charcoal/50">
                        {subtitle}
                    </span>
                )}
            </span>
        </button>
    );
}
