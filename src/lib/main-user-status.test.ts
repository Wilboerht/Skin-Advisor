import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    sign: vi.fn(),
    fetch: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
    createSignedInternalApiHeaders: (...args: unknown[]) => mocks.sign(...args),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        warn: (...args: unknown[]) => mocks.warn(...args),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    __resetMainUserStatusCacheForTests,
    fetchMainUserStatus,
    isMainUserActive,
} from "./main-user-status";

function jsonResponse(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    };
}

describe("main user status", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetMainUserStatusCacheForTests();
        mocks.sign.mockResolvedValue({
            headers: { "Content-Type": "application/json" },
        });
        vi.stubGlobal("fetch", mocks.fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("ACTIVE → true", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(200, { success: true, data: { status: "ACTIVE" } })
        );

        await expect(isMainUserActive("user-1")).resolves.toBe(true);
        expect(mocks.sign).toHaveBeenCalledWith(
            "advisor",
            "POST",
            "/api/v1/internal/user/status",
            JSON.stringify({ userId: "user-1" })
        );
    });

    it("BANNED / DELETED / NOT_FOUND → false", async () => {
        for (const status of ["BANNED", "DELETED", "NOT_FOUND"]) {
            __resetMainUserStatusCacheForTests();
            mocks.fetch.mockResolvedValue(
                jsonResponse(200, { success: true, data: { status } })
            );
            await expect(isMainUserActive("user-1")).resolves.toBe(false);
        }
    });

    it("主站不可达 → fail-open（true）并缓存失败 30 秒", async () => {
        mocks.fetch.mockRejectedValue(new Error("network down"));

        await expect(isMainUserActive("user-1")).resolves.toBe(true);
        await expect(isMainUserActive("user-1")).resolves.toBe(true);

        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(mocks.warn).toHaveBeenCalled();
    });

    it("ACTIVE 结果缓存 60 秒，重复请求不再回源", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(200, { success: true, data: { status: "ACTIVE" } })
        );

        await fetchMainUserStatus("user-1");
        await fetchMainUserStatus("user-1");

        expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });

    it("未配置内部 API 密钥 → fail-open，不调用 fetch", async () => {
        mocks.sign.mockResolvedValue(null);

        await expect(isMainUserActive("user-1")).resolves.toBe(true);
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});
