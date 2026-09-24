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

import { POST as uploadPOST } from "../spent-adjustments/upload/route";
import { GET as imageGET } from "../spent-adjustments/image/route";

function uploadReq(mime = "image/jpeg"): NextRequest {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "receipt.jpg", { type: mime }));
    return new Request("http://localhost/api/account/spent-adjustments/upload", {
        method: "POST",
        body: form,
    }) as unknown as NextRequest;
}

function imageReq(key = "spent-adjustments/a.webp"): NextRequest {
    const url = `http://localhost/api/account/spent-adjustments/image?key=${encodeURIComponent(key)}`;
    return new NextRequest(new URL(url));
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

describe("POST /api/account/spent-adjustments/upload", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await uploadPOST(uploadReq());
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("非图片类型前置拦截（不转发官网）", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-up-1", role: "user", tokenVersion: 0 });
        const res = await uploadPOST(uploadReq("text/plain"));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_FILE");
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("成功时以 Bearer + multipart 转发官网并透传响应", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-up-2", role: "user", tokenVersion: 0 });
        const payload = { success: true, data: { url: "spent-adjustments/x.webp", private: true } };
        mocks.fetch.mockResolvedValue(jsonResponse(200, payload));

        const res = await uploadPOST(uploadReq());
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual(payload);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/spent-adjustments/upload");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer at-1");
        expect(init.body).toBeInstanceOf(FormData);
    });

    it("官网 OAuth 错误归一化为契约结构", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-up-3", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(
            jsonResponse(403, { error: "insufficient_scope", error_description: "需要 membership scope" })
        );

        const res = await uploadPOST(uploadReq());
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("INSUFFICIENT_SCOPE");
    });
});

describe("GET /api/account/spent-adjustments/image", () => {
    it("未登录返回 401", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await imageGET(imageReq());
        expect(res.status).toBe(401);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("透传官网 302 签名地址", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-img-1", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(
            new Response(null, {
                status: 302,
                headers: { location: "https://bucket.oss-cn.aliyuncs.com/x.webp?Signature=abc" },
            })
        );

        const res = await imageGET(imageReq());
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe(
            "https://bucket.oss-cn.aliyuncs.com/x.webp?Signature=abc"
        );
        expect(res.headers.get("cache-control")).toBe("no-store");

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/oauth/spent-adjustments/image?key=");
        expect(init.headers.Authorization).toBe("Bearer at-1");
    });

    it("官网 404 按状态透传", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-img-2", role: "user", tokenVersion: 0 });
        mocks.fetch.mockResolvedValue(jsonResponse(404, { error: "NOT_FOUND", error_description: "图片不存在" }));

        const res = await imageGET(imageReq());
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe("NOT_FOUND");
    });

    it("缺少 key 返回 400", async () => {
        mocks.getSessionUser.mockResolvedValue({ id: "u-img-3", role: "user", tokenVersion: 0 });
        const res = await imageGET(
            new NextRequest(new URL("http://localhost/api/account/spent-adjustments/image"))
        );
        expect(res.status).toBe(400);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});
