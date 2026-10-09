import { describe, expect, it } from "vitest";
import {
    buildDistribution,
    percentileFromDistribution,
    MIN_PERCENTILE_SAMPLE_SIZE,
} from "./score-percentile";

describe("percentileFromDistribution", () => {
    it("样本不足时按分数给 72–93 的展示性排名", () => {
        const dist = buildDistribution([{ score: 85, count: MIN_PERCENTILE_SAMPLE_SIZE - 1 }]);
        // 区间内直接用分数
        expect(percentileFromDistribution(dist, 85)).toBe(85);
        // 低于下限 → 夹到 72；高于上限 → 夹到 93
        expect(percentileFromDistribution(dist, 60)).toBe(72);
        expect(percentileFromDistribution(dist, 98)).toBe(93);
    });

    it("空分布同样给展示性排名（徽章始终展示）", () => {
        expect(percentileFromDistribution(buildDistribution([]), 80)).toBe(80);
    });

    it("达到最小样本量后按真实分布计算", () => {
        const dist = buildDistribution([{ score: 60, count: MIN_PERCENTILE_SAMPLE_SIZE }]);
        expect(percentileFromDistribution(dist, 80)).toBe(97);
    });

    it("严格高于才算超过：同分不计入 below", () => {
        const dist = buildDistribution([
            { score: 50, count: 10 },
            { score: 70, count: 20 },
            { score: 90, count: 20 },
        ]);
        // total=50；score=70 时 only 50 分桶低于 70 → 10/50 = 20%
        expect(percentileFromDistribution(dist, 70)).toBe(20);
        // 90 分时 50+70 两桶低于 90 → 30/50 = 60%
        expect(percentileFromDistribution(dist, 90)).toBe(60);
    });

    it("最低分夹到 1、最高分夹到 97", () => {
        const dist = buildDistribution([
            { score: 30, count: 60 },
            { score: 80, count: 40 },
        ]);
        expect(percentileFromDistribution(dist, 30)).toBe(1);
        expect(percentileFromDistribution(dist, 100)).toBe(97);
    });

    it("四舍五入取整", () => {
        const dist = buildDistribution([
            { score: 10, count: 20 },
            { score: 20, count: 40 },
        ]);
        // below=20, total=60 → 33.33% → 33
        expect(percentileFromDistribution(dist, 20)).toBe(33);
    });

    it("桶顺序不影响结果", () => {
        const sorted = buildDistribution([
            { score: 10, count: 20 },
            { score: 50, count: 20 },
            { score: 90, count: 20 },
        ]);
        const shuffled = buildDistribution([
            { score: 90, count: 20 },
            { score: 10, count: 20 },
            { score: 50, count: 20 },
        ]);
        expect(percentileFromDistribution(shuffled, 60)).toBe(
            percentileFromDistribution(sorted, 60)
        );
    });

    it("忽略异常桶（非有限数/非正计数）", () => {
        const dist = buildDistribution([
            { score: Number.NaN, count: 10 },
            { score: 50, count: 0 },
            { score: 60, count: 50 },
        ]);
        expect(dist.total).toBe(50);
        expect(percentileFromDistribution(dist, 60)).toBe(1);
    });
});
