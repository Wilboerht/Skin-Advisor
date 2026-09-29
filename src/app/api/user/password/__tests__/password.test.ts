/**
 * 密码管理 BFF 测试
 * PUT  /api/user/password            - 修改密码（代理 /api/oauth/user/password）
 * POST /api/user/password/set        - 设置密码（代理 /api/oauth/user/password/set）
 * POST /api/user/password/set-code   - 发送设置密码验证码（代理 /api/oauth/user/password/send-code）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getAccessToken: vi.fn(),
    refreshSessionFromCookie: vi.fn(),
    verify: vi.fn(),
    rateLimit: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
    getAccessToken: mocks.getAccessToken,
    refreshSessionFromCookie: mocks.refreshSessionFromCookie,
    ssoVerifier: { verify: mocks.verify },
}));

vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.stubGlobal("fetch", mocks.fetch);

import { PUT } from "../route";
import { POST as SET } from "../set/route";
import { POST as SEND_CODE } from "../set-code/route";

const sessionUser = { id: "u1", role: "user", tokenVersion: 0 };

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
});

describe("PUT /api/user/password", () => {
    it("未登录返回 401 且不请求官网", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await PUT(fakeReq({ oldPassword: "a", newPassword: "b" }));
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("请求体非 JSON 对象返回 400", async () => {
        const res = await PUT(fakeReq(null));
        expect(res.status).toBe(400);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("转发官网 OAuth 密码端点（Bearer + 原样 body）", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: { message: "密码修改成功" } }));

        const res = await PUT(fakeReq({ oldPassword: "Old1a", newPassword: "New2b", confirmPassword: "New2b" }));
        expect(res.status).toBe(200);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/user/password");
        expect(init.method).toBe("PUT");
        expect(init.headers.Authorization).toBe("Bearer at-1");
        expect(JSON.parse(init.body)).toEqual({
            oldPassword: "Old1a",
            newPassword: "New2b",
            confirmPassword: "New2b",
        });
    });

    it("官网 400 业务错误透传 code/message", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(400, { success: false, error: { code: "PASSWORD_INCORRECT", message: "旧密码错误" } })
        );
        const res = await PUT(fakeReq({ oldPassword: "x", newPassword: "y" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("PASSWORD_INCORRECT");
    });

    it("官网网络异常返回 502", async () => {
        mocks.fetch.mockRejectedValue(new Error("fetch failed"));
        const res = await PUT(fakeReq({ oldPassword: "x", newPassword: "y" }));
        expect(res.status).toBe(502);
    });
});

describe("POST /api/user/password/set", () => {
    it("转发官网设置密码端点", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: { message: "密码设置成功" } }));

        const res = await SET(fakeReq({ code: "123456", password: "Abc12345!", confirmPassword: "Abc12345!" }));
        expect(res.status).toBe(200);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/user/password/set");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer at-1");
    });

    it("官网 401 返回 401", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(401, { error: "invalid_token" }));
        const res = await SET(fakeReq({ code: "123456", password: "Abc12345!", confirmPassword: "Abc12345!" }));
        expect(res.status).toBe(401);
    });
});

describe("POST /api/user/password/set-code", () => {
    it("转发官网发码端点（无 body，手机号由官网解析）", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(200, { success: true, data: { expiresIn: 300 } }));

        const res = await SEND_CODE(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true, data: { expiresIn: 300 } });

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/user/password/send-code");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer at-1");
        expect(init.body).toBeUndefined();
        expect(init.headers["Content-Type"]).toBeUndefined();
    });

    it("官网未绑定手机号（PHONE_NOT_BOUND）透传", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(400, { success: false, error: { code: "PHONE_NOT_BOUND", message: "当前账号未绑定手机号，无法发送验证码" } })
        );
        const res = await SEND_CODE(fakeReq());
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe("PHONE_NOT_BOUND");
    });

    it("用户级限流触发返回 429 且不请求官网", async () => {
        // 第一次 rateLimit = IP 限流通过；第二次 = 用户级限流拒绝
        mocks.rateLimit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
        const res = await SEND_CODE(fakeReq());
        expect(res.status).toBe(429);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});
