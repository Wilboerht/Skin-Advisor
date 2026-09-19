import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getAccessToken: vi.fn(),
    refreshSessionFromCookie: vi.fn(),
    verify: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
    getAccessToken: mocks.getAccessToken,
    refreshSessionFromCookie: mocks.refreshSessionFromCookie,
    ssoVerifier: { verify: mocks.verify },
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.stubGlobal("fetch", mocks.fetch);

import { GET } from "../membership/route";

function fakeReq(): NextRequest {
    return { headers: new Headers() } as unknown as NextRequest;
}

function jsonResponse(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

const membershipPayload = {
    membershipLevel: "GOLD",
    memberId: "M-001",
    totalSpent: 3200,
    currentLevel: { level: "GOLD" },
    nextLevel: { level: "DIAMOND" },
    allLevels: ["REGULAR", "SILVER", "GOLD", "DIAMOND"],
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockResolvedValue("at-1");
    mocks.verify.mockResolvedValue({ sub: "u-m" });
});

describe("GET /api/account/membership", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await GET(fakeReq());
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("原样透传官网会员数据", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-m1", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(200, membershipPayload));

        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual(membershipPayload);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/membership");
        expect(init.headers.Authorization).toBe("Bearer at-1");
    });

    it("30 秒内同一用户命中进程内缓存，不重复回源", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-m2", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(200, membershipPayload));

        const first = await GET(fakeReq());
        const second = await GET(fakeReq());
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });

    it("官网 401 返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-m3", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(401, { error: "unauthorized" }));
        const res = await GET(fakeReq());
        expect(res.status).toBe(401);
    });

    it("官网异常/超时返回 502", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-m4", role: "user", tokenVersion: 0 });
        mocks.fetch.mockRejectedValue(new Error("timeout"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(502);
    });
});
