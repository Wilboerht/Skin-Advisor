import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(),
    rateLimit: vi.fn(),
    getClientIP: vi.fn(),
    getStats: vi.fn(),
    getHealth: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
    authorizeInternalRequest: mocks.authorize,
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: mocks.getClientIP,
}));
vi.mock("@/lib/admin-dashboard-stats", () => ({
    getAdvisorDashboardStats: mocks.getStats,
}));
vi.mock("@/lib/admin-ai-health", () => ({
    getAdvisorAIHealth: mocks.getHealth,
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: mocks.error, warn: mocks.warn, info: vi.fn() },
}));

import { GET } from "../admin/dashboard/route";

const ENDPOINT_URL = "http://localhost/api/internal/admin/dashboard";

function fakeReq(url = ENDPOINT_URL): NextRequest {
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
    } as unknown as NextRequest;
}

const stats = {
    overview: {
        totalUsers: 10,
        totalProducts: 5,
        totalSessions: 20,
        completedSessions: 15,
        todaySessions: 2,
        todayCompletions: 1,
        completionRate: 75,
    },
    skinTypeDistribution: [],
    weeklyGrowth: [],
};

const health = {
    budget: { dailyTokens: 100, dailyCost: 1, monthlyTokens: 1000, monthlyCost: 10 },
    usage: { dailyTokens: 50, dailyCost: 0.5, monthlyTokens: 500, monthlyCost: 5 },
    dailyUsagePercent: 50,
    monthlyUsagePercent: 50,
    exhausted: false,
    exhaustedReason: null,
    circuits: [],
    status: "healthy" as const,
};

describe("GET /api/internal/admin/dashboard", () => {
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
        mocks.getStats.mockResolvedValue(stats);
        mocks.getHealth.mockResolvedValue(health);
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

    it("成功返回统计与 AI 健康", async () => {
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({ ...stats, health, generatedAt: expect.any(String) });
    });

    it("AI 健康失败时降级为 null，统计仍返回", async () => {
        mocks.getHealth.mockRejectedValue(new Error("health down"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.health).toBeNull();
        expect(body.data.overview).toEqual(stats.overview);
        expect(mocks.warn).toHaveBeenCalled();
    });

    it("统计失败返回 500", async () => {
        mocks.getStats.mockRejectedValue(new Error("db down"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(500);
        expect(mocks.error).toHaveBeenCalled();
    });
});
