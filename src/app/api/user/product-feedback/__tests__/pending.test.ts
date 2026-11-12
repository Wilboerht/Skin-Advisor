import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    isSubsiteAccountDisabled: vi.fn(),
    rateLimit: vi.fn(),
    sessions: vi.fn(),
    feedbacks: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
    isSubsiteAccountDisabled: mocks.isSubsiteAccountDisabled,
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: () => "1.2.3.4",
}));
vi.mock("@/lib/prisma", () => ({
    default: {
        advisorSession: { findMany: mocks.sessions },
        productFeedback: { findMany: mocks.feedbacks },
    },
}));

import { GET } from "../pending/route";

const USER = "user-1";

function makeSession(completedAt: Date) {
    return {
        sessionId: "sess-1",
        completedAt,
        analysisResult: {
            skinProfile: { type: "dry", typeLabel: "干性肌肤", concerns: [] },
            analysis: { summary: "ok", details: [] },
            products: [
                { id: "p1", name: "产品一", category: "精华露", image: "/p1.jpg", reason: "适合" },
                { id: "p2", name: "产品二", category: "面霜", image: "/p2.jpg", reason: "适合" },
            ],
        },
    };
}

describe("GET /api/user/product-feedback/pending", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSessionUser.mockResolvedValue({ id: USER });
        mocks.isSubsiteAccountDisabled.mockResolvedValue(false);
        mocks.rateLimit.mockResolvedValue({ success: true });
    });

    it("只返回 28 天以上且未反馈过的产品", async () => {
        mocks.sessions.mockResolvedValue([makeSession(new Date(Date.now() - 30 * 86_400_000))]);
        mocks.feedbacks.mockResolvedValue([{ sessionId: "sess-1", productId: "p1" }]);

        const res = await GET(new NextRequest("http://localhost/api/user/product-feedback/pending"));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.items[0]).toMatchObject({
            sessionId: "sess-1",
            productId: "p2",
            productName: "产品二",
        });
    });

    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await GET(new NextRequest("http://localhost/api/user/product-feedback/pending"));
        expect(res.status).toBe(401);
    });
});
