/**
 * 根据综合评分计算全国排名百分比
 */
export function getRankPercentile(score: number): number {
    const scoreToPercentile: { min: number; max: number; percentile: number }[] = [
        { min: 90, max: 99, percentile: 95 },
        { min: 80, max: 89, percentile: 90 },
        { min: 75, max: 79, percentile: 85 },
        { min: 70, max: 74, percentile: 80 },
        { min: 65, max: 69, percentile: 74 },
        { min: 60, max: 64, percentile: 68 },
        { min: 55, max: 59, percentile: 62 },
        { min: 45, max: 54, percentile: 55 },
        { min: 35, max: 44, percentile: 45 },
        { min: 25, max: 34, percentile: 35 },
        { min: 15, max: 24, percentile: 25 },
        { min: 0, max: 14, percentile: 15 },
    ];
    const match = scoreToPercentile.find((r) => score >= r.min && score <= r.max);
    return match ? match.percentile : 75;
}

/**
 * 根据水油维度分数返回 T 区标签
 */
export function getTZoneLabel(waterOilScore: number): string {
    if (waterOilScore >= 80) return 'T区平衡';
    if (waterOilScore >= 60) return 'T区略油';
    return 'T区偏油';
}
