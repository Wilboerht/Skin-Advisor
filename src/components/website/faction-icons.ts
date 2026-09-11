import {
    Blend,
    Feather,
    Gem,
    Minus,
    Shield,
    Snowflake,
    Sun,
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
    desert: Sun,
    oily: Waves,
    combination: Blend,
    guardian: Shield,
};

/** 未知 ipKey 兜底为 Sparkles，避免渲染崩溃 */
export function getFactionIcon(ipKey: string): LucideIcon {
    return FACTION_ICONS[ipKey] ?? Sparkles;
}

/**
 * 派系边缘纹理（卡片顶部饰条背景）：颜色与图案契合各派系气质
 * - 敏敏派：柔粉细点（温柔）
 * - 极简派：中性细线（克制）
 * - 奢华派：金色斜纹细条（精致）
 * - 冻龄派：冰蓝圆点（清透）
 * - 沙漠派：沙色疏点（干爽）
 * - 油条派：暖琥珀短横条（利落）
 * - 混合派：绿金对半（双区）
 * - 守护派：钢蓝实线（稳重）
 */
export const FACTION_EDGE_TEXTURES: Record<string, string> = {
    sensitive: "radial-gradient(#E4A6B5 1.5px, transparent 1.5px) 0 0/10px 6px",
    minimalist: "linear-gradient(#A9A29A 0 0) center/55% 1px no-repeat",
    luxury: "repeating-linear-gradient(135deg, #C9A86C 0 2px, transparent 2px 7px)",
    ageless: "radial-gradient(#A8C6DF 1.5px, transparent 1.5px) 0 0/9px 6px",
    desert: "radial-gradient(#D9B98C 1.5px, transparent 1.5px) 0 0/11px 6px",
    oily: "repeating-linear-gradient(90deg, #E0A75E 0 4px, transparent 4px 10px)",
    combination: "linear-gradient(90deg, #8FB7A8 0 50%, #C9A86C 50% 100%)",
    guardian: "linear-gradient(#6B8CAE 0 0)",
};

/** 未知 ipKey 兜底为金棕实线 */
export function getFactionEdgeTexture(ipKey: string): string {
    return FACTION_EDGE_TEXTURES[ipKey] ?? "linear-gradient(#C9A86C 0 0)";
}

/** 派系主色（与边缘纹理同一套配色，供导航 chip 激活态等使用） */
export const FACTION_ACCENTS: Record<string, string> = {
    sensitive: "#E4A6B5",
    minimalist: "#A9A29A",
    luxury: "#C9A86C",
    ageless: "#A8C6DF",
    desert: "#D9B98C",
    oily: "#E0A75E",
    combination: "#8FB7A8",
    guardian: "#6B8CAE",
};

/** 未知 ipKey 兜底金棕 */
export function getFactionAccent(ipKey: string): string {
    return FACTION_ACCENTS[ipKey] ?? "#C9A86C";
}
