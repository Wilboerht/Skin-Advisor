/**
 * 肌肤趋势维度取值（皱纹/水油/色斑/纹理）的形状兼容解析。
 *
 * 背景：`texture` 从来不属于十维维度（它是 6 区域指标），
 * 历史与现有报告的 `faceAnalysis.dimensions.texture` 恒缺失；
 * 旧实现用 `|| 0` 兜底会把趋势线压到 0 分基线，既失真又误导。
 *
 * 统一口径：
 * - 维度分存在 → 直接使用（兼容未来/历史数据）；
 * - texture 缺失 → 回退 6 区域 texture 均值（0-100，越高越细腻；
 *   新旧 prompt 对 texture 均为"越高越好"，跨版本可比）；
 * - 仍无数据 → null 表示断点，而不是伪造 0 分；
 * - 冷层归档摘要只有 dimensions 没有 zoneAnalysis，也能正确解析。
 */

export const TREND_DIMENSION_KEYS = ["wrinkles", "waterOil", "spots", "texture"] as const;
export type TrendDimensionKey = (typeof TREND_DIMENSION_KEYS)[number];

export interface TrendDimensionScores {
    wrinkles: number | null;
    waterOil: number | null;
    spots: number | null;
    texture: number | null;
}

interface FaceAnalysisLike {
    dimensions?: Record<string, { score?: unknown } | undefined>;
    zoneAnalysis?: Record<string, { texture?: unknown } | undefined>;
}

function toScore(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.min(100, Math.max(0, Math.round(value)));
}

/** 区域纹理均值：仅统计存在的数值；无有效区域返回 null */
export function resolveZoneTextureAverage(faceAnalysis: unknown): number | null {
    const zones = (faceAnalysis as FaceAnalysisLike | null | undefined)?.zoneAnalysis;
    if (!zones || typeof zones !== "object") return null;
    const values = Object.values(zones)
        .map((zone) => toScore(zone?.texture))
        .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** 解析单个趋势维度分；texture 缺失时回退区域纹理均值 */
export function resolveTrendDimensionScore(faceAnalysis: unknown, key: TrendDimensionKey): number | null {
    const face = faceAnalysis as FaceAnalysisLike | null | undefined;
    if (!face) return null;
    const direct = toScore(face.dimensions?.[key]?.score);
    if (direct !== null) return direct;
    if (key === "texture") return resolveZoneTextureAverage(face);
    return null;
}

/** 解析趋势四维（每个字段独立兜底） */
export function resolveTrendDimensions(faceAnalysis: unknown): TrendDimensionScores {
    return {
        wrinkles: resolveTrendDimensionScore(faceAnalysis, "wrinkles"),
        waterOil: resolveTrendDimensionScore(faceAnalysis, "waterOil"),
        spots: resolveTrendDimensionScore(faceAnalysis, "spots"),
        texture: resolveTrendDimensionScore(faceAnalysis, "texture"),
    };
}
