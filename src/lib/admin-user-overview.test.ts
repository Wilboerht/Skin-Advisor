import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    userFindUnique: vi.fn(),
    sessionCount: vi.fn(),
    sessionFindMany: vi.fn(),
    diaryCount: vi.fn(),
    diaryFindMany: vi.fn(),
    getUsage: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        user: { findUnique: mocks.userFindUnique },
        advisorSession: {
            count: mocks.sessionCount,
            findMany: mocks.sessionFindMany,
        },
        diaryEntry: {
            count: mocks.diaryCount,
            findMany: mocks.diaryFindMany,
        },
    },
}));

vi.mock("@/lib/usage-limit", () => ({
    getSkinTestUsageSummary: mocks.getUsage,
}));

import { getAdminUserOverview } from "./admin-user-overview";

const usage = {
    level: "GOLD",
    totalUsed: 12,
    todayUsed: 2,
    quota: { lifetimeLimit: null, dailyLimit: 10, unlimited: true },
    remaining: null,
    todayCheckedIn: true,
};

describe("getAdminUserOverview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.sessionCount.mockResolvedValue(0);
        mocks.sessionFindMany.mockResolvedValue([]);
        mocks.diaryCount.mockResolvedValue(0);
        mocks.diaryFindMany.mockResolvedValue([]);
        mocks.getUsage.mockResolvedValue(usage);
    });

    it("用户不存在时仍返回用量与空摘要", async () => {
        const result = await getAdminUserOverview("user-1");
        expect(result.account).toBeNull();
        expect(result.usage).toEqual(usage);
        expect(result.counts).toEqual({ sessions: 0, completedSessions: 0, diaryEntries: 0 });
        expect(result.recentSessions).toEqual([]);
        expect(result.recentDiary).toEqual([]);
        expect(mocks.getUsage).toHaveBeenCalledWith("user-1", undefined);
    });

    it("透传主站会员覆盖并按最近活跃计算 lastActiveAt", async () => {
        mocks.userFindUnique.mockResolvedValue({
            role: "user",
            dailyTestLimit: 20,
            membershipLevel: "SILVER",
            createdAt: new Date("2026-01-01T00:00:00Z"),
        });
        mocks.sessionFindMany.mockResolvedValue([
            {
                sessionId: "s1",
                createdAt: new Date("2026-03-02T10:00:00Z"),
                completedAt: new Date("2026-03-02T10:05:00Z"),
                analysisResult: {
                    faceAnalysis: { overallScore: 82 },
                    skinProfile: { typeLabel: "混合偏油" },
                },
            },
        ]);
        mocks.diaryFindMany.mockResolvedValue([
            {
                date: new Date("2026-03-01T00:00:00Z"),
                skinState: "good",
                tags: ["熬夜", 1, null],
                updatedAt: new Date("2026-03-01T12:00:00Z"),
            },
        ]);

        const result = await getAdminUserOverview("user-1", {
            level: "GOLD",
            totalSpent: 6000,
        });

        expect(mocks.getUsage).toHaveBeenCalledWith("user-1", {
            level: "GOLD",
            totalSpent: 6000,
        });
        expect(result.account).toEqual({
            role: "user",
            dailyTestLimit: 20,
            createdAt: "2026-01-01T00:00:00.000Z",
            lastActiveAt: "2026-03-02T10:00:00.000Z",
        });
        expect(result.recentSessions[0]).toMatchObject({
            sessionId: "s1",
            overallScore: 82,
            skinTypeLabel: "混合偏油",
            completedAt: "2026-03-02T10:05:00.000Z",
        });
        expect(result.recentDiary[0]).toEqual({
            date: "2026-03-01",
            skinState: "good",
            tags: ["熬夜"],
        });
    });

    it("旧版 analysisResult 从 skinAnalysis 回退读取肤质标签", async () => {
        mocks.userFindUnique.mockResolvedValue({
            role: "user",
            dailyTestLimit: 10,
            membershipLevel: "REGULAR",
            createdAt: new Date("2026-01-01T00:00:00Z"),
        });
        mocks.sessionFindMany.mockResolvedValue([
            {
                sessionId: "legacy",
                createdAt: new Date("2025-12-01T00:00:00Z"),
                completedAt: null,
                analysisResult: { skinAnalysis: { typeLabel: "干性" } },
            },
        ]);

        const result = await getAdminUserOverview("user-1");
        expect(result.recentSessions[0]).toMatchObject({
            overallScore: null,
            skinTypeLabel: "干性",
            completedAt: null,
        });
    });
});
