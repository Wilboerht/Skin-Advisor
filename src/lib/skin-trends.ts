/**
 * 肌肤评分趋势查询（公共路由 /api/user/skin-trends 与内部接口共用）
 *
 * Phase 3 起优先读 SkinAssessment 汇总表：
 * - 十维 + 六区域 + 综合分，不再只返回四维；
 * - 汇总表缺失时回退旧 analysisResult JSON（历史数据兼容）；
 * - 同日多次测肤由前端按本地时区聚合；这里保留每次记录，最多 100 条。
 */
import prisma from "@/lib/prisma";
import { DIMENSION_LABELS, DIMENSION_ORDER } from "@/lib/advisor-labels";
import { resolveTrendDimensions } from "@/lib/trend-dimensions";

const ZONE_KEYS = ["forehead", "tZone", "leftCheek", "rightCheek", "eyeArea", "jawline"] as const;
const ZONE_METRIC_KEYS = ["oil", "texture", "wrinkles", "spots", "redness", "darkCircles", "firmness", "contour"] as const;
const ZONE_METRIC_LABELS: Record<(typeof ZONE_METRIC_KEYS)[number], string> = {
    oil: "水油",
    texture: "细腻度",
    wrinkles: "无纹度",
    spots: "无斑度",
    redness: "无泛红",
    darkCircles: "眼周",
    firmness: "紧致度",
    contour: "轮廓",
};

export interface SkinTrendMetric {
    key: string;
    label: string;
    values: (number | null)[];
}

export interface SkinTrends {
    dates: Date[];
    scores: number[];
    /** 兼容旧消费方：至少包含 wrinkles / waterOil / spots / texture，并扩展全部十维 */
    dimensions: Record<string, (number | null)[]>;
    /** 新消费方：综合分 + 十维 + 细腻度，带中文标签 */
    metrics: SkinTrendMetric[];
    /** 区域趋势：6 区域 × 8 指标 */
    zones?: Record<string, SkinTrendMetric[]>;
}

interface TrendFaceAnalysis {
    overallScore?: number;
}

const asFaceAnalysis = (result: unknown): TrendFaceAnalysis | undefined =>
    (result as { faceAnalysis?: TrendFaceAnalysis } | null | undefined)?.faceAnalysis;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function toScore(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.min(100, Math.max(0, Math.round(value)));
}

function dimensionScore(dimensions: Record<string, unknown> | null, key: string): number | null {
    const dim = asRecord(dimensions?.[key]);
    return toScore(dim?.score);
}

