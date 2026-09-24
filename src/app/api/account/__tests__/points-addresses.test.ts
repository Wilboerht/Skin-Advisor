import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

import { GET as pointsGET } from "../points/overview/route";
import { POST as redeemPOST } from "../points/redeem/route";
import { GET as redemptionsGET } from "../points/redemptions/route";
import { GET as trackingGET } from "../points/redemptions/[id]/tracking/route";
import { GET as addressesGET, POST as addressesPOST } from "../addresses/route";
import { PATCH as addressPATCH, DELETE as addressDELETE } from "../addresses/[id]/route";

function jsonResponse(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function req(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown): NextRequest {
    return new NextRequest(new URL(`http://localhost${url}`), {
        method,
        ...(body !== undefined
            ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } }
            : {}),
    } as never);
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockResolvedValue("at-1");
    mocks.verify.mockResolvedValue({ sub: "u-mall" });
});

describe("/api/account/points* 与 /api/account/addresses*", () => {
    it("未登录返回 401，不回源官网", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await pointsGET(req("GET", "/api/account/points"));
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("积分余额透传官网响应", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-p1", role: "user", tokenVersion: 0 });
        const payload = { success: true, data: { available: 120 } };
        mocks.fetch.mockResolvedValue(jsonResponse(200, payload));

        const res = await pointsGET(req("GET", "/api/account/points"));
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual(payload);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/points");
        expect(init.headers.Authorization).toBe("Bearer at-1");
    });

    it("兑换透传 body 与 POST", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-p2", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: { duplicated: false } }));

        const res = await redeemPOST(
            req("POST", "/api/account/points/redeem", { productId: "p1", addressId: "a1", requestId: "r1" })
        );
        expect(res.status).toBe(200);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/points/redeem");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ productId: "p1", addressId: "a1", requestId: "r1" });
    });

    it("兑换记录透传 offset 查询参数", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-p3", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: { redemptions: [] } }));

        await redemptionsGET(req("GET", "/api/account/points/redemptions?offset=10"));
        expect(String(mocks.fetch.mock.calls[0][0])).toContain("/api/oauth/points/redemptions?offset=10");
    });

    it("物流轨迹透传记录 id", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-p4", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: { supported: false } }));

        const res = await trackingGET(req("GET", "/api/account/points/redemptions/rid-1/tracking"), ctx("rid-1"));
        expect(res.status).toBe(200);
        expect(String(mocks.fetch.mock.calls[0][0])).toContain("/api/oauth/points/redemptions/rid-1/tracking");
    });

    it("地址列表/新增/编辑/删除分别映射 GET/POST/PATCH/DELETE", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-a1", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: {} }));

        await addressesGET(req("GET", "/api/account/addresses"));
        expect(String(mocks.fetch.mock.calls[0][0])).toContain("/api/oauth/addresses");
        expect(mocks.fetch.mock.calls[0][1].method ?? "GET").toBe("GET");

        await addressesPOST(req("POST", "/api/account/addresses", { recipient: "x" }));
        expect(mocks.fetch.mock.calls[1][1].method).toBe("POST");

        await addressPATCH(
            req("PATCH", "/api/account/addresses/aid-1", { recipient: "y" }),
            ctx("aid-1")
        );
        expect(String(mocks.fetch.mock.calls[2][0])).toContain("/api/oauth/addresses/aid-1");
        expect(mocks.fetch.mock.calls[2][1].method).toBe("PATCH");

        await addressDELETE(req("DELETE", "/api/account/addresses/aid-1"), ctx("aid-1"));
        expect(mocks.fetch.mock.calls[3][1].method).toBe("DELETE");
    });

    it("官网 OAuth 错误归一化为契约结构", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-e1", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(
            jsonResponse(403, { error: "insufficient_scope", error_description: "需要 membership scope" })
        );

        const res = await pointsGET(req("GET", "/api/account/points"));
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("INSUFFICIENT_SCOPE");
    });
});
