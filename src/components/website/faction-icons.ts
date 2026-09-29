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
 * - 混合派：玫瑰与灰对半（双区）
 * - 守护派：灰绿实线（稳重）
 */
export const FACTION_EDGE_TEXTURES: Record<string, string> = {
    sensitive: "radial-gradient(#E4A6B5 1.5px, transparent 1.5px) 0 0/10px 6px",
    minimalist: "linear-gradient(#A9A29A 0 0) center/55% 1px no-repeat",
    luxury: "repeating-linear-gradient(135deg, #C9A86C 0 2px, transparent 2px 7px)",
    ageless: "radial-gradient(#A8C6DF 1.5px, transparent 1.5px) 0 0/9px 6px",
    desert: "radial-gradient(#D9B98C 1.5px, transparent 1.5px) 0 0/11px 6px",
    oily: "repeating-linear-gradient(90deg, #E0A75E 0 4px, transparent 4px 10px)",
    combination: "linear-gradient(90deg, #C98B98 0 50%, #A9A29A 50% 100%)",
    guardian: "linear-gradient(#A8C4A1 0 0)",
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
    combination: "#C98B98",
    guardian: "#A8C4A1",
};

/** 未知 ipKey 兜底金棕 */
export function getFactionAccent(ipKey: string): string {
    return FACTION_ACCENTS[ipKey] ?? "#C9A86C";
}

/**
 * 派系形象视觉重心（实测各形象 webp 非透明像素边界，人物在 960×1280 画布内并不居中）：
 * x/y 为圆心在画布内的位置（%，y 按圆底边略低于人物脚底约 3% 反推），d 为圆形背景直径
 * （占画面高度 %，约人物高度的 85%）。用于详情弹窗头部人物形象的圆形衬底定位。
 */
export const FACTION_PORTRAIT_SPOTS: Record<string, { x: number; y: number; d: number }> = {
    sensitive: { x: 48.3, y: 61.3, d: 72 },
    minimalist: { x: 52.6, y: 63.2, d: 70 },
    luxury: { x: 50.1, y: 64.2, d: 68 },
    ageless: { x: 54.9, y: 60.5, d: 74 },
    desert: { x: 52.2, y: 61.4, d: 72 },
    oily: { x: 52.3, y: 58.6, d: 78 },
    combination: { x: 56.0, y: 62.0, d: 71 },
    guardian: { x: 47.3, y: 59.7, d: 76 },
};

/** 未知 ipKey 兜底为画面中心偏下（圆底对齐 97.5% 处） */
export function getFactionPortraitSpot(ipKey: string): { x: number; y: number; d: number } {
    return FACTION_PORTRAIT_SPOTS[ipKey] ?? { x: 50, y: 61.5, d: 72 };
}
