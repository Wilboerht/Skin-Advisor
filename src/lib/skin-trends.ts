/**
 * 肌肤评分趋势查询（公共路由 /api/user/skin-trends 与内部接口共用）
 *
 * 取最近 100 次完成的分析（时间正序）。按天聚合（同日多次取当日最后一次）
 * 由前端护肤档案面板（DiaryPanel）以本地时区完成——这里多取是为了覆盖
 * "一天多次测肤"场景，聚合后仍有足够的"天"数构成趋势。
 *
 * 维度分口径见 lib/trend-dimensions.ts：
 * texture 由 6 区域均值派生、缺失维度返回 null（断点），不伪造 0 分。
 */
import prisma from "@/lib/prisma";
import { resolveTrendDimensions, type TrendDimensionScores } from "@/lib/trend-dimensions";

export interface SkinTrends {
    dates: Date[];
    scores: number[];
    dimensions: {
        wrinkles: (number | null)[];
        waterOil: (number | null)[];
        spots: (number | null)[];
        texture: (number | null)[];
    };
}

interface TrendFaceAnalysis {
    overallScore?: number;
}

const asFaceAnalysis = (result: unknown): TrendFaceAnalysis | undefined =>
    (result as { faceAnalysis?: TrendFaceAnalysis } | null | undefined)?.faceAnalysis;

/** 返回 null 表示有效样本不足 2 次（前端走解锁引导） */
export async function getSkinTrends(userId: string): Promise<SkinTrends | null> {
    const recentSessions = (
        await prisma.advisorSession.findMany({
            where: {
                user: { id: userId }, // Use relation filter
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

    // 过滤缺失/非法评分的样本：兜底 0 会把趋势域拉到 0、曲线失真
    const validSessions = recentSessions.filter((s) => {
        const score = asFaceAnalysis(s.analysisResult)?.overallScore;
        return typeof score === "number" && Number.isFinite(score) && score > 0;
    });

    if (validSessions.length < 2) return null;

    const points = validSessions.map((s) => {
        const raw = s.analysisResult as { faceAnalysis?: unknown } | null | undefined;
        return {
            at: s.completedAt as Date,
            score: asFaceAnalysis(s.analysisResult)?.overallScore as number,
            dims: resolveTrendDimensions(raw?.faceAnalysis),
        };
    });

    const dimensionSeries = (key: keyof TrendDimensionScores) =>
        points.map((p) => p.dims[key]);

    return {
        dates: points.map((p) => p.at),
        scores: points.map((p) => p.score),
        dimensions: {
            wrinkles: dimensionSeries("wrinkles"),
            waterOil: dimensionSeries("waterOil"),
            spots: dimensionSeries("spots"),
            texture: dimensionSeries("texture"),
        },
    };
}
