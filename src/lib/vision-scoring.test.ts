import { describe, expect, it } from "vitest";
import { calibrateVisionScores, MIN_SCORED_DIMENSIONS, VISION_DIMENSION_KEYS } from "./vision-scoring";

function dimensions(score = 80, overrides: Record<string, Record<string, unknown>> = {}) {
    return Object.fromEntries(
        VISION_DIMENSION_KEYS.map((key) => [key, { score, ...(overrides[key] ?? {}) }])
    );
}

function makeData(score = 80, overrides: Record<string, Record<string, unknown>> = {}) {
    return {
        dimensions: dimensions(score, overrides),
        skinAge: { estimated: 28.4, factors: ["光老化低"] },
    } as Record<string, unknown>;
}

describe("calibrateVisionScores", () => {
    it("十维齐全时按 confidence 加权计算综合分", () => {
        const data = makeData();
        const scoring = calibrateVisionScores(data);

        expect(scoring.insufficient).toBe(false);
        expect(scoring.scoredDimensions).toBe(10);
        expect(data.overallScore).toBe(80);
        expect(data.scoring).toEqual(scoring);
        const skinAge = data.skinAge as { estimated: number; range: [number, number] };
        expect(skinAge.estimated).toBe(28);
        expect(skinAge.range).toEqual([26, 30]);
    });

    it("notVisible 维度不计入综合分，低覆盖时 insufficient=true", () => {
        const overrides: Record<string, Record<string, unknown>> = {};
        for (const key of VISION_DIMENSION_KEYS.slice(0, 5)) {
            overrides[key] = { notVisible: true };
        }
        const data = makeData(90, overrides);
        const scoring = calibrateVisionScores(data);

        expect(scoring.scoredDimensions).toBe(5);
        expect(scoring.notVisibleDimensions).toHaveLength(5);
        expect(scoring.insufficient).toBe(true);
        expect(data.overallScore).toBeUndefined();
    });

    it("低置信维度不作为评分依据", () => {
        const overrides: Record<string, Record<string, unknown>> = {};
        for (const key of VISION_DIMENSION_KEYS.slice(0, 5)) {
            overrides[key] = { confidence: 0.1 };
        }
        const data = makeData(70, overrides);
        const scoring = calibrateVisionScores(data);

        expect(scoring.lowConfidenceDimensions).toHaveLength(5);
        expect(scoring.scoredDimensions).toBe(5);
        expect(scoring.insufficient).toBe(true);
    });

    it("刚好达到最小覆盖时仍可出分", () => {
        const overrides: Record<string, Record<string, unknown>> = {};
        for (const key of VISION_DIMENSION_KEYS.slice(MIN_SCORED_DIMENSIONS)) {
            overrides[key] = { notVisible: true };
        }
        const data = makeData(75, overrides);
        const scoring = calibrateVisionScores(data);

        expect(scoring.scoredDimensions).toBe(MIN_SCORED_DIMENSIONS);
        expect(scoring.insufficient).toBe(false);
        expect(data.overallScore).toBe(75);
    });

    it("档位由分数重算，不信任模型自报 grade", () => {
        const data = makeData(50, { waterOil: { grade: "excellent" } });
        calibrateVisionScores(data);
        const dims = data.dimensions as Record<string, { grade: string }>;
        expect(dims.waterOil.grade).toBe("fair");
    });
});
