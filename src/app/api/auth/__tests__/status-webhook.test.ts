import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const SECRET = "test-webhook-secret-at-least-32-chars";

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    update: vi.fn(),
    revokeAllLocalRefreshTokens: vi.fn(),
    rateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        user: { findUnique: mocks.findUnique, update: mocks.update },
    },
}));

vi.mock("@/lib/auth", () => ({
    revokeAllLocalRefreshTokens: mocks.revokeAllLocalRefreshTokens,
}));

vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: () => "127.0.0.1",
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from "../status-webhook/route";

function sign(body: string, timestamp: number, secret: string = SECRET): string {
    return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function makeRequest(body: unknown, options?: { sign?: boolean; secret?: string; timestamp?: number }): NextRequest {
    const rawBody = typeof body === "string" ? body : JSON.stringify(body);
    const headers = new Headers({ "content-type": "application/json" });
    if (options?.sign !== false) {
        const ts = options?.timestamp ?? Math.floor(Date.now() / 1000);
        headers.set("x-webhook-signature", `t=${ts},v1=${sign(rawBody, ts, options?.secret)}`);
    }
    return new NextRequest("https://advisor.test/api/auth/status-webhook", {
        method: "POST",
        headers,
        body: rawBody,
    });
}

function statusPayload(overrides: Record<string, unknown> = {}) {
    return {
        event: "account_status_change",
        sub: "user_1",
        old_status: "ACTIVE",
        new_status: "BANNED",
        source: "admin",
        timestamp: new Date().toISOString(),
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.SSO_WEBHOOK_SECRET = SECRET;
    mocks.rateLimit.mockResolvedValue({ success: true, remaining: 59, reset: 0, limit: 60 });
    mocks.revokeAllLocalRefreshTokens.mockResolvedValue(2);
});

afterEach(() => {
    delete process.env.SSO_WEBHOOK_SECRET;
});

describe("POST /api/auth/status-webhook", () => {
    it("验签失败（签名不符）返回 401", async () => {
        const res = await POST(makeRequest(statusPayload(), { secret: "wrong-secret-wrong-secret-00" }));
        expect(res.status).toBe(401);
        expect(mocks.findUnique).not.toHaveBeenCalled();
    });

    it("缺少签名头返回 401", async () => {
        const res = await POST(makeRequest(statusPayload(), { sign: false }));
        expect(res.status).toBe(401);
    });

    it("时间戳超出 5 分钟窗口返回 401", async () => {
        const staleTs = Math.floor(Date.now() / 1000) - 600;
        const res = await POST(makeRequest(statusPayload(), { timestamp: staleTs }));
        expect(res.status).toBe(401);
    });

    it("封号（BANNED）：role 置 disabled、存 previousRole、tokenVersion 递增、撤销 refresh token", async () => {
        mocks.findUnique.mockResolvedValue({ id: "user_1", role: "user", previousRole: null });
        mocks.update.mockResolvedValue({});

        const res = await POST(makeRequest(statusPayload({ new_status: "BANNED" })));
        expect(res.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: {
                role: "disabled",
                previousRole: "user",
                tokenVersion: { increment: 1 },
            },
        });
        expect(mocks.revokeAllLocalRefreshTokens).toHaveBeenCalledWith("user_1");
    });

    it("删除（deleted）按禁用处理", async () => {
        mocks.findUnique.mockResolvedValue({ id: "user_1", role: "user", previousRole: null });
        mocks.update.mockResolvedValue({});

        const res = await POST(makeRequest(statusPayload({ new_status: "deleted" })));
        expect(res.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ role: "disabled" }) })
        );
    });

    it("未知用户幂等返回 200，不写库", async () => {
        mocks.findUnique.mockResolvedValue(null);
        const res = await POST(makeRequest(statusPayload()));
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("解冻（ACTIVE）：优先恢复 previousRole 并清空", async () => {
        mocks.findUnique.mockResolvedValue({ id: "user_1", role: "disabled", previousRole: "user" });
        mocks.update.mockResolvedValue({});

        const res = await POST(makeRequest(statusPayload({ old_status: "BANNED", new_status: "ACTIVE" })));
        expect(res.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: { role: "user", previousRole: null },
        });
        expect(mocks.revokeAllLocalRefreshTokens).not.toHaveBeenCalled();
    });

    it("解冻时 previousRole 缺失回退为普通 user", async () => {
        mocks.findUnique.mockResolvedValue({ id: "user_1", role: "disabled", previousRole: null });
        mocks.update.mockResolvedValue({});

        const res = await POST(makeRequest(statusPayload({ new_status: "ACTIVE" })));
        expect(res.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: { role: "user", previousRole: null },
        });
    });

    it("已是禁用态时幂等成功（仍兜底撤销 refresh token），不重复写 role", async () => {
        mocks.findUnique.mockResolvedValue({ id: "user_1", role: "disabled", previousRole: "user" });

        const res = await POST(makeRequest(statusPayload({ new_status: "SUSPENDED" })));
        expect(res.status).toBe(200);
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.revokeAllLocalRefreshTokens).toHaveBeenCalledWith("user_1");
    });

    it("限流命中返回 429", async () => {
        mocks.rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: 0, limit: 60 });
        const res = await POST(makeRequest(statusPayload()));
        expect(res.status).toBe(429);
        expect(mocks.findUnique).not.toHaveBeenCalled();
    });
});
