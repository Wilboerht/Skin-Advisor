/**
 * /api/advisor/kf-link：sessionId 必须通过 POST body / x-session-id 传给本路由，
 * 并由本路由通过 x-session-id 请求头传给 wecom-ai-bot；GET query 仅兼容旧调用方。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    rateLimit: vi.fn(),
    getClientIP: vi.fn(),
    findUnique: vi.fn(),
}));

vi.mock("@/lib/advisor-report-text", () => ({
    ADVISOR_WECOM_LINK: "https://work.weixin.qq.com/kf/static-kfid",
}));
vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: mocks.getSessionUser,
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: mocks.getClientIP,
}));
vi.mock("@/lib/prisma", () => ({
    default: {
        advisorSession: {
            findUnique: mocks.findUnique,
        },
    },
}));

import { GET, POST } from "../route";

function fakeReq(url: string): NextRequest {
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
    } as unknown as NextRequest;
}

const BASE = "http://localhost/api/advisor/kf-link?sessionId=sess-1234567890";

describe("GET /api/advisor/kf-link", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.WECOM_BOT_BASE_URL = "https://kf.example.com";
        process.env.INTERNAL_API_KEY = "test-internal-key";
        mocks.getClientIP.mockReturnValue("1.2.3.4");
        mocks.rateLimit.mockResolvedValue({ success: true });
        mocks.getSessionUser.mockResolvedValue({ id: "user-1" });
        mocks.findUnique.mockResolvedValue({ sessionId: "sess-1234567890" });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.WECOM_BOT_BASE_URL;
        delete process.env.INTERNAL_API_KEY;
    });

    it("把 sessionId 放在 x-session-id 请求头，query 不携带 session_id", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ url: "https://work.weixin.qq.com/kf/abc?scene_param=sess-1234567890" }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const res = await GET(fakeReq(BASE));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            url: "https://work.weixin.qq.com/kf/abc?scene_param=sess-1234567890",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://kf.example.com/api/kf-link");
        expect(url).not.toContain("session_id=");
        expect(init.headers).toMatchObject({
            "x-internal-key": "test-internal-key",
            "x-session-id": "sess-1234567890",
        });
    });

    it("sessionId 非法时返回静态链接且不请求上游", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await GET(fakeReq("http://localhost/api/advisor/kf-link?sessionId=bad"));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ fallback: true });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("上游失败时回退静态链接", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));

        const res = await GET(fakeReq(BASE));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ fallback: true });
    });
});

describe("POST /api/advisor/kf-link", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.WECOM_BOT_BASE_URL = "https://kf.example.com";
        process.env.INTERNAL_API_KEY = "test-internal-key";
        mocks.getClientIP.mockReturnValue("1.2.3.4");
        mocks.rateLimit.mockResolvedValue({ success: true });
        mocks.getSessionUser.mockResolvedValue({ id: "user-1" });
        mocks.findUnique.mockResolvedValue({ sessionId: "sess-1234567890" });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.WECOM_BOT_BASE_URL;
        delete process.env.INTERNAL_API_KEY;
    });

    it("从 JSON body 读取 sessionId，不带 query", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ url: "https://work.weixin.qq.com/kf/abc?scene_param=sess-1234567890" }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const req = {
            ...fakeReq("http://localhost/api/advisor/kf-link"),
            json: async () => ({ sessionId: "sess-1234567890" }),
        } as unknown as NextRequest;

        const res = await POST(req);
        expect(res.status).toBe(200);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://kf.example.com/api/kf-link");
        expect(init.headers).toMatchObject({ "x-session-id": "sess-1234567890" });
    });

    it("从 x-session-id 请求头读取 sessionId", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ url: "https://work.weixin.qq.com/kf/abc?scene_param=sess-1234567890" }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const req = {
            ...fakeReq("http://localhost/api/advisor/kf-link"),
            headers: new Headers({ "x-session-id": "sess-1234567890" }),
            json: async () => { throw new Error("empty"); },
        } as unknown as NextRequest;

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).toMatchObject({
            "x-session-id": "sess-1234567890",
        });
    });
});
