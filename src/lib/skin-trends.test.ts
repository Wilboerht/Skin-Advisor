import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
    assessmentFindMany: vi.fn(),
    sessionCount: vi.fn(),
    assessmentCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        advisorSession: { findMany: mocks.findMany, count: mocks.sessionCount },
        skinAssessment: { findMany: mocks.assessmentFindMany, count: mocks.assessmentCount },
    },
}));

import { getSkinTrends } from "./skin-trends";

const session = (at: string, faceAnalysis: unknown) => ({
    completedAt: new Date(at),
    analysisResult: { faceAnalysis },
});

describe("getSkinTrends - 趋势序列", () => {
    beforeEach(() => {
        mocks.findMany.mockReset();
        mocks.assessmentFindMany.mockReset();
        mocks.sessionCount.mockReset();
        mocks.assessmentCount.mockReset();
        mocks.assessmentFindMany.mockResolvedValue([]);
        mocks.assessmentCount.mockResolvedValue(0);
        mocks.sessionCount.mockResolvedValue(2);
    });

    it("texture 由区域均值派生，缺失维度输出 null（不伪造 0 分）", async () => {
        // DB 返回倒序（最近的在前），实现内部 reverse 为时间正序
        mocks.findMany.mockResolvedValue([
            session("2026-09-20T00:00:00Z", {
                overallScore: 80,
                dimensions: { wrinkles: { score: 70 }, waterOil: { score: 72 } },
                zoneAnalysis: { tZone: { texture: 60 }, forehead: { texture: 80 } },
            }),
            session("2026-09-10T00:00:00Z", {
                overallScore: 75,
                dimensions: { wrinkles: { score: 66 }, waterOil: { score: 68 }, spots: { score: 90 } },
                zoneAnalysis: { tZone: { texture: 50 } },
            }),
        ]);

        const trends = await getSkinTrends("user-1");
        expect(trends).not.toBeNull();
        expect(trends!.scores).toEqual([75, 80]);
        expect(trends!.dimensions.texture).toEqual([50, 70]);
        expect(trends!.dimensions.wrinkles).toEqual([66, 70]);
        // 第一次有 spots、第二次缺失 → 断点而不是 0
        expect(trends!.dimensions.spots).toEqual([90, null]);
    });

    it("有效样本不足 2 次返回 null", async () => {
        mocks.findMany.mockResolvedValue([
            session("2026-09-20T00:00:00Z", { overallScore: 80, dimensions: {} }),
        ]);
        expect(await getSkinTrends("user-1")).toBeNull();
    });

    it("无有效评分的样本被过滤，不参与趋势", async () => {
        mocks.findMany.mockResolvedValue([
            session("2026-09-20T00:00:00Z", { overallScore: 80, dimensions: { wrinkles: { score: 70 } } }),
            session("2026-09-15T00:00:00Z", { dimensions: { wrinkles: { score: 60 } } }), // 无 overallScore
            session("2026-09-10T00:00:00Z", { overallScore: 70, dimensions: { wrinkles: { score: 66 } } }),
        ]);
        const trends = await getSkinTrends("user-1");
        expect(trends!.scores).toEqual([70, 80]);
        expect(trends!.dimensions.wrinkles).toEqual([66, 70]);
    });
});

describe("getSkinTrends - SkinAssessment 汇总表", () => {
    beforeEach(() => {
        mocks.findMany.mockReset();
        mocks.assessmentFindMany.mockReset();
        mocks.sessionCount.mockReset();
        mocks.assessmentCount.mockReset();
        mocks.sessionCount.mockResolvedValue(2);
        mocks.assessmentCount.mockResolvedValue(2);
    });

    it("优先读汇总表，返回十维 + metrics + 区域趋势", async () => {
        mocks.assessmentFindMany.mockResolvedValue([
            {
                completedAt: new Date("2026-09-20T00:00:00Z"),
                overallScore: 80,
                dimensions: {
                    wrinkles: { score: 70 },
                    waterOil: { score: 72 },
                    spots: { score: 60 },
                },
                zones: { tZone: { texture: 60, oil: 55 }, forehead: { texture: 80 } },
            },
            {
                completedAt: new Date("2026-09-10T00:00:00Z"),
                overallScore: 75,
                dimensions: {
                    wrinkles: { score: 66 },
                    waterOil: { score: 68 },
                    spots: { score: null },
                },
                zones: { tZone: { texture: 50, oil: 60 } },
            },
        ]);

        const trends = await getSkinTrends("user-1");
        expect(trends).not.toBeNull();
        expect(trends!.scores).toEqual([75, 80]);
        expect(trends!.dimensions.wrinkles).toEqual([66, 70]);
        expect(trends!.dimensions.spots).toEqual([null, 60]);
        expect(trends!.dimensions.texture).toEqual([50, 70]);
        expect(trends!.metrics[0]).toMatchObject({ key: "overall", label: "综合评分" });
        expect(trends!.metrics.some((metric) => metric.key === "waterOil")).toBe(true);
        expect(trends!.zones?.tZone?.some((metric) => metric.key === "oil")).toBe(true);
    });
});
