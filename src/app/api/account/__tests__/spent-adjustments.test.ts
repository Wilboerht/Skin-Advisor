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

import { GET, POST } from "../spent-adjustments/route";

function fakeReq(): NextRequest {
    return { headers: new Headers() } as unknown as NextRequest;
}

function postReq(body: unknown): NextRequest {
    return new Request("http://localhost/api/account/spent-adjustments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as NextRequest;
}

function jsonResponse(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockResolvedValue("at-1");
    mocks.verify.mockResolvedValue({ sub: "u-spent" });
});

describe("/api/account/spent-adjustments", () => {
    it("未登录返回 401，不回源官网", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await GET(fakeReq());
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("GET 透传官网补录列表", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-spent-1", role: "user", tokenVersion: 0 });
        const payload = { success: true, data: { applications: [{ id: "app-1" }] } };
        mocks.fetch.mockResolvedValue(jsonResponse(200, payload));

        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual(payload);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/spent-adjustments");
        expect(init.headers.Authorization).toBe("Bearer at-1");
    });

    it("POST 透传请求体并原样返回官网响应", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-spent-2", role: "user", tokenVersion: 0 });
        const payload = { success: true, data: { application: { id: "app-new" } } };
        mocks.fetch.mockResolvedValue(jsonResponse(200, payload));

        const res = await POST(postReq({ channel: "TMALL", orderNo: "ORDER123" }));
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual(payload);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/spent-adjustments");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer at-1");
        expect(JSON.parse(String(init.body))).toEqual({ channel: "TMALL", orderNo: "ORDER123" });
    });

    it("官网业务错误（PENDING_LIMIT）按契约透传", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-spent-3", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(
            jsonResponse(400, { success: false, error: { code: "PENDING_LIMIT", message: "待审上限" } })
        );

        const res = await POST(postReq({ channel: "TMALL", orderNo: "X" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("PENDING_LIMIT");
    });

    it("官网 OAuth 鉴权错误归一化为契约结构", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-spent-4", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(
            jsonResponse(403, { error: "insufficient_scope", error_description: "需要 membership scope" })
        );

        const res = await GET(fakeReq());
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("INSUFFICIENT_SCOPE");
        expect(body.error.message).toBe("需要 membership scope");
    });

    it("官网不可达返回 502", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-spent-5", role: "user", tokenVersion: 0 });
        mocks.fetch.mockRejectedValue(new Error("timeout"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(502);
    });
});
