/**
 * 视觉结果评分校准（纯函数，便于单测）。
 *
 * 关键口径：
 * - 每个维度分数夹取 0-100，档位由分数重算（不信任模型自报档位）；
 * - `notVisible=true` 或 `confidence < 0.3` 的维度不计入综合分；
 * - 有效维度不足 6 个时标记 `insufficient`，由调用方拒绝本次结果并引导重拍；
 * - 综合分为有效维度的 confidence 加权均值，模型自报 overallScore 不参与；
 * - 肌龄夹取 10-80，并给出 ±2 的参考区间（避免展示虚假精度）。
 */

export const VISION_DIMENSION_KEYS = [
    "waterOil", "skinTone", "spots", "wrinkles", "uvDamage",
    "sensitivity", "darkCircles", "firmness", "acne", "radiance",
] as const;

export type VisionDimensionKey = (typeof VISION_DIMENSION_KEYS)[number];

export const ZONE_NUMERIC_KEYS = [
    "oil", "texture", "wrinkles", "spots", "redness", "darkCircles", "firmness", "contour",
] as const;

/** 有效维度低于该值时拒绝本次视觉结果 */
export const MIN_SCORED_DIMENSIONS = 6;

/** 低于该置信度的维度不作为评分/证据依据 */
export const LOW_CONFIDENCE_THRESHOLD = 0.3;

export const VISION_SCORING_VERSION = 2;

export interface VisionScoring {
    version: typeof VISION_SCORING_VERSION;
    overallScore?: number;
    scoredDimensions: number;
    totalDimensions: number;
    lowConfidenceDimensions: VisionDimensionKey[];
    notVisibleDimensions: VisionDimensionKey[];
    insufficient: boolean;
}

export type Grade = "excellent" | "good" | "average" | "fair" | "poor";

export function gradeFromScore(score: number): Grade {
    if (score >= 85) return "excellent";
    if (score >= 70) return "good";
    if (score >= 55) return "average";
    if (score >= 40) return "fair";
    return "poor";
}

export function clampScore(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeConfidence(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    const normalized = value > 1 ? value / 100 : value;
    return Math.min(1, Math.max(0, normalized));
}

/**
 * 原地校准视觉结果，并写入 data.scoring。
 * 返回 scoring 供调用方判断是否拒绝本次结果。
 */
export function calibrateVisionScores(data: Record<string, unknown>): VisionScoring {
    const dims = data.dimensions as Record<string, {
        score?: unknown;
        grade?: unknown;
        blackheads?: unknown;
        pimples?: unknown;
        confidence?: unknown;
        notVisible?: unknown;
    }> | undefined;

    const scoredDimensions: VisionDimensionKey[] = [];
    const lowConfidenceDimensions: VisionDimensionKey[] = [];
    const notVisibleDimensions: VisionDimensionKey[] = [];
    const weightedScores: Array<{ score: number; weight: number }> = [];

    if (dims && typeof dims === "object") {
        for (const key of VISION_DIMENSION_KEYS) {
            const dim = dims[key];
            if (!dim || typeof dim !== "object") continue;

            const score = clampScore(dim.score);
            if (score !== undefined) {
                dim.score = score;
                dim.grade = gradeFromScore(score);
            } else {
                delete dim.score;
                delete dim.grade;
            }

            if (dim.blackheads !== undefined) dim.blackheads = clampScore(dim.blackheads);
            if (dim.pimples !== undefined) dim.pimples = clampScore(dim.pimples);

            const confidence = normalizeConfidence(dim.confidence);
            if (confidence !== undefined) {
                dim.confidence = confidence;
            } else {
                delete dim.confidence;
            }

            const notVisible = dim.notVisible === true;
            if (notVisible) {
                notVisibleDimensions.push(key);
                continue;
            }
            if (confidence !== undefined && confidence < LOW_CONFIDENCE_THRESHOLD) {
                lowConfidenceDimensions.push(key);
                continue;
            }
            if (score !== undefined) {
                scoredDimensions.push(key);
                weightedScores.push({ score, weight: confidence ?? 1 });
            }
        }
    }

    const totalWeight = weightedScores.reduce((sum, item) => sum + item.weight, 0);
    const overallScore = weightedScores.length >= MIN_SCORED_DIMENSIONS && totalWeight > 0
        ? Math.round(weightedScores.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)
        : undefined;

    data.overallScore = overallScore;

    const insufficient = overallScore === undefined;
    const scoring: VisionScoring = {
        version: VISION_SCORING_VERSION,
        overallScore,
        scoredDimensions: scoredDimensions.length,
        totalDimensions: VISION_DIMENSION_KEYS.length,
        lowConfidenceDimensions,
        notVisibleDimensions,
        insufficient,
    };
    data.scoring = scoring;

    const zones = data.zoneAnalysis as Record<string, Record<string, unknown>> | undefined;
    if (zones && typeof zones === "object") {
        for (const zone of Object.values(zones)) {
            if (!zone || typeof zone !== "object") continue;
            for (const key of ZONE_NUMERIC_KEYS) {
                if (zone[key] !== undefined) zone[key] = clampScore(zone[key]);
            }
            if (zone.confidence !== undefined) {
                const confidence = normalizeConfidence(zone.confidence);
                if (confidence !== undefined) zone.confidence = confidence;
                else delete zone.confidence;
            }
        }
    }

    const skinAge = data.skinAge as { estimated?: unknown; factors?: unknown; range?: unknown } | undefined;
    if (skinAge && typeof skinAge === "object" && typeof skinAge.estimated === "number" && Number.isFinite(skinAge.estimated)) {
        const estimated = Math.min(80, Math.max(10, Math.round(skinAge.estimated)));
        skinAge.estimated = estimated;
        skinAge.range = [Math.max(10, estimated - 2), Math.min(80, estimated + 2)];
        skinAge.factors = Array.isArray(skinAge.factors)
            ? skinAge.factors.filter((factor): factor is string => typeof factor === "string").slice(0, 4)
            : [];
    }

    return scoring;
}
