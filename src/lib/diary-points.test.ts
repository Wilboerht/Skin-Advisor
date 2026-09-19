import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    createSignedInternalApiHeaders: vi.fn(),
    findMany: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
    createSignedInternalApiHeaders: mocks.createSignedInternalApiHeaders,
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: mocks.warn, error: mocks.error, info: mocks.info },
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        diaryEntry: { findMany: mocks.findMany },
    },
}));

vi.stubGlobal("fetch", mocks.fetch);

import { backfillRecentCheckinPoints, grantCheckinPoints } from "./diary-points";

function jsonResponse(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

const signedOk = { config: { project: "advisor", key: "k", secret: "s" }, headers: { "X-Internal-API-Key": "k" } };

const baseParams = { userId: "u1", dateStr: "2026-09-18", streak: 2, points: 2 };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSignedInternalApiHeaders.mockResolvedValue(signedOk);
    mocks.fetch.mockResolvedValue(
        jsonResponse(200, { success: true, data: { granted: 2, available: 12 } })
    );
});

describe("grantCheckinPoints", () => {
    it("首次尝试成功：返回 granted，且只调用一次", async () => {
        const result = await grantCheckinPoints(baseParams);
        expect(result).toEqual({ granted: 2, streak: 2 });
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(mocks.createSignedInternalApiHeaders).toHaveBeenCalledTimes(1);

        const [url, init] = mocks.fetch.mock.calls[0];
        expect(String(url)).toContain("/api/v1/internal/points/grant");
        expect(JSON.parse(String(init.body))).toMatchObject({
            userId: "u1",
            points: 2,
            reference: "checkin:u1:2026-09-18",
            note: "连续第 2 天",
        });
    });

    it("瞬时失败（500）自动重试，且每次重新签名（nonce 一次性）", async () => {
        mocks.fetch
            .mockResolvedValueOnce(jsonResponse(500, { success: false }))
            .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { granted: 2 } }));

        const result = await grantCheckinPoints(baseParams);
        expect(result).toEqual({ granted: 2, streak: 2 });
        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(mocks.createSignedInternalApiHeaders).toHaveBeenCalledTimes(2);
    });

    it("重复发放（duplicated）返回 granted 0", async () => {
        mocks.fetch.mockResolvedValue(
            jsonResponse(200, { success: true, data: { granted: 0, duplicated: true } })
        );
        const result = await grantCheckinPoints(baseParams);
        expect(result).toEqual({ granted: 0, streak: 2 });
    });

    it("客户端错误（400）不重试，直接降级", async () => {
        mocks.fetch.mockResolvedValue(jsonResponse(400, { success: false }));
        const result = await grantCheckinPoints(baseParams);
        expect(result).toBeNull();
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });

    it("网络异常重试后仍失败：返回 null（不阻断打卡）", async () => {
        mocks.fetch.mockRejectedValue(new Error("network down"));
        const result = await grantCheckinPoints(baseParams);
        expect(result).toBeNull();
        expect(mocks.fetch).toHaveBeenCalledTimes(2);
    });

    it("未配置内部密钥：跳过发放且只提示一次", async () => {
        mocks.createSignedInternalApiHeaders.mockResolvedValue(null);
        const first = await grantCheckinPoints(baseParams);
        const second = await grantCheckinPoints(baseParams);
        expect(first).toBeNull();
        expect(second).toBeNull();
        expect(mocks.fetch).not.toHaveBeenCalled();
        const warned = mocks.warn.mock.calls.filter((c) => String(c[0]).includes("未配置 INTERNAL_API_KEYS"));
        expect(warned).toHaveLength(1);
    });

    it("points<=0 不作任何请求", async () => {
        const result = await grantCheckinPoints({ ...baseParams, streak: 0, points: 0 });
        expect(result).toBeNull();
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});

describe("backfillRecentCheckinPoints（漏发自愈）", () => {
    const now = new Date();
    const day = (n: number) =>
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    it("仅对手动打卡日按幂等键补发，跳过自动条目与当前刚处理的日期", async () => {
        // 近窗手动：昨天（连续：昨天+前天）；自动条目：前天；全量：今天、昨天、前天
        mocks.findMany
            .mockResolvedValueOnce([
                { date: day(1), note: null },
                { date: day(2), note: "在线测肤：综合评分 80" },
            ])
            .mockResolvedValueOnce([{ date: day(0) }, { date: day(1) }, { date: day(2) }]);

        await backfillRecentCheckinPoints("u1", iso(day(0)));

        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        const [, init] = mocks.fetch.mock.calls[0];
        expect(JSON.parse(String(init.body))).toEqual({
            userId: "u1",
            points: 2, // 昨天+前天连续第 2 天
            reference: `checkin:u1:${iso(day(1))}`,
            note: "连续第 2 天",
        });
    });

    it("窗口内无手动打卡时不发任何请求", async () => {
        mocks.findMany
            .mockResolvedValueOnce([{ date: day(1), note: "在线测肤：综合评分 80" }])
            .mockResolvedValueOnce([{ date: day(1) }]);

        await backfillRecentCheckinPoints("u1", iso(day(0)));
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});
