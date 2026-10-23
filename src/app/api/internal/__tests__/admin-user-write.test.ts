import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    guard: vi.fn(),
    updateAdminUser: vi.fn(),
    error: vi.fn(),
}));

vi.mock("@/lib/internal-guard", () => ({
    guardInternalUserRequest: mocks.guard,
}));

vi.mock("@/lib/admin-user-update", () => ({
    updateAdminUser: mocks.updateAdminUser,
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: mocks.error, warn: vi.fn(), info: vi.fn() },
}));

import { PATCH } from "../admin/user/route";

const ENDPOINT_URL = "http://localhost/api/internal/admin/user?userId=user-1";

function fakeReq(body: string, url = ENDPOINT_URL): NextRequest {
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
        text: async () => body,
    } as unknown as NextRequest;
}

const validBody = {
    patch: { dailyTestLimit: 20 },
    operator: { id: "admin-1", email: "admin@test.com", name: "Admin" },
    mainAuditId: "audit-1",
};

describe("PATCH /api/internal/admin/user", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.guard.mockResolvedValue({ userId: "user-1" });
        mocks.updateAdminUser.mockResolvedValue({
            found: true,
            changed: true,
            previous: { role: "user", dailyTestLimit: 10 },
            current: { role: "user", dailyTestLimit: 20 },
            revokedRefreshTokens: 0,
        });
    });

    it("鉴权失败时直接返回 guard 响应", async () => {
        const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        mocks.guard.mockResolvedValue({ error: response });

        const res = await PATCH(fakeReq(JSON.stringify(validBody)));
        expect(res.status).toBe(401);
        expect(mocks.updateAdminUser).not.toHaveBeenCalled();
    });

    it("非法 JSON 返回 400", async () => {
        const res = await PATCH(fakeReq("{invalid"));
        expect(res.status).toBe(400);
        expect(mocks.updateAdminUser).not.toHaveBeenCalled();
    });

    it("缺少可更新字段返回 400", async () => {
        const res = await PATCH(
            fakeReq(JSON.stringify({ patch: {}, operator: { id: "admin-1" } }))
        );
        expect(res.status).toBe(400);
        expect(mocks.updateAdminUser).not.toHaveBeenCalled();
    });

    it("用户不存在返回 404", async () => {
        mocks.updateAdminUser.mockResolvedValue({ found: false });
        const res = await PATCH(fakeReq(JSON.stringify(validBody)));
        expect(res.status).toBe(404);
    });

    it("成功时调用服务并返回新旧值", async () => {
        const rawBody = JSON.stringify(validBody);
        const res = await PATCH(fakeReq(rawBody));
        expect(res.status).toBe(200);
        expect(mocks.guard).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                scope: "admin-user-write",
                maxRequests: 30,
                rawBody,
            })
        );
        expect(mocks.updateAdminUser).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "user-1",
                patch: { dailyTestLimit: 20 },
                operator: validBody.operator,
                mainAuditId: "audit-1",
            })
        );
        const body = await res.json();
        expect(body).toEqual({
            success: true,
            data: {
                changed: true,
                previous: { role: "user", dailyTestLimit: 10 },
                current: { role: "user", dailyTestLimit: 20 },
                revokedRefreshTokens: 0,
            },
        });
    });

    it("服务异常返回 500", async () => {
        mocks.updateAdminUser.mockRejectedValue(new Error("db down"));
        const res = await PATCH(fakeReq(JSON.stringify(validBody)));
        expect(res.status).toBe(500);
        expect(mocks.error).toHaveBeenCalled();
    });
});
