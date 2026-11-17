import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(),
    rateLimit: vi.fn(),
    getClientIP: vi.fn(),
    getFunnelSummary: vi.fn(),
    getReportQualitySummary: vi.fn(),
    getAICostSummary: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
    authorizeInternalRequest: mocks.authorize,
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: mocks.getClientIP,
}));
vi.mock("@/lib/admin-funnel", () => ({
    getAdminFunnelSummary: mocks.getFunnelSummary,
}));
vi.mock("@/lib/admin-report-quality", () => ({
    getAdminReportQualitySummary: mocks.getReportQualitySummary,
}));
vi.mock("@/lib/admin-ai-costs", () => ({
    getAdminAICostSummary: mocks.getAICostSummary,
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: mocks.warn, error: vi.fn(), info: vi.fn() },
}));

import { GET } from "../admin/analytics/route";

const ENDPOINT_URL = "http://localhost/api/internal/admin/analytics";

function fakeReq(url = ENDPOINT_URL): NextRequest {
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
    } as unknown as NextRequest;
}

const funnel = {
    days: 30,
    totalSessions: 10,
    reportCompleted: 8,
    resultViewed: 6,
    reportCompletionRate: 80,
};

const reportQuality = {
    days: 30,
    totalReports: 8,
    aiNarrative: 7,
    fallback: 1,
    fallbackRate: 12.5,
    avgDurationMs: 1000,
    avgQueueWaitMs: 100,
    avgTextGenerationMs: 600,
    avgProductSelectionMs: 200,
    avgPersistMs: 100,
    avgDiagnosisFindingCount: 3,
    avgIssueCount: 2,
    avgCoverageScored: 4,
    bySource: [],
};

const aiCosts = {
    period: "week",
    totalCost: 1.23,
    totalCalls: 10,
    failedCalls: 1,
    successRate: 90,
    avgDurationMs: 800,
};

describe("GET /api/internal/admin/analytics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authorize.mockResolvedValue({ ok: true, mode: "signed" });
        mocks.rateLimit.mockResolvedValue({
            success: true,
            limit: 60,
            remaining: 59,
            reset: Date.now() + 60_000,
        });
        mocks.getClientIP.mockReturnValue("1.2.3.4");
        mocks.getFunnelSummary.mockResolvedValue(funnel);
        mocks.getReportQualitySummary.mockResolvedValue(reportQuality);
        mocks.getAICostSummary.mockResolvedValue(aiCosts);
    });

    it("鉴权失败返回 401，且不做限流", async () => {
        mocks.authorize.mockResolvedValue({
            ok: false,
            mode: "signed",
            reason: "signature_mismatch",
            status: 401,
        });
        const res = await GET(fakeReq());
        expect(res.status).toBe(401);
        expect(mocks.rateLimit).not.toHaveBeenCalled();
    });

    it("限流触发返回 429", async () => {
        mocks.rateLimit.mockResolvedValue({
            success: false,
            limit: 60,
            remaining: 0,
            reset: Date.now(),
        });
        const res = await GET(fakeReq());
        expect(res.status).toBe(429);
    });

    it("成功返回三块摘要", async () => {
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
            funnel,
            reportQuality,
            aiCosts,
            failed: [],
            generatedAt: expect.any(String),
        });
        expect(mocks.getAICostSummary).toHaveBeenCalledWith("week");
    });

    it("单块失败时降级为 null，其余仍返回", async () => {
        mocks.getReportQualitySummary.mockRejectedValue(
            new Error("quality down")
        );
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.funnel).toEqual(funnel);
        expect(body.data.reportQuality).toBeNull();
        expect(body.data.aiCosts).toEqual(aiCosts);
        expect(body.data.failed).toEqual(["reportQuality"]);
        expect(mocks.warn).toHaveBeenCalled();
    });

    it("全部失败仍返回 200，供主站逐卡降级", async () => {
        mocks.getFunnelSummary.mockRejectedValue(new Error("funnel down"));
        mocks.getReportQualitySummary.mockRejectedValue(
            new Error("quality down")
        );
        mocks.getAICostSummary.mockRejectedValue(new Error("cost down"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({
            funnel: null,
            reportQuality: null,
            aiCosts: null,
            failed: ["funnel", "reportQuality", "aiCosts"],
        });
    });
});
