import {
    Blend,
    Circle,
    Feather,
    Flame,
    Gem,
    Shield,
    Snowflake,
    Sun,
    Sparkles,
    type LucideIcon,
} from "lucide-react";

/** 派系配套图标（按 ipKey）：展示于派系名前方 */
export const FACTION_ICONS: Record<string, LucideIcon> = {
    sensitive: Feather,
    minimalist: Circle,
    luxury: Gem,
    ageless: Snowflake,
    desert: Sun,
    oily: Flame,
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

/**
 * 派系形象视觉重心（实测各形象 webp 非透明像素边界，人物在 960×1280 画布内并不居中）：
 * x/y 为人物像素中心在画布内的位置（%），d 为圆形背景直径（占画面高度 %，约人物高度 ×1.1）。
 * 用于详情弹窗头部人物形象的圆形衬底定位。
 */
export const FACTION_PORTRAIT_SPOTS: Record<string, { x: number; y: number; d: number }> = {
    sensitive: { x: 48.3, y: 52.2, d: 93 },
    minimalist: { x: 52.6, y: 53.9, d: 91 },
    luxury: { x: 50.1, y: 55.2, d: 88 },
    ageless: { x: 54.9, y: 51.1, d: 95 },
    desert: { x: 52.2, y: 51.7, d: 94 },
    oily: { x: 52.3, y: 48.6, d: 100 },
    combination: { x: 56.0, y: 52.6, d: 92 },
    guardian: { x: 47.3, y: 50.1, d: 98 },
};

/** 未知 ipKey 兜底为画面中心 */
export function getFactionPortraitSpot(ipKey: string): { x: number; y: number; d: number } {
    return FACTION_PORTRAIT_SPOTS[ipKey] ?? { x: 50, y: 50, d: 92 };
}
