import { describe, it, expect } from "vitest";
import {
    resolveTrendDimensions,
    resolveTrendDimensionScore,
    resolveZoneTextureAverage,
} from "./trend-dimensions";

describe("trend-dimensions - 趋势维度解析", () => {
    it("维度分存在时直接使用（优先于区域均值）", () => {
        const face = {
            dimensions: { texture: { score: 66 }, wrinkles: { score: 80 } },
            zoneAnalysis: { tZone: { texture: 10 }, forehead: { texture: 10 } },
        };
        expect(resolveTrendDimensionScore(face, "texture")).toBe(66);
        expect(resolveTrendDimensionScore(face, "wrinkles")).toBe(80);
    });

    it("texture 缺失时回退 6 区域均值", () => {
        const face = {
            dimensions: { wrinkles: { score: 80 } },
            zoneAnalysis: {
                forehead: { texture: 60 },
                tZone: { texture: 70 },
                leftCheek: { texture: 80 },
                rightCheek: { texture: 90 },
                eyeArea: { texture: 100 },
                jawline: { texture: 50 },
            },
        };
        expect(resolveZoneTextureAverage(face)).toBe(75);
        expect(resolveTrendDimensions(face).texture).toBe(75);
    });

    it("仅统计有效区域（缺失/非数值跳过），无有效值返回 null", () => {
        expect(resolveZoneTextureAverage({ zoneAnalysis: { tZone: { texture: 60 }, jawline: {} } })).toBe(60);
        expect(resolveZoneTextureAverage({ zoneAnalysis: {} })).toBeNull();
        expect(resolveZoneTextureAverage({ zoneAnalysis: { tZone: { texture: "60" } } })).toBeNull();
        expect(resolveZoneTextureAverage(null)).toBeNull();
    });

    it("非 texture 维度缺失时返回 null（不伪造，也不拿区域均值顶替）", () => {
        const face = { dimensions: { waterOil: { score: 70 } }, zoneAnalysis: { tZone: { texture: 60 } } };
        const dims = resolveTrendDimensions(face);
        expect(dims.wrinkles).toBeNull();
        expect(dims.spots).toBeNull();
        expect(dims.waterOil).toBe(70);
    });

    it("越界分数被夹取到 0-100，小数四舍五入", () => {
        const face = { dimensions: { wrinkles: { score: 120 }, spots: { score: -5 }, waterOil: { score: 72.6 } } };
        const dims = resolveTrendDimensions(face);
        expect(dims.wrinkles).toBe(100);
        expect(dims.spots).toBe(0);
        expect(dims.waterOil).toBe(73);
    });

    it("兼容冷层归档形状（只有 dimensions、无 zoneAnalysis）", () => {
        expect(resolveTrendDimensions({ dimensions: { texture: { score: 68 } } }).texture).toBe(68);
        expect(resolveTrendDimensions({ dimensions: { wrinkles: { score: 80 } } }).texture).toBeNull();
        expect(resolveTrendDimensions(undefined).texture).toBeNull();
    });
});
