import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * 微信小程序 Bearer 认证通道测试（src/lib/sso-auth.ts）
 *
 * 重点保障：
 * - 有效 Bearer → mpVerifier 验签后 upsertLocalUser 建档并返回 SessionUser
 * - 无效/过期/被撤销 Bearer → null，且不回落 Cookie 路径
 * - 无 Authorization 头 → Cookie 旧路径行为完全不变
 */

const mocks = vi.hoisted(() => ({
    ssoVerify: vi.fn(),
    mpVerify: vi.fn(),
    upsert: vi.fn(),
    userFindUnique: vi.fn(),
    cookies: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    verifyToken: vi.fn(),
    isDisabledUser: vi.fn(),
}));

vi.mock("@nihplod/sso-verify", () => ({
    createTokenVerifier: (opts: { audience?: string }) => ({
        // 按 audience 区分两个验签器：ssoVerifier（子站 client_id）与 mpVerifier（小程序）
        verify: opts.audience === "wechat-miniprogram" ? mocks.mpVerify : mocks.ssoVerify,
    }),
}));
vi.mock("@nihplod/sso-sdk/next", () => ({
    toInsecureCookieName: (name: string) => name.replace(/^__(Host|Secure)-/, ""),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/sso-config", () => ({
    SSO_INSECURE_LOCAL_DEV: false,
    SSO_SERVER_BASE_URL: "https://sso.internal",
}));
vi.mock("@/lib/auth-config", () => ({
    AUTH_COOKIE_NAME: "__Host-auth_token",
    verifyToken: mocks.verifyToken,
}));
vi.mock("@/lib/permissions", () => ({
    UserRole: { USER: "user", ADMIN: "admin" },
    isDisabledUser: mocks.isDisabledUser,
}));
vi.mock("@/lib/prisma", () => ({
    default: { user: { upsert: mocks.upsert, findUnique: mocks.userFindUnique } },
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: mocks.warn, error: mocks.error, info: mocks.info },
}));

import {
    getSessionUser,
    verifyMpBearerToken,
    markAccessTokenRevoked,
    MP_CLIENT_ID,
} from "./sso-auth";

const dbUser = {
    id: "user_mp_1",
    email: null,
    phoneNumber: "13800000000",
    name: "小程序用户",
    avatarUrl: null,
    membershipLevel: "GOLD",
    totalSpent: 1200,
    gender: null,
    profileSyncedAt: null,
    role: "user",
    dailyTestLimit: null,
    tokenVersion: 0,
};

function reqWith(headers: Record<string, string>): NextRequest {
    return new NextRequest("http://localhost/api/user/diary", { headers });
}
const bearerReq = (token: string) => reqWith({ authorization: `Bearer ${token}` });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => undefined, set: vi.fn() });
    mocks.isDisabledUser.mockReturnValue(false);
    mocks.upsert.mockResolvedValue(dbUser);
    mocks.verifyToken.mockResolvedValue(null);
});

describe("MP_CLIENT_ID", () => {
    it("未配置 SSO_MP_CLIENT_ID 时默认为 wechat-miniprogram", () => {
        expect(MP_CLIENT_ID).toBe("wechat-miniprogram");
    });
});

describe("verifyMpBearerToken", () => {
    it("有效 Bearer token 返回 payload", async () => {
        mocks.mpVerify.mockResolvedValue({ sub: "user_mp_1", aud: "wechat-miniprogram" });
        const payload = await verifyMpBearerToken(bearerReq("valid-mp-token"));
        expect(payload?.sub).toBe("user_mp_1");
        expect(mocks.mpVerify).toHaveBeenCalledWith("valid-mp-token");
        expect(mocks.ssoVerify).not.toHaveBeenCalled();
    });

    it("无 Authorization 头返回 null，不调用验签", async () => {
        expect(await verifyMpBearerToken(reqWith({}))).toBeNull();
        expect(mocks.mpVerify).not.toHaveBeenCalled();
    });

    it("格式不符（非 Bearer scheme）返回 null，不调用验签", async () => {
        expect(await verifyMpBearerToken(reqWith({ authorization: "Basic abc" }))).toBeNull();
        expect(mocks.mpVerify).not.toHaveBeenCalled();
    });

    it("验签失败（无效/过期）返回 null，只记 warn", async () => {
        mocks.mpVerify.mockResolvedValue(null);
        expect(await verifyMpBearerToken(bearerReq("bad-mp-token"))).toBeNull();
        expect(mocks.warn).toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
    });

    it("验签抛异常返回 null，只记 warn", async () => {
        mocks.mpVerify.mockRejectedValue(new Error("jwks unreachable"));
        expect(await verifyMpBearerToken(bearerReq("error-mp-token"))).toBeNull();
        expect(mocks.warn).toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
    });

    it("命中本地撤销黑名单的 token 直接拒绝，不回源验签", async () => {
        markAccessTokenRevoked("revoked-mp-token");
        expect(await verifyMpBearerToken(bearerReq("revoked-mp-token"))).toBeNull();
        expect(mocks.mpVerify).not.toHaveBeenCalled();
    });
});

