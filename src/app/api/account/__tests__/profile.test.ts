import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    upsertLocalUser: vi.fn(),
    getAccessToken: vi.fn(),
    refreshSessionFromCookie: vi.fn(),
    verify: vi.fn(),
    findUnique: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
    upsertLocalUser: mocks.upsertLocalUser,
    getAccessToken: mocks.getAccessToken,
    refreshSessionFromCookie: mocks.refreshSessionFromCookie,
    ssoVerifier: { verify: mocks.verify },
}));

vi.mock("@/lib/prisma", () => ({
    default: { user: { findUnique: mocks.findUnique } },
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.stubGlobal("fetch", mocks.fetch);

import { GET, PATCH } from "../profile/route";

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
    mocks.upsertLocalUser.mockResolvedValue(null);
});

describe("GET /api/account/profile", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await GET(fakeReq());
        expect(res.status).toBe(401);
    });

    it("返回本地副本资料，手机号打码；生日回源官网 userinfo", async () => {
        mocks.findUnique.mockResolvedValue({
            name: "小红",
            avatarUrl: "https://nihplod.cn/uploads/a.png",
            gender: "female",
            phoneNumber: "13812341234",
            membershipLevel: "GOLD",
        });
        mocks.fetch.mockResolvedValue(jsonResponse(200, { sub: "u1", birthday: "1995-06-01" }));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
            nickname: "小红",
            avatar: "https://nihplod.cn/uploads/a.png",
            gender: "female",
            phone: "138****1234",
            membershipLevel: "GOLD",
            birthday: "1995-06-01",
            hasPassword: null,
        });
        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/userinfo");
        expect(init.headers.Authorization).toBe("Bearer at-1");
    });

    it("官网 userinfo 不可达时 birthday 降级为 null，不影响其他字段", async () => {
        mocks.findUnique.mockResolvedValue({
            name: "小红",
            avatarUrl: null,
            gender: null,
            phoneNumber: "13812341234",
            membershipLevel: null,
        });
        mocks.fetch.mockRejectedValue(new Error("fetch failed"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.birthday).toBeNull();
        expect(body.nickname).toBe("小红");
    });

    it("本地无记录时返回全 null 字段", async () => {
        mocks.findUnique.mockResolvedValue(null);
        mocks.fetch.mockResolvedValue(jsonResponse(200, { sub: "u1" }));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
            nickname: null,
            avatar: null,
            gender: null,
            phone: null,
            membershipLevel: null,
            birthday: null,
            hasPassword: null,
        });
    });

    it("官网返回 has_password 时透传（密码已设置）", async () => {
        mocks.findUnique.mockResolvedValue(null);
        mocks.fetch.mockResolvedValue(jsonResponse(200, { sub: "u1", has_password: true }));
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.hasPassword).toBe(true);
    });
});

describe("PATCH /api/account/profile", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await PATCH(fakeReq({ nickname: "x" }));
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("空 body（无任何字段）返回 400", async () => {
        const res = await PATCH(fakeReq({}));
        expect(res.status).toBe(400);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("昵称超过 20 字符返回 400", async () => {
        const res = await PATCH(fakeReq({ nickname: "a".repeat(21) }));
        expect(res.status).toBe(400);
    });

    it("avatar 非 http(s) URL 返回 400", async () => {
        const res = await PATCH(fakeReq({ avatar: "ftp://evil/x.png" }));
        expect(res.status).toBe(400);
    });

    it("birthday 非法日期返回 400", async () => {
        const res = await PATCH(fakeReq({ birthday: "2023-02-30" }));
        expect(res.status).toBe(400);
    });

    it("成功透传官网响应并同步本地副本", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(200, {
            nickname: "新昵称",
            avatar: "https://nihplod.cn/uploads/b.png",
            gender: "male",
            birthday: "1995-06-01",
        }));

        const res = await PATCH(fakeReq({ nickname: "新昵称", gender: "male" }));
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
            nickname: "新昵称",
            avatar: "https://nihplod.cn/uploads/b.png",
            gender: "male",
            birthday: "1995-06-01",
        });

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/userinfo");
        expect(init.method).toBe("PATCH");
        expect(init.headers.Authorization).toBe("Bearer at-1");
        expect(JSON.parse(init.body)).toEqual({ nickname: "新昵称", gender: "male" });

        expect(mocks.upsertLocalUser).toHaveBeenCalledWith(
            { sub: "u1" },
            expect.objectContaining({ nickname: "新昵称", gender: "male" })
        );
    });

    it("当前 token 失效时先轮换再用新 token 调官网", async () => {
        mocks.verify.mockResolvedValue(null);
        mocks.refreshSessionFromCookie.mockResolvedValue({ sub: "u1" });
        mocks.getAccessToken
            .mockResolvedValueOnce("at-old")
            .mockResolvedValueOnce("at-new");
        mocks.fetch.mockResolvedValue(jsonResponse(200, { nickname: "n", avatar: null, gender: null, birthday: null }));

        const res = await PATCH(fakeReq({ nickname: "n" }));
        expect(res.status).toBe(200);
        expect(mocks.refreshSessionFromCookie).toHaveBeenCalled();
        expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer at-new");
    });

    it("官网 403 birthday_locked 透传 403 + 友好文案", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(403, { error: "birthday_locked" }));
        const res = await PATCH(fakeReq({ birthday: "1990-01-01" }));
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe("birthday_locked");
        expect(body.message).toContain("生日");
        expect(mocks.upsertLocalUser).not.toHaveBeenCalled();
    });

    it("官网 401 返回 401", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(401, { error: "unauthorized" }));
        const res = await PATCH(fakeReq({ nickname: "x" }));
        expect(res.status).toBe(401);
    });

    it("官网 5xx 返回 502", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(500, {}));
        const res = await PATCH(fakeReq({ nickname: "x" }));
        expect(res.status).toBe(502);
    });

    it("官网网络异常/超时返回 502", async () => {
        mocks.fetch.mockRejectedValue(new Error("fetch failed"));
        const res = await PATCH(fakeReq({ nickname: "x" }));
        expect(res.status).toBe(502);
    });
});
