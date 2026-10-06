import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    signOfficialResponseBody,
    verifyOfficialResponseSignature,
    parseOfficialResponse,
    getOfficialSignatureHeaderName,
    callOfficialApi,
} from "./official-api";

describe("official-api signature", () => {
    const secret = "a-very-secret-key-for-testing-official-api-32";

    beforeEach(() => {
        delete process.env.OFFICIAL_API_SECRET;
    });

    it("signs and verifies a response body", () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true, data: { user: { id: "u1" } } });
        const sig = signOfficialResponseBody(body);
        expect(sig).not.toBeNull();
        expect(verifyOfficialResponseSignature(body, sig)).toBe(true);
    });

    it("rejects a tampered body", () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true });
        const sig = signOfficialResponseBody(body);
        expect(verifyOfficialResponseSignature(body + "x", sig)).toBe(false);
    });

    it("rejects missing signature when secret is configured", () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true });
        expect(verifyOfficialResponseSignature(body, null)).toBe(false);
        expect(verifyOfficialResponseSignature(body, undefined)).toBe(false);
    });

    it("skips verification when secret is not configured", () => {
        const body = JSON.stringify({ success: true });
        expect(verifyOfficialResponseSignature(body, null)).toBe(true);
        expect(verifyOfficialResponseSignature(body, "invalid")).toBe(true);
    });

    it("parses and verifies official JSON response", async () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true, data: { user: { id: "u1" } } });
        const sig = signOfficialResponseBody(body);
        const response = new Response(body, {
            headers: {
                "content-type": "application/json",
                [getOfficialSignatureHeaderName()]: sig!,
            },
        });

        const parsed = await parseOfficialResponse(response);
        expect(parsed).not.toBeNull();
        expect(parsed?.data).toEqual({ success: true, data: { user: { id: "u1" } } });
    });

    it("returns null for invalid signature", async () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true });
        const response = new Response(body, {
            headers: {
                "content-type": "application/json",
                [getOfficialSignatureHeaderName()]: "deadbeef",
            },
        });

        const parsed = await parseOfficialResponse(response);
        expect(parsed).toBeNull();
    });
});


describe("callOfficialApi 子站代理头与 CSRF Cookie 去重", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        process.env.OFFICIAL_API_URL = "https://official.example";
        delete process.env.SUBSITE_PROXY_KEY;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.OFFICIAL_API_URL;
        delete process.env.SUBSITE_PROXY_KEY;
    });

    /** 第 1 次 fetch 返回官网 CSRF token，第 2 次返回业务响应 */
    function mockOfficialSuccess() {
        fetchMock
            .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { token: "official-token" } }), {
                status: 200,
                headers: {
                    "content-type": "application/json",
                    "set-cookie": "__Host-csrf_token=official-cookie-value; Path=/; HttpOnly; Secure",
                },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { expiresIn: 300 } }), {
                status: 200,
                headers: { "content-type": "application/json" },
            }));
    }

    /** 取第 2 次 fetch（实际业务调用）的请求头 */
    function businessCallHeaders(): Headers {
        const init = fetchMock.mock.calls[1][1] as RequestInit;
        return new Headers(init.headers);
    }

    it("配置 SUBSITE_PROXY_KEY 且传入 clientIp 时发送 X-Forwarded-For 与 X-Subsite-Proxy-Key", async () => {
        process.env.SUBSITE_PROXY_KEY = "test-proxy-key";
        mockOfficialSuccess();

        const result = await callOfficialApi({
            method: "POST",
            path: "/api/auth/send-code",
            body: { phone: "13800000000", type: "login" },
            requireSignature: false,
            clientIp: "203.0.113.10",
        });

        expect(result).not.toBeNull();
        const headers = businessCallHeaders();
        expect(headers.get("X-Forwarded-For")).toBe("203.0.113.10");
        expect(headers.get("X-Subsite-Proxy-Key")).toBe("test-proxy-key");
    });

    it("未配置 SUBSITE_PROXY_KEY 时两个头都不发送", async () => {
        mockOfficialSuccess();

        const result = await callOfficialApi({
            method: "POST",
            path: "/api/auth/send-code",
            body: { phone: "13800000000", type: "login" },
            requireSignature: false,
            clientIp: "203.0.113.10",
        });

        expect(result).not.toBeNull();
        const headers = businessCallHeaders();
        expect(headers.get("X-Forwarded-For")).toBeNull();
        expect(headers.get("X-Subsite-Proxy-Key")).toBeNull();
    });

    it("未传入 clientIp 时即使配置了密钥也不发送（其他出站调用不带密钥）", async () => {
        process.env.SUBSITE_PROXY_KEY = "test-proxy-key";
        mockOfficialSuccess();

        const result = await callOfficialApi({
            method: "POST",
            path: "/api/auth/reset-password",
            body: { phone: "13800000000" },
            requireSignature: false,
        });

        expect(result).not.toBeNull();
        const headers = businessCallHeaders();
        expect(headers.get("X-Forwarded-For")).toBeNull();
        expect(headers.get("X-Subsite-Proxy-Key")).toBeNull();
    });

    it("转发 Cookie 时过滤掉入站自带的 __Host-csrf_token，只保留官网新签发的 token", async () => {
        process.env.SUBSITE_PROXY_KEY = "test-proxy-key";
        mockOfficialSuccess();

        const result = await callOfficialApi({
            method: "POST",
            path: "/api/auth/send-code",
            body: { phone: "13800000000", type: "login" },
            cookies: "__Host-auth_token=abc; __Host-csrf_token=local-csrf; user_token=u1",
            requireSignature: false,
            clientIp: "203.0.113.10",
        });

        expect(result).not.toBeNull();
        const cookie = businessCallHeaders().get("Cookie") || "";
        expect(cookie).toContain("__Host-csrf_token=official-cookie-value");
        expect(cookie).toContain("__Host-auth_token=abc");
        expect(cookie).toContain("user_token=u1");
        expect(cookie).not.toContain("local-csrf");
        // __Host-csrf_token 只能出现一次（官网新签发的值）
        expect(cookie.match(/__Host-csrf_token=/g)).toHaveLength(1);
    });
});
