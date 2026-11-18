import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    queryRaw: vi.fn(),
    feedbackGroupBy: vi.fn(),
    feedbackFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        $queryRaw: mocks.queryRaw,
        reportFeedback: {
            groupBy: mocks.feedbackGroupBy,
            findMany: mocks.feedbackFindMany,
        },
    },
}));

import {
    getAdminReportFeedbackSummary,
    invalidateAdminReportFeedbackCache,
} from "./admin-report-feedback";

beforeEach(() => {
    vi.clearAllMocks();
    invalidateAdminReportFeedbackCache();
});

describe("getAdminReportFeedbackSummary", () => {
    it("汇总准确率、分布、Top 不准确位置与趋势", async () => {
        mocks.queryRaw
            .mockResolvedValueOnce([
                { total: 10, accurate: 6, inaccurate: 3, unsure: 1, reporters: 4 },
            ])
            .mockResolvedValueOnce([
                { day: "2026-11-16", accurate: 4, inaccurate: 2, unsure: 1 },
                { day: "2026-11-17", accurate: 2, inaccurate: 1, unsure: 0 },
            ])
            .mockResolvedValueOnce([
                { source: "ai", total: 7, accurate: 5, inaccurate: 1 },
                { source: "fallback", total: 3, accurate: 1, inaccurate: 2 },
            ])
            .mockResolvedValueOnce([
                { model: "qwen-plus", total: 9, accurate: 6, inaccurate: 2 },
                { model: "unknown", total: 1, accurate: 0, inaccurate: 1 },
            ])
            .mockResolvedValueOnce([
                { promptVersion: "report-v3.2", total: 8, accurate: 6, inaccurate: 2 },
                { promptVersion: "unknown", total: 2, accurate: 0, inaccurate: 1 },
            ]);
        mocks.feedbackGroupBy
            .mockResolvedValueOnce([
                { verdict: "accurate", _count: { id: 6 } },
                { verdict: "inaccurate", _count: { id: 3 } },
                { verdict: "unsure", _count: { id: 1 } },
            ])
            .mockResolvedValueOnce([
                { targetType: "dimension", targetKey: "waterOil", _count: { id: 2 } },
                { targetType: "finding", targetKey: "issue-1", _count: { id: 1 } },
            ]);
        mocks.feedbackFindMany.mockResolvedValue([
            {
                id: "f1",
                sessionId: "session-1",
                targetType: "report",
                targetKey: "report",
                verdict: "inaccurate",
                note: null,
                createdAt: new Date("2026-11-17T00:00:00.000Z"),
                updatedAt: new Date("2026-11-17T01:00:00.000Z"),
            },
        ]);

        const summary = await getAdminReportFeedbackSummary();

        expect(summary.total).toBe(10);
        expect(summary.accurate).toBe(6);
        expect(summary.inaccurate).toBe(3);
        expect(summary.unsure).toBe(1);
        expect(summary.accuracyRate).toBe(66.7);
        expect(summary.reporterCount).toBe(4);
        expect(summary.byVerdict).toContainEqual({ verdict: "inaccurate", count: 3 });
        expect(summary.topInaccurateTargets).toEqual([
            { targetType: "dimension", targetKey: "waterOil", count: 2 },
            { targetType: "finding", targetKey: "issue-1", count: 1 },
        ]);
        expect(summary.trend).toEqual([
            { date: "2026-11-16", accurate: 4, inaccurate: 2, unsure: 1 },
            { date: "2026-11-17", accurate: 2, inaccurate: 1, unsure: 0 },
        ]);
        expect(summary.byNarrativeSource).toEqual([
            { source: "ai", total: 7, accurate: 5, inaccurate: 1, accuracyRate: 83.3 },
            { source: "fallback", total: 3, accurate: 1, inaccurate: 2, accuracyRate: 33.3 },
        ]);
        expect(summary.byModel).toEqual([
            { model: "qwen-plus", total: 9, accurate: 6, inaccurate: 2, accuracyRate: 75 },
            { model: "unknown", total: 1, accurate: 0, inaccurate: 1, accuracyRate: 0 },
        ]);
        expect(summary.byPromptVersion).toEqual([
            { promptVersion: "report-v3.2", total: 8, accurate: 6, inaccurate: 2, accuracyRate: 75 },
            { promptVersion: "unknown", total: 2, accurate: 0, inaccurate: 1, accuracyRate: 0 },
        ]);
        expect(summary.recent).toHaveLength(1);
        expect(mocks.feedbackFindMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: { updatedAt: "desc" } })
        );
    });

    it("无反馈时返回零值而不报错", async () => {
        mocks.queryRaw
            .mockResolvedValueOnce([
                { total: 0, accurate: 0, inaccurate: 0, unsure: 0, reporters: 0 },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        mocks.feedbackGroupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        mocks.feedbackFindMany.mockResolvedValue([]);

        const summary = await getAdminReportFeedbackSummary();

        expect(summary.total).toBe(0);
        expect(summary.accuracyRate).toBe(0);
        expect(summary.topInaccurateTargets).toEqual([]);
        expect(summary.byNarrativeSource).toEqual([]);
        expect(summary.byModel).toEqual([]);
        expect(summary.byPromptVersion).toEqual([]);
        expect(summary.trend).toEqual([]);
        expect(summary.recent).toEqual([]);
    });
});
