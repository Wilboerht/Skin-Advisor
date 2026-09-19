/**
 * 综合评分百分位（真实聚合）的纯计算部分：与 DB/缓存解耦，便于单测。
 * 口径：按用户最近一次真实视觉评分统计，返回「超过百分之多少的用户」。
 */

/** 低于该样本量时不出百分位（小样本误导，前端隐藏副标） */
export const MIN_PERCENTILE_SAMPLE_SIZE = 50;

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
 * 「超过 X% 的用户」：严格高于该分数才算（同分不计入 below）；
 * 结果夹在 1–99，样本不足返回 null。
 */
export function percentileFromDistribution(dist: ScoreDistribution, score: number): number | null {
    if (dist.total < MIN_PERCENTILE_SAMPLE_SIZE) return null;
    let below = 0;
    for (const bucket of dist.buckets) {
        if (bucket.score < score) below += bucket.count;
    }
    return Math.min(99, Math.max(1, Math.round((below / dist.total) * 100)));
}