function zoneTextureAverage(zones: Record<string, unknown> | null): number | null {
    if (!zones) return null;
    const values: number[] = [];
    for (const zone of Object.values(zones)) {
        const record = asRecord(zone);
        const value = toScore(record?.texture);
        if (value !== null) values.push(value);
    }
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildMetrics(
    dates: Date[],
    scores: number[],
    rows: Array<{ dimensions: Record<string, unknown> | null; zones: Record<string, unknown> | null }>
): { dimensions: Record<string, (number | null)[]>; metrics: SkinTrendMetric[] } {
    const dimensions: Record<string, (number | null)[]> = {};
    for (const key of DIMENSION_ORDER) {
        dimensions[key] = rows.map((row) => dimensionScore(row.dimensions, key));
    }
    // texture 不属于十维，由六区域 texture 均值派生（与旧趋势口径一致）
    dimensions.texture = rows.map((row) => zoneTextureAverage(row.zones));

    const metrics: SkinTrendMetric[] = [
        { key: "overall", label: "综合评分", values: scores },
        ...DIMENSION_ORDER
            .filter((key) => dimensions[key].some((value) => value !== null))
            .map((key) => ({
                key,
                label: DIMENSION_LABELS[key] || key,
                values: dimensions[key],
            })),
        ...(dimensions.texture.some((value) => value !== null)
            ? [{ key: "texture", label: "细腻度", values: dimensions.texture }]
            : []),
    ];
    return { dimensions, metrics };
}

function buildZoneMetrics(rows: Array<{ zones: Record<string, unknown> | null }>): Record<string, SkinTrendMetric[]> {
    const result: Record<string, SkinTrendMetric[]> = {};
    for (const zoneKey of ZONE_KEYS) {
        const metrics = ZONE_METRIC_KEYS.map((metricKey) => ({
            key: metricKey,
            label: ZONE_METRIC_LABELS[metricKey],
            values: rows.map((row) => {
                const zone = asRecord(row.zones?.[zoneKey]);
                return toScore(zone?.[metricKey]);
            }),
        })).filter((metric) => metric.values.some((value) => value !== null));
        if (metrics.length > 0) result[zoneKey] = metrics;
    }
    return result;
}

async function getAssessmentTrends(userId: string): Promise<SkinTrends | null> {
    const rows = await prisma.skinAssessment.findMany({
        where: { userId },
        orderBy: { completedAt: "desc" },
        take: 100,
        select: {
            completedAt: true,
            overallScore: true,
            dimensions: true,
            zones: true,
        },
    });
    const valid = rows
        .filter((row) => typeof row.overallScore === "number" && (row.overallScore as number) > 0)
        .reverse();
    if (valid.length < 2) return null;

    const dates = valid.map((row) => row.completedAt);
    const scores = valid.map((row) => Math.round(row.overallScore as number));
    const normalized = valid.map((row) => ({
        dimensions: asRecord(row.dimensions),
        zones: asRecord(row.zones),
    }));
    const { dimensions, metrics } = buildMetrics(dates, scores, normalized);
    const zones = buildZoneMetrics(normalized);
    return {
        dates,
        scores,
        dimensions,
        metrics,
        ...(Object.keys(zones).length > 0 ? { zones } : {}),
    };
}

async function getLegacyTrends(userId: string): Promise<SkinTrends | null> {
    const recentSessions = (
        await prisma.advisorSession.findMany({
            where: {
                user: { id: userId },
                completedAt: { not: null },
            },
            orderBy: { completedAt: "desc" },
            take: 100,
            select: {
                completedAt: true,
                analysisResult: true,
            },
        })
    ).reverse();

    const validSessions = recentSessions.filter((s) => {
        const score = asFaceAnalysis(s.analysisResult)?.overallScore;
        return typeof score === "number" && Number.isFinite(score) && score > 0;
    });
    if (validSessions.length < 2) return null;

    const dates = validSessions.map((s) => s.completedAt as Date);
    const scores = validSessions.map((s) => Math.round(asFaceAnalysis(s.analysisResult)?.overallScore as number));
    const dimensions = validSessions.map((s) => {
        const raw = s.analysisResult as { faceAnalysis?: unknown } | null | undefined;
        return resolveTrendDimensions(raw?.faceAnalysis);
    });

    const dimensionSeries = (key: keyof (typeof dimensions)[number]) =>
        dimensions.map((point) => point[key]);
    const dimensionsRecord: Record<string, (number | null)[]> = {
        wrinkles: dimensionSeries("wrinkles"),
        waterOil: dimensionSeries("waterOil"),
        spots: dimensionSeries("spots"),
        texture: dimensionSeries("texture"),
    };
    const metrics: SkinTrendMetric[] = [
        { key: "overall", label: "综合评分", values: scores },
        { key: "wrinkles", label: DIMENSION_LABELS.wrinkles, values: dimensionsRecord.wrinkles },
        { key: "waterOil", label: DIMENSION_LABELS.waterOil, values: dimensionsRecord.waterOil },
        { key: "spots", label: DIMENSION_LABELS.spots, values: dimensionsRecord.spots },
        { key: "texture", label: "细腻度", values: dimensionsRecord.texture },
    ];
    return { dates, scores, dimensions: dimensionsRecord, metrics };
}

/** 汇总表是否已覆盖全部已完成会话；未覆盖时继续读旧 JSON，避免回填完成前旧历史“消失” */
async function hasFullAssessmentCoverage(userId: string): Promise<boolean> {
    const [assessmentCount, completedCount] = await Promise.all([
        prisma.skinAssessment.count({ where: { userId } }),
        prisma.advisorSession.count({
            where: { userId, completedAt: { not: null } },
        }),
    ]);
    return assessmentCount >= completedCount;
}

/** 返回 null 表示有效样本不足 2 次（前端走解锁引导） */
export async function getSkinTrends(userId: string): Promise<SkinTrends | null> {
    try {
        if (await hasFullAssessmentCoverage(userId)) {
            const fromAssessments = await getAssessmentTrends(userId);
            if (fromAssessments) return fromAssessments;
        }
    } catch (error) {
        // 汇总表迁移/数据库抖动时回退旧 JSON，保证趋势不因新表缺失而整块不可用
        console.warn("[skin-trends] SkinAssessment query failed, falling back to analysisResult", error);
    }
    return getLegacyTrends(userId);
}
