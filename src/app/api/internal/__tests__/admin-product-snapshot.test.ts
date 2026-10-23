import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(),
    rateLimit: vi.fn(),
    getClientIP: vi.fn(),
    findMany: vi.fn(),
    error: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
    authorizeInternalRequest: mocks.authorize,
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: mocks.getClientIP,
}));
vi.mock("@/lib/prisma", () => ({
    default: { product: { findMany: mocks.findMany } },
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: mocks.error, warn: vi.fn(), info: vi.fn() },
}));

import { GET } from "../admin/product-snapshot/route";

const ENDPOINT_URL = "http://localhost/api/internal/admin/product-snapshot";

function fakeReq(url = ENDPOINT_URL): NextRequest {
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
    } as unknown as NextRequest;
}

describe("GET /api/internal/admin/product-snapshot", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authorize.mockResolvedValue({ ok: true, mode: "signed" });
        mocks.rateLimit.mockResolvedValue({
            success: true,
            limit: 30,
            remaining: 29,
            reset: Date.now() + 60_000,
        });
        mocks.getClientIP.mockReturnValue("1.2.3.4");
        mocks.findMany.mockResolvedValue([]);
    });

    it("鉴权失败返回 401", async () => {
        mocks.authorize.mockResolvedValue({
            ok: false,
            mode: "signed",
            reason: "signature_mismatch",
            status: 401,
        });
        const res = await GET(fakeReq());
        expect(res.status).toBe(401);
        expect(mocks.findMany).not.toHaveBeenCalled();
    });

    it("限流触发返回 429", async () => {
        mocks.rateLimit.mockResolvedValue({
            success: false,
            limit: 30,
            remaining: 0,
            reset: Date.now(),
        });
        const res = await GET(fakeReq());
        expect(res.status).toBe(429);
    });

    it("成功返回产品快照并序列化时间", async () => {
        mocks.findMany.mockResolvedValue([
            {
                id: "p1",
                name: "测试产品",
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
        ]);
        const res = await GET(fakeReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.products[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
        expect(body.data.truncated).toBe(false);
    });

    it("查询失败返回 500", async () => {
        mocks.findMany.mockRejectedValue(new Error("db down"));
        const res = await GET(fakeReq());
        expect(res.status).toBe(500);
        expect(mocks.error).toHaveBeenCalled();
    });
});
