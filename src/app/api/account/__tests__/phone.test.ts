/**
 * 换绑手机号 BFF 测试
 * PUT  /api/account/phone            - 双验证码换绑（代理官网 /api/oauth/phone）
 * POST /api/account/phone/send-code  - 发送换绑验证码（代理官网）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getAccessToken: vi.fn(),
    refreshSessionFromCookie: vi.fn(),
    verify: vi.fn(),
    userUpdate: vi.fn(),
    rateLimit: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
    getAccessToken: mocks.getAccessToken,
    refreshSessionFromCookie: mocks.refreshSessionFromCookie,
    ssoVerifier: { verify: mocks.verify },
}));

vi.mock("@/lib/prisma", () => ({
    default: { user: { update: mocks.userUpdate } },
}));

vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.stubGlobal("fetch", mocks.fetch);

import { PUT } from "../phone/route";
import { POST } from "../phone/send-code/route";

const sessionUser = { id: "u1", role: "user", tokenVersion: 0, phone: "13812341234" };

function fakeReq(body?: unknown): NextRequest {
    return {
        headers: new Headers(),
        json: async () => body,
    } as unknown as NextRequest;
}

function jsonResponse(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue(sessionUser);
    mocks.getAccessToken.mockResolvedValue("at-1");
    mocks.verify.mockResolvedValue({ sub: "u1" });
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.userUpdate.mockResolvedValue({});
});

describe("POST /api/account/phone/send-code", () => {
    it("未登录返回 401 且不请求官网", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await POST(fakeReq({ target: "current" }));
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("target=new 缺少/非法新手机号返回 400", async () => {
        const res = await POST(fakeReq({ target: "new", newPhone: "12345" }));
        expect(res.status).toBe(400);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("target=current 转发官网 OAuth 端点（Bearer 透传）", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: { expiresIn: 300 } }));

        const res = await POST(fakeReq({ target: "current" }));
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true, data: { expiresIn: 300 } });

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/phone/send-code");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer at-1");
        expect(JSON.parse(init.body)).toEqual({ target: "current" });
    });

    it("官网业务错误（PHONE_IN_USE）透传 code/message", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(400, { success: false, error: { code: "PHONE_IN_USE", message: "该手机号已被注册" } })
        );

        const res = await POST(fakeReq({ target: "new", newPhone: "13900139000" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("PHONE_IN_USE");
    });

    it("官网 OAuth 鉴权错误（insufficient_scope）归一化为业务错误格式", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(403, { error: "insufficient_scope", error_description: "需要 phone scope" })
        );

        const res = await POST(fakeReq({ target: "current" }));
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("INSUFFICIENT_SCOPE");
        expect(body.error.message).toBe("需要 phone scope");
    });

    it("官网网络异常返回 502", async () => {
        mocks.fetch.mockRejectedValue(new Error("fetch failed"));
        const res = await POST(fakeReq({ target: "current" }));
        expect(res.status).toBe(502);
    });

    it("用户级限流触发返回 429", async () => {
        // 第一次 rateLimit = IP 限流通过；第二次 = 用户级限流拒绝
        mocks.rateLimit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
        const res = await POST(fakeReq({ target: "current" }));
        expect(res.status).toBe(429);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});

describe("PUT /api/account/phone", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await PUT(fakeReq({ newPhone: "13900139000", currentCode: "123456", newCode: "654321" }));
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("参数非法返回 400", async () => {
        const res = await PUT(fakeReq({ newPhone: "13900139000", newCode: "12" }));
        expect(res.status).toBe(400);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("成功换绑：透传响应并同步本地手机号副本", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(200, { success: true, data: { phone: "139****9000" } })
        );

        const res = await PUT(fakeReq({ newPhone: "13900139000", currentCode: "123456", newCode: "654321" }));
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true, data: { phone: "139****9000" } });

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/phone");
        expect(init.method).toBe("PUT");
        expect(init.headers.Authorization).toBe("Bearer at-1");
        expect(JSON.parse(init.body)).toEqual({
            newPhone: "13900139000",
            currentCode: "123456",
            newCode: "654321",
        });
        expect(mocks.userUpdate).toHaveBeenCalledWith({
            where: { id: "u1" },
            data: { phoneNumber: "13900139000" },
        });
    });

    it("本地副本同步失败不阻断响应（官网为准）", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(200, { success: true, data: { phone: "13900139000" } })
        );
        mocks.userUpdate.mockRejectedValue(new Error("db down"));

        const res = await PUT(fakeReq({ newPhone: "13900139000", currentCode: "123456", newCode: "654321" }));
        expect(res.status).toBe(200);
    });

    it("官网 401 返回 401 且不同步本地副本", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(401, { error: "invalid_token" }));
        const res = await PUT(fakeReq({ newPhone: "13900139000", currentCode: "123456", newCode: "654321" }));
        expect(res.status).toBe(401);
        expect(mocks.userUpdate).not.toHaveBeenCalled();
    });

    it("官网网络异常返回 502", async () => {
        mocks.fetch.mockRejectedValue(new Error("fetch failed"));
        const res = await PUT(fakeReq({ newPhone: "13900139000", currentCode: "123456", newCode: "654321" }));
        expect(res.status).toBe(502);
    });
});
