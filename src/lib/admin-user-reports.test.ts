import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    getScoreDistribution: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        advisorSession: {
            findMany: mocks.findMany,
            count: mocks.count,
            findFirst: mocks.findFirst,
        },
    },
}));

vi.mock("@/lib/score-percentile-db", () => ({
    getScoreDistribution: mocks.getScoreDistribution,
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: mocks.warn, error: vi.fn(), info: vi.fn() },
}));

import { getAdminUserReportDetail, listAdminUserReports } from "./admin-user-reports";

const rawResult = {
    reportVersion: 2,
    dataSource: "comprehensive",
    persona: "desert",
    skinState: "bare",
    skinProfile: {
        type: "combination_dry",
        typeLabel: "混合偏干",
        concerns: ["spots", "dryness"],
        skinAge: 28,
    },
    analysis: {
        summary: "整体状态稳定，局部需要加强保湿。",
        details: ["两颊偏干", "T 区轻微出油"],
        lifestyleTips: ["规律作息"],
    },
    faceAnalysis: {
        overallScore: 82,
        skinType: { type: "combination_dry", confidence: 0.9 },
        skinAge: { estimated: 28, factors: ["细纹"] },
        dimensions: {
            waterOil: { score: 70, grade: "good", details: "水油基本平衡" },
            spots: { score: 58, grade: "average", details: "两颊有轻微色沉" },
        },
        skinConditions: [{ condition: "色沉", severity: "mild", area: "两颊", description: "轻微" }],
        zoneAnalysis: {
            leftCheek: { condition: "轻微干燥", advice: "加强保湿", oil: 55 },
        },
        recommendations: ["注意防晒"],
    },
    consultantReport: {
        overview: "你的肌肤整体稳定。",
        issues: [
            {
                title: "两颊干燥",
                severity: "mild",
                observation: "两颊有轻微干燥。",
                directCauses: "屏障水分不足。",
                indirectCauses: "空调环境。",
                skincarePlan: "加强保湿。",
                lifestylePlan: "多喝水。",
                medicalBoundary: "",
                relatedDimensions: ["waterOil"],
            },
        ],
        strengths: ["T 区油脂控制较好"],
        routineNote: "保持现有节奏。",
        productReasons: [{ id: "p1", reason: "适合干性区域" }],
    },
    products: [
        {
            id: "p1",
            name: "修护面霜",
            category: "面霜",
            reason: "适合两颊干燥",
            price: "280",
        },
    ],
};

const answers = {
    ageRange: "26-30",
    primaryConcern: ["spots"],
    allergies: ["none"],
    pregnancy: "no",
    medicalBeauty: "none",
    sleepQuality: "good",
    stressLevel: "low",
    waterIntake: "medium",
    exerciseFrequency: "medium",
    dietaryHabits: "balanced",
    sunExposure: "medium",
    skincareFrequency: "daily",
    skincareLevel: "intermediate",
    budget: "mid",
};

describe("admin user reports", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.count.mockResolvedValue(1);
        mocks.getScoreDistribution.mockResolvedValue({ buckets: [], total: 0 });
    });

    it("列表只返回摘要，不带完整 analysisResult", async () => {
        mocks.findMany.mockResolvedValue([
            {
                sessionId: "session-1",
                createdAt: new Date("2026-10-01T10:00:00Z"),
                completedAt: new Date("2026-10-01T10:10:00Z"),
                expiresAt: new Date("2027-10-01T10:10:00Z"),
                analysisResult: rawResult,
            },
        ]);

        const data = await listAdminUserReports("user-1", { page: 1, limit: 10 });

        expect(data.reports).toHaveLength(1);
        expect(data.reports[0]).toMatchObject({
            sessionId: "session-1",
            overallScore: 82,
            skinTypeLabel: "混合偏干",
            persona: "desert",
            personaLabel: "沙漠派",
            reportVersion: 2,
            dataSource: "comprehensive",
            expired: false,
        });
        expect(data.reports[0]).not.toHaveProperty("analysisResult");
        expect(data.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
        expect(mocks.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user-1",
                    completedAt: { not: null },
                    archivedAt: null,
                }),
            })
        );
    });

    it("详情返回结构化报告、标签化问卷和过期标记", async () => {
        mocks.findFirst.mockResolvedValue({
            sessionId: "session-1",
            createdAt: new Date("2026-10-01T10:00:00Z"),
            completedAt: new Date("2026-10-01T10:10:00Z"),
            expiresAt: new Date("2026-10-02T10:10:00Z"),
            analysisResult: rawResult,
            answers,
        });

        const data = await getAdminUserReportDetail("user-1", "session-1");

        expect(data).not.toBeNull();
        expect(data?.expired).toBe(true);
        expect(data?.summary.overallScore).toBe(82);
        expect(data?.summary.questionnaire).toMatchObject({
            ageRange: "26-30岁",
            primaryConcerns: ["色斑/暗沉"],
            sleepQuality: "很好（精力充沛）",
        });
        expect(data?.result.consultantReport?.issues[0].title).toBe("两颊干燥");
        expect(data?.faceAnalysis?.dimensions.waterOil.score).toBe(70);
        expect(data?.result.products?.[0].name).toBe("修护面霜");
        expect(data).not.toHaveProperty("answers");
    });

    it("会话不属于用户或报告未完成时返回 null", async () => {
        mocks.findFirst.mockResolvedValue(null);
        await expect(getAdminUserReportDetail("user-1", "session-x")).resolves.toBeNull();
    });
});
