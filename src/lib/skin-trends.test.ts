import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    default: { advisorSession: { findMany: mocks.findMany } },
}));

import { getSkinTrends } from "./skin-trends";

const session = (at: string, faceAnalysis: unknown) => ({
    completedAt: new Date(at),
    analysisResult: { faceAnalysis },
});

describe("getSkinTrends - 趋势序列", () => {
    beforeEach(() => {
        mocks.findMany.mockReset();
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
