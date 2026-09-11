import {
    Blend,
    Droplets,
    Feather,
    Gem,
    Minus,
    Shield,
    Snowflake,
    Waves,
    Sparkles,
    type LucideIcon,
} from "lucide-react";

/** 派系配套图标（按 ipKey）：展示于派系名前方 */
export const FACTION_ICONS: Record<string, LucideIcon> = {
    sensitive: Feather,
    minimalist: Minus,
    luxury: Gem,
    ageless: Snowflake,
    desert: Droplets,
    oily: Waves,
    combination: Blend,
    guardian: Shield,
};

/** 未知 ipKey 兜底为 Sparkles，避免渲染崩溃 */
export function getFactionIcon(ipKey: string): LucideIcon {
    return FACTION_ICONS[ipKey] ?? Sparkles;
}