describe("getSessionUser Bearer 通道", () => {
    it("有效 Bearer → upsertLocalUser 建档/同步并返回 SessionUser", async () => {
        mocks.mpVerify.mockResolvedValue({ sub: "user_mp_1" });
        const user = await getSessionUser(bearerReq("valid-mp-token-2"));
        expect(mocks.upsert).toHaveBeenCalledTimes(1);
        expect(mocks.upsert.mock.calls[0][0].where).toEqual({ id: "user_mp_1" });
        expect(user).toMatchObject({
            id: "user_mp_1",
            name: "小程序用户",
            membershipLevel: "GOLD",
            totalSpent: 1200,
        });
        // 未触碰 Cookie 路径与浏览器端验签器
        expect(mocks.cookies).not.toHaveBeenCalled();
        expect(mocks.ssoVerify).not.toHaveBeenCalled();
    });

    it("Bearer 无效/过期 → 返回 null，不回落 Cookie 逻辑", async () => {
        mocks.mpVerify.mockResolvedValue(null);
        const user = await getSessionUser(bearerReq("expired-mp-token"));
        expect(user).toBeNull();
        expect(mocks.cookies).not.toHaveBeenCalled();
        expect(mocks.ssoVerify).not.toHaveBeenCalled();
        expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it("非 Bearer 的 Authorization 头同样锁定 Bearer 分支，不回落 Cookie", async () => {
        const user = await getSessionUser(reqWith({ authorization: "Basic abc" }));
        expect(user).toBeNull();
        expect(mocks.cookies).not.toHaveBeenCalled();
        expect(mocks.ssoVerify).not.toHaveBeenCalled();
    });

    it("被禁用用户 Bearer 验签通过也返回 null", async () => {
        mocks.mpVerify.mockResolvedValue({ sub: "user_mp_1" });
        mocks.isDisabledUser.mockReturnValue(true);
        const user = await getSessionUser(bearerReq("valid-mp-token-3"));
        expect(user).toBeNull();
    });
});

describe("getSessionUser Cookie 旧路径（无 Authorization 头）", () => {
    it("无任何 Cookie → 返回 null（走 verifySsoToken → 静默轮换 → 本地 JWT 兜底）", async () => {
        const user = await getSessionUser(reqWith({}));
        expect(user).toBeNull();
        // 确认确实走了 Cookie 路径而非 Bearer 分支
        expect(mocks.cookies).toHaveBeenCalled();
        expect(mocks.mpVerify).not.toHaveBeenCalled();
    });

    it("SSO Cookie token 有效 → upsert 并返回 SessionUser（行为不变）", async () => {
        mocks.cookies.mockResolvedValue({
            get: (name: string) =>
                name === "__Host-nihplod_sso_at" ? { value: "cookie-sso-token" } : undefined,
            set: vi.fn(),
        });
        mocks.ssoVerify.mockResolvedValue({ sub: "user_sso_1" });
        mocks.upsert.mockResolvedValue({ ...dbUser, id: "user_sso_1", name: "网页用户" });
        const user = await getSessionUser(reqWith({}));
        expect(mocks.ssoVerify).toHaveBeenCalledWith("cookie-sso-token");
        expect(mocks.mpVerify).not.toHaveBeenCalled();
        expect(user).toMatchObject({ id: "user_sso_1", name: "网页用户" });
    });
});
