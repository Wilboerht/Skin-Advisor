import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    isSubsiteAccountDisabled: vi.fn(),
    productFindUnique: vi.fn(),
    sessionFindFirst: vi.fn(),
    feedbackUpsert: vi.fn(),
    rateLimit: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
    isSubsiteAccountDisabled: mocks.isSubsiteAccountDisabled,
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        product: { findUnique: mocks.productFindUnique },
        advisorSession: { findFirst: mocks.sessionFindFirst },
        productFeedback: { upsert: mocks.feedbackUpsert },
    },
}));

vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { POST } from "../route";

const user = { id: "u1", role: "user", tokenVersion: 0 };

function req(body: unknown): NextRequest {
    return {
        headers: new Headers(),
        json: async () => body,
    } as unknown as NextRequest;
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue(user);
    mocks.isSubsiteAccountDisabled.mockResolvedValue(false);
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.productFindUnique.mockResolvedValue({ id: "p1" });
    mocks.sessionFindFirst.mockResolvedValue({ sessionId: "s1" });
    mocks.feedbackUpsert.mockResolvedValue({
        id: "f1",
        rating: 5,
        createdAt: new Date("2026-10-24T00:00:00.000Z"),
    });
});

describe("POST /api/user/product-feedback", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await POST(req({ productId: "p1", rating: 5 }));
        expect(res.status).toBe(401);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
    });

    it("rating 非整数返回 400，不落库", async () => {
        const res = await POST(req({ productId: "p1", rating: 4.5 }));
        expect(res.status).toBe(400);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
    });

    it("伪造/他人的 sessionId 返回 403，不落库", async () => {
        mocks.sessionFindFirst.mockResolvedValue(null);
        const res = await POST(req({ productId: "p1", sessionId: "other-session", rating: 5 }));
        expect(res.status).toBe(403);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
        expect(mocks.sessionFindFirst).toHaveBeenCalledWith({
            where: { sessionId: "other-session", userId: "u1", completedAt: { not: null } },
            select: { sessionId: true },
        });
    });

    it("合法会话：按 userId+productId+sessionId upsert，文本做 trim", async () => {
        const res = await POST(
            req({
                productId: " p1 ",
                sessionId: " s1 ",
                rating: 5,
                skinFeel: "  清爽  ",
                effect: "  保湿  ",
                repurchase: true,
                note: "  很好用  ",
            })
        );
        expect(res.status).toBe(200);
        expect(mocks.feedbackUpsert).toHaveBeenCalledWith({
            where: {
                userId_productId_sessionId: {
                    userId: "u1",
                    productId: "p1",
                    sessionId: "s1",
                },
            },
            update: {
                rating: 5,
                skinFeel: "清爽",
                effect: "保湿",
                repurchase: true,
                note: "很好用",
            },
            create: {
                userId: "u1",
                productId: "p1",
                sessionId: "s1",
                rating: 5,
                skinFeel: "清爽",
                effect: "保湿",
                repurchase: true,
                note: "很好用",
            },
        });
    });

    it("未带 sessionId 时使用 _nosession_ 哨兵，保持同一产品可更新", async () => {
        const res = await POST(req({ productId: "p1", rating: 4 }));
        expect(res.status).toBe(200);
        expect(mocks.sessionFindFirst).not.toHaveBeenCalled();
        expect(mocks.feedbackUpsert.mock.calls[0][0].where.userId_productId_sessionId.sessionId).toBe(
            "_nosession_"
        );
    });

    it("超过频率限制返回 429", async () => {
        mocks.rateLimit.mockResolvedValue({ success: false });
        const res = await POST(req({ productId: "p1", rating: 5 }));
        expect(res.status).toBe(429);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
    });
});
