import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(),
    rateLimit: vi.fn(),
    getClientIP: vi.fn(),
    sync: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
    authorizeInternalRequest: mocks.authorize,
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: mocks.getClientIP,
}));
vi.mock("@/lib/product-sync", () => ({
    syncProductsFromMain: mocks.sync,
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: mocks.error, warn: mocks.warn, info: vi.fn() },
}));

import { POST } from "../admin/products/sync/route";

const ENDPOINT_URL = "http://localhost/api/internal/admin/products/sync";

function fakeReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return {
        url: ENDPOINT_URL,
        nextUrl: new URL(ENDPOINT_URL),
        headers: new Headers(headers),
        text: async () => text,
    } as unknown as NextRequest;
}

const VALID_BODY = {
    schemaVersion: 1,
    generatedAt: "2026-10-27T00:00:00.000Z",
    products: [],
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, mode: "signed" });
    mocks.rateLimit.mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
    });
    mocks.getClientIP.mockReturnValue("1.2.3.4");
    mocks.sync.mockResolvedValue({
        ok: true,
        data: {
            generatedAt: "2026-10-27T00:00:00.000Z",
            trigger: "test",
            dryRun: false,
            skipped: false,
            created: 0,
            updated: 0,
            bound: 0,
            deactivated: 0,
            missing: 0,
            skippedProducts: 0,
            changes: [],
            warnings: [],
            durationMs: 1,
        },
    });
});

describe("POST /api/internal/admin/products/sync", () => {
    it("鉴权失败返回 401", async () => {
        mocks.authorize.mockResolvedValue({
            ok: false,
            mode: "signed",
            reason: "signature_mismatch",
            status: 401,
        });
        const res = await POST(fakeReq(VALID_BODY));
        expect(res.status).toBe(401);
        expect(mocks.sync).not.toHaveBeenCalled();
    });

    it("拒绝旧版 Bearer", async () => {
        mocks.authorize.mockResolvedValue({ ok: true, mode: "legacy" });
        const res = await POST(fakeReq(VALID_BODY));
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error.code).toBe("SIGNED_REQUEST_REQUIRED");
        expect(mocks.sync).not.toHaveBeenCalled();
    });

    it("限流触发返回 429", async () => {
        mocks.rateLimit.mockResolvedValue({
            success: false,
            limit: 10,
            remaining: 0,
            reset: Date.now(),
        });
        const res = await POST(fakeReq(VALID_BODY));
        expect(res.status).toBe(429);
        expect(mocks.sync).not.toHaveBeenCalled();
    });

    it("非法 JSON 返回 400", async () => {
        const res = await POST(fakeReq("{not-json"));
        expect(res.status).toBe(400);
        expect(mocks.sync).not.toHaveBeenCalled();
    });

    it("成功返回同步统计", async () => {
        const res = await POST(fakeReq(VALID_BODY));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(mocks.sync).toHaveBeenCalledWith(VALID_BODY);
    });

    it("同步失败按状态码返回", async () => {
        mocks.sync.mockResolvedValue({
            ok: false,
            code: "SYNC_IN_PROGRESS",
            message: "busy",
            status: 409,
        });
        const res = await POST(fakeReq(VALID_BODY));
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("SYNC_IN_PROGRESS");
    });

    it("请求体超限返回 413", async () => {
        const huge = "x".repeat(2 * 1024 * 1024 + 1);
        const res = await POST(fakeReq(huge));
        expect(res.status).toBe(413);
        expect(mocks.authorize).not.toHaveBeenCalled();
    });
});
