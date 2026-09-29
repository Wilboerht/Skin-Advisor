import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * proxy（全局中间件）C 端 CSRF 豁免测试
 *
 * 重点保障：/api/internal/* 是主站服务端到服务端调用（无 Cookie），
 * 必须豁免 proxy 层 CSRF 拦截；安全性由路由内 HMAC 签名保证。
 * 其余 C 端 API 仍必须执行 CSRF 校验。
 */

const mocks = vi.hoisted(() => ({
    verifyCsrfToken: vi.fn(),
    verifyToken: vi.fn(),
    verifySessionSignature: vi.fn(),
}));

vi.mock("@nihplod/sso-sdk/next", () => ({
    createSsoMiddleware: () => async () => null,
}));
vi.mock("@/lib/session-verify", () => ({
    verifySessionSignature: mocks.verifySessionSignature,
    ADMIN_SESSION_COOKIE_NAME: "admin_session",
}));
vi.mock("@/lib/csrf", () => ({
    verifyCsrfToken: mocks.verifyCsrfToken,
}));
vi.mock("@/lib/auth-config", () => ({
    AUTH_COOKIE_NAME: "__Host-auth_token",
    verifyToken: mocks.verifyToken,
}));
vi.mock("@/lib/sso-auth", () => ({
    ACCESS_TOKEN_COOKIE: "sso_access_token",
}));
vi.mock("@/lib/sso-config", () => ({
    SSO_INSECURE_LOCAL_DEV: false,
    getPublicOrigin: () => "",
}));
vi.mock("@/lib/public-paths", () => ({
    PUBLIC_PATHS: [],
}));

import { proxy } from "@/proxy";

beforeEach(() => {
    vi.clearAllMocks();
    // 模拟"无 Cookie、无 CSRF token"时 CSRF 校验失败（与生产 verifyCsrfToken 一致）
    mocks.verifyCsrfToken.mockResolvedValue({ valid: false, reason: "missing_auth" });
    mocks.verifyToken.mockResolvedValue(null);
    mocks.verifySessionSignature.mockResolvedValue(null);
});

describe("proxy C 端 CSRF 豁免：/api/internal/*", () => {
    it("POST /api/internal/diary 无 Cookie 不被 CSRF 层拦截", async () => {
        const req = new NextRequest("http://localhost/api/internal/diary?userId=u1", { method: "POST" });
        const res = await proxy(req);
        expect(mocks.verifyCsrfToken).not.toHaveBeenCalled();
        expect(res.status).toBe(200);
    });

    it("DELETE /api/internal/diary 无 Cookie 不被 CSRF 层拦截", async () => {
        const req = new NextRequest("http://localhost/api/internal/diary?userId=u1&date=2026-09-24", { method: "DELETE" });
        const res = await proxy(req);
        expect(mocks.verifyCsrfToken).not.toHaveBeenCalled();
        expect(res.status).toBe(200);
    });

    it("GET /api/internal/mp-skin 不触发 CSRF 校验", async () => {
        const req = new NextRequest("http://localhost/api/internal/mp-skin?phone=13800000000", { method: "GET" });
        const res = await proxy(req);
        expect(mocks.verifyCsrfToken).not.toHaveBeenCalled();
        expect(res.status).toBe(200);
    });

    it("前缀边界：/api/internalx 不属于豁免范围，仍执行 CSRF 校验", async () => {
        const req = new NextRequest("http://localhost/api/internalx/diary", { method: "POST" });
        const res = await proxy(req);
        expect(mocks.verifyCsrfToken).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(401);
    });
});

describe("proxy C 端 CSRF：非豁免路径照常拦截", () => {
    it("POST /api/user/diary 无 Cookie 返回 401", async () => {
        const req = new NextRequest("http://localhost/api/user/diary", { method: "POST" });
        const res = await proxy(req);
        expect(mocks.verifyCsrfToken).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(401);
        await expect(res.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("GET /api/user/diary 同样经过 verifyCsrfToken（安全方法在校验内放行）", async () => {
        mocks.verifyCsrfToken.mockResolvedValue({ valid: true, reason: "ok" });
        const req = new NextRequest("http://localhost/api/user/diary", { method: "GET" });
        const res = await proxy(req);
        expect(mocks.verifyCsrfToken).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(200);
    });
});
