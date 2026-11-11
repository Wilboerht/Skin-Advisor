/**
 * 统一的评分档位与关注阈值（报告、雷达、区域地图、证据 chip 共用）。
 *
 * 口径：0-100，分数越高代表该维度状态越好。
 * 档位：85-100 优秀 / 70-84 良好 / 55-69 一般 / 40-54 需关注 / <40 较差。
 * 关注阈值：低于 70（未达到“良好”）统一标记为“需关注”，避免四处阈值不一致。
 */

export type ScoreBandKey = "excellent" | "good" | "average" | "fair" | "poor";

export interface ScoreBand {
    key: ScoreBandKey;
    label: string;
    min: number;
    /** 文本色（与报告现用品牌色系一致） */
    color: string;
    /** 浅底色（徽章/标签背景） */
    background: string;
}

export const SCORE_BANDS: ScoreBand[] = [
    { key: "excellent", label: "优秀", min: 85, color: "#3d7a4d", background: "rgba(61,122,77,0.10)" },
    { key: "good", label: "良好", min: 70, color: "#5c6f3d", background: "rgba(92,111,61,0.10)" },
    { key: "average", label: "一般", min: 55, color: "#8a6d3b", background: "rgba(138,109,59,0.10)" },
    { key: "fair", label: "需关注", min: 40, color: "#b06a3b", background: "rgba(176,106,59,0.10)" },
    { key: "poor", label: "较差", min: 0, color: "#c45a4a", background: "rgba(196,90,74,0.10)" },
];

/** 低于该值在雷达/区域地图/证据链统一标记为“需关注” */
export const ATTENTION_SCORE_THRESHOLD = 70;

export const SCORE_DIRECTION_HINT = "分数越高，代表该维度状态越好";

export function getScoreBand(score: number | null | undefined): ScoreBand | null {
    if (typeof score !== "number" || !Number.isFinite(score)) return null;
    const bounded = Math.min(100, Math.max(0, score));
    return SCORE_BANDS.find((band) => bounded >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

export function getScoreBandLabel(score: number | null | undefined): string {
    return getScoreBand(score)?.label ?? "—";
}

export function isAttentionScore(score: number | null | undefined): boolean {
    return typeof score === "number" && Number.isFinite(score) && score < ATTENTION_SCORE_THRESHOLD;
}

/** 分数变化噪声阈值：小于该值视为“基本持平” */
export const SCORE_NOISE_THRESHOLD = 3;
/** 肌龄变化噪声阈值：小于该值视为“基本持平” */
export const SKIN_AGE_NOISE_THRESHOLD = 2;
