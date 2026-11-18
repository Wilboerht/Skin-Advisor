import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    isSubsiteAccountDisabled: vi.fn(),
    sessionFindFirst: vi.fn(),
    feedbackUpsert: vi.fn(),
    feedbackDeleteMany: vi.fn(),
    rateLimit: vi.fn(),
    loggerError: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
    isSubsiteAccountDisabled: mocks.isSubsiteAccountDisabled,
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        advisorSession: { findFirst: mocks.sessionFindFirst },
        reportFeedback: {
            upsert: mocks.feedbackUpsert,
            deleteMany: mocks.feedbackDeleteMany,
        },
    },
}));

vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: mocks.loggerError, info: vi.fn(), warn: vi.fn() },
}));

import { DELETE, POST } from "../route";

const user = { id: "u1", role: "user", tokenVersion: 0 };
const sessionId = "session-12345678";

function postReq(body: unknown, id = sessionId): NextRequest {
    return {
        headers: new Headers(),
        url: `http://localhost/api/advisor/reports/${id}/feedback`,
        json: async () => body,
    } as unknown as NextRequest;
}

function deleteReq(query: string, id = sessionId): NextRequest {
    return {
        headers: new Headers(),
        url: `http://localhost/api/advisor/reports/${id}/feedback${query}`,
        json: async () => null,
    } as unknown as NextRequest;
}

function ctx(id = sessionId) {
    return { params: Promise.resolve({ id }) };
}

const validBody = { targetType: "report", targetKey: "report", verdict: "inaccurate" };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue(user);
    mocks.isSubsiteAccountDisabled.mockResolvedValue(false);
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.sessionFindFirst.mockResolvedValue({ sessionId });
    mocks.feedbackUpsert.mockResolvedValue({
        id: "f1",
        createdAt: new Date("2026-11-17T00:00:00.000Z"),
    });
    mocks.feedbackDeleteMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/advisor/reports/[id]/feedback", () => {
    it("未登录返回 401，不写库", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await POST(postReq(validBody), ctx());
        expect(res.status).toBe(401);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
    });

    it("限流返回 429，不写库", async () => {
        mocks.rateLimit.mockResolvedValue({ success: false });
        const res = await POST(postReq(validBody), ctx());
        expect(res.status).toBe(429);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
    });

    it("sessionId 格式非法返回 400", async () => {
        const res = await POST(postReq(validBody, "bad"), ctx("bad"));
        expect(res.status).toBe(400);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
    });

    it("参数错误返回 400", async () => {
        const res = await POST(
            postReq({ targetType: "report", targetKey: "report", verdict: "nope" }),
            ctx()
        );
        expect(res.status).toBe(400);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
    });

    it("报告不属于当前用户返回 404，不写库", async () => {
        mocks.sessionFindFirst.mockResolvedValue(null);
        const res = await POST(postReq(validBody), ctx());
        expect(res.status).toBe(404);
        expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
        expect(mocks.sessionFindFirst).toHaveBeenCalledWith({
            where: {
                sessionId,
                userId: "u1",
                completedAt: { not: null },
                archivedAt: null,
            },
            select: { sessionId: true },
        });
    });

    it("合法请求按唯一键 upsert", async () => {
        const res = await POST(
            postReq({ ...validBody, targetType: "dimension", targetKey: "waterOil", note: "  偏干  " }),
            ctx()
        );
        expect(res.status).toBe(200);
        expect(mocks.feedbackUpsert).toHaveBeenCalledWith({
            where: {
                userId_sessionId_targetType_targetKey: {
                    userId: "u1",
                    sessionId,
                    targetType: "dimension",
                    targetKey: "waterOil",
                },
            },
            update: { verdict: "inaccurate", note: "偏干" },
            create: {
                userId: "u1",
                sessionId,
                targetType: "dimension",
                targetKey: "waterOil",
                verdict: "inaccurate",
                note: "偏干",
            },
        });
    });

    it("改判为准确时清空旧备注", async () => {
        const res = await POST(
            postReq({ targetType: "report", targetKey: "report", verdict: "accurate" }),
            ctx()
        );
        expect(res.status).toBe(200);
        expect(mocks.feedbackUpsert.mock.calls[0][0].update).toEqual({
            verdict: "accurate",
            note: null,
        });
    });

    it("重复标记不准确且未传 note 时保留已有备注", async () => {
        const res = await POST(
            postReq({ targetType: "report", targetKey: "report", verdict: "inaccurate" }),
            ctx()
        );
        expect(res.status).toBe(200);
        expect(mocks.feedbackUpsert.mock.calls[0][0].update).toEqual({
            verdict: "inaccurate",
        });
    });
});

describe("DELETE /api/advisor/reports/[id]/feedback", () => {
    it("未登录返回 401，不删除", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await DELETE(deleteReq("?targetType=dimension&targetKey=waterOil"), ctx());
        expect(res.status).toBe(401);
        expect(mocks.feedbackDeleteMany).not.toHaveBeenCalled();
    });

    it("缺少 targetKey 返回 400，不删除", async () => {
        const res = await DELETE(deleteReq("?targetType=dimension"), ctx());
        expect(res.status).toBe(400);
        expect(mocks.feedbackDeleteMany).not.toHaveBeenCalled();
    });

    it("报告不属于当前用户返回 404，不删除", async () => {
        mocks.sessionFindFirst.mockResolvedValue(null);
        const res = await DELETE(deleteReq("?targetType=dimension&targetKey=waterOil"), ctx());
        expect(res.status).toBe(404);
        expect(mocks.feedbackDeleteMany).not.toHaveBeenCalled();
    });

    it("撤销自己的反馈", async () => {
        const res = await DELETE(deleteReq("?targetType=dimension&targetKey=waterOil"), ctx());
        expect(res.status).toBe(200);
        expect(mocks.feedbackDeleteMany).toHaveBeenCalledWith({
            where: {
                userId: "u1",
                sessionId,
                targetType: "dimension",
                targetKey: "waterOil",
            },
        });
        await expect(res.json()).resolves.toEqual({ success: true, deleted: 1 });
    });

    it("限流返回 429，不删除", async () => {
        mocks.rateLimit.mockResolvedValue({ success: false });
        const res = await DELETE(deleteReq("?targetType=dimension&targetKey=waterOil"), ctx());
        expect(res.status).toBe(429);
        expect(mocks.feedbackDeleteMany).not.toHaveBeenCalled();
    });
});
