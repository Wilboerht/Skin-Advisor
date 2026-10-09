/**
 * 综合评分百分位（真实聚合）的纯计算部分：与 DB/缓存解耦，便于单测。
 * 口径：按用户最近一次真实视觉评分统计，返回「超过百分之多少的用户」。
 * 产品要求排名徽章始终展示：
 * - 样本充足（≥ MIN_PERCENTILE_SAMPLE_SIZE）按真实分布计算，结果夹在 1–97；
 * - 样本不足时按分数直接作为展示性排名，夹在 72–93（空分布同理，不再返回 null）。
 */

/** 样本量达到该值才使用真实聚合；不足时给展示性排名 */
export const MIN_PERCENTILE_SAMPLE_SIZE = 50;

/** 真实百分位上限（留出“总有人更高”的观感，上限 97） */
const REAL_PERCENTILE_MAX = 97;

/** 样本不足时的展示性排名区间 */
const FALLBACK_PERCENTILE_MIN = 72;
const FALLBACK_PERCENTILE_MAX = 93;

export interface ScoreBucket {
    score: number;
    count: number;
}

export interface ScoreDistribution {
    /** 分数直方图（顺序不敏感，计算时全量累加） */
    buckets: ScoreBucket[];
    /** 参与统计的用户数 */
    total: number;
}

export function buildDistribution(buckets: ScoreBucket[]): ScoreDistribution {
    const clean = buckets.filter(
        (b) => Number.isFinite(b.score) && Number.isFinite(b.count) && b.count > 0
    );
    return {
        buckets: clean,
        total: clean.reduce((sum, b) => sum + b.count, 0),
    };
}

/**
 * 「超过 X% 的用户」：严格高于该分数才算（同分不计入 below）。
 * 样本充足 → 真实分布，结果夹在 1–97；
 * 样本不足 → 按分数给 72–93 的展示性排名。
 */
export function percentileFromDistribution(dist: ScoreDistribution, score: number): number {
    const boundedScore = Math.min(100, Math.max(0, score));
    if (dist.total < MIN_PERCENTILE_SAMPLE_SIZE) {
        return Math.min(
            FALLBACK_PERCENTILE_MAX,
            Math.max(FALLBACK_PERCENTILE_MIN, Math.round(boundedScore))
        );
    }
    let below = 0;
    for (const bucket of dist.buckets) {
        if (bucket.score < boundedScore) below += bucket.count;
    }
    return Math.min(REAL_PERCENTILE_MAX, Math.max(1, Math.round((below / dist.total) * 100)));
}
