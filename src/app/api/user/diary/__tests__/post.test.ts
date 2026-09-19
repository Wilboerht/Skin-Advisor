import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    rateLimit: vi.fn(),
    getClientIP: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
    grantCheckinPoints: vi.fn(),
    backfillRecentCheckinPoints: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: mocks.rateLimit, getClientIP: mocks.getClientIP }));
vi.mock("@/lib/logger", () => ({
    logger: { warn: mocks.warn, error: mocks.error, info: mocks.info },
}));
vi.mock("@/lib/prisma", () => ({
    default: {
        diaryEntry: {
            findUnique: mocks.findUnique,
            upsert: mocks.upsert,
            findMany: mocks.findMany,
        },
    },
}));
vi.mock("@/lib/diary-points", () => ({
    grantCheckinPoints: mocks.grantCheckinPoints,
    backfillRecentCheckinPoints: mocks.backfillRecentCheckinPoints,
}));

import { POST } from "../route";

// 固定"今天"为当前 UTC 日历日：与路由的日期写入窗口校验一致
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const dateStr = today.toISOString().slice(0, 10);
const daysBefore = (n: number) =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - n));

function fakePostReq(body: unknown): NextRequest {
    return {
        url: "http://localhost/api/user/diary",
        headers: new Headers(),
        json: async () => body,
    } as unknown as NextRequest;
}

const validBody = { date: dateStr, skinState: "good", tags: ["熬夜"], note: "状态不错" };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "u1", role: "user", tokenVersion: 0 });
    mocks.rateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 });
    mocks.getClientIP.mockReturnValue("1.2.3.4");
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({ id: "e1", date: today, skinState: "good", tags: [], note: null });
    mocks.findMany.mockResolvedValue([]);
    mocks.grantCheckinPoints.mockResolvedValue({ granted: 3, streak: 3 });
    mocks.backfillRecentCheckinPoints.mockResolvedValue(undefined);
});

describe("POST /api/user/diary（打卡积分判定）", () => {
    it("未登录返回 401，不写库不发放", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const res = await POST(fakePostReq(validBody));
        expect(res.status).toBe(401);
        expect(mocks.upsert).not.toHaveBeenCalled();
        expect(mocks.grantCheckinPoints).not.toHaveBeenCalled();
    });

    it("首次手动打卡：按连续天数发放并随响应返回 points，同时触发自愈补发", async () => {
        // 昨天/前天都有条目 → 连续第 3 天 → +3
        mocks.findMany.mockImplementation(async (args: { where?: { date?: { in?: Date[] } } }) =>
            args?.where?.date?.in
                ? [{ date: daysBefore(1) }, { date: daysBefore(2) }]
                : [{ date: today }, { date: daysBefore(1) }, { date: daysBefore(2) }]
        );

        const res = await POST(fakePostReq(validBody));
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({ success: true, points: { granted: 3, streak: 3 } });

        expect(mocks.grantCheckinPoints).toHaveBeenCalledWith({
            userId: "u1",
            dateStr,
            streak: 3,
            points: 3,
        });
        expect(mocks.backfillRecentCheckinPoints).toHaveBeenCalledWith("u1", dateStr);
    });

    it("编辑已有手动记录：不重复发放（仍触发自愈补发）", async () => {
        mocks.findUnique.mockResolvedValue({ note: "之前的手动记录", tags: ["熬夜"] });

        const res = await POST(fakePostReq(validBody));
        expect(res.status).toBe(200);
        const json = (await res.json()) as Record<string, unknown>;
        expect(json.points).toBeUndefined();
        expect(mocks.grantCheckinPoints).not.toHaveBeenCalled();
        expect(mocks.backfillRecentCheckinPoints).toHaveBeenCalledWith("u1", dateStr);
    });

    it("接管测肤自动条目：视为首次手动打卡并发放", async () => {
        mocks.findUnique.mockResolvedValue({ note: "在线测肤：综合评分 80", tags: [] });

        const res = await POST(fakePostReq(validBody));
        expect(res.status).toBe(200);
        expect(mocks.grantCheckinPoints).toHaveBeenCalledTimes(1);
    });

    it("发放失败（官网不可达）：打卡仍成功，响应不含 points", async () => {
        mocks.grantCheckinPoints.mockResolvedValue(null);

        const res = await POST(fakePostReq(validBody));
        expect(res.status).toBe(200);
        const json = (await res.json()) as Record<string, unknown>;
        expect(json.success).toBe(true);
        expect(json.points).toBeUndefined();
    });

    it("非法肌肤状态返回 400，不触发发放", async () => {
        const res = await POST(fakePostReq({ ...validBody, skinState: "unknown" }));
        expect(res.status).toBe(400);
        expect(mocks.grantCheckinPoints).not.toHaveBeenCalled();
    });
});
