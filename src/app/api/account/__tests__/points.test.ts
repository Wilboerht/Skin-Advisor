import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    createSignedInternalApiHeaders: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/internal-api", () => ({
    createSignedInternalApiHeaders: mocks.createSignedInternalApiHeaders,
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.stubGlobal("fetch", mocks.fetch);

import { GET } from "../points/route";

function fakeReq(): NextRequest {
    return { headers: new Headers() } as unknown as NextRequest;
}

function jsonResponse(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

const signedHeaders = {
    config: { project: "advisor", key: "k", secret: "s" },
    headers: { "X-Internal-API-Key": "k" },
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "u1", role: "user", tokenVersion: 0, phone: "13812341234" });
    mocks.createSignedInternalApiHeaders.mockResolvedValue(signedHeaders);
});

describe("GET /api/account/points", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await GET(fakeReq());
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("无手机号时降级 { available: null }，不回源官网", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u1", role: "user", tokenVersion: 0, phone: undefined });
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ available: null });
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("签名头使用 advisor/GET/balance 路径，query 携带手机号", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(200, {
            success: true,
            data: { available: 120, redeemRate: 100, membershipLevel: "GOLD" },
        }));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);

        expect(mocks.createSignedInternalApiHeaders).toHaveBeenCalledWith(
            "advisor", "GET", "/api/v1/internal/points/balance", ""
        );
        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/v1/internal/points/balance?phone=13812341234");
        expect(init.headers["X-Internal-API-Key"]).toBe("k");
    });

    it("正常返回 available/redeemRate/membershipLevel（按官网 {success,data} 结构解包）", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(200, {
            success: true,
            data: {
                available: 120,
                frozen: 30,
                nextReleaseAt: "2025-01-01",
                redeemRate: 100,
                membershipLevel: "GOLD",
            },
        }));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
            available: 120,
            redeemRate: 100,
            membershipLevel: "GOLD",
        });
    });

    it("官网非 2xx 降级 { available: null }", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(500, {}));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ available: null });
    });

    it("官网超时/网络异常降级 { available: null }", async () => {
        mocks.fetch.mockRejectedValue(new Error("aborted"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ available: null });
    });

    it("未配置内部 API 密钥时降级 { available: null }", async () => {
        mocks.createSignedInternalApiHeaders.mockResolvedValue(null);
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ available: null });
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});
