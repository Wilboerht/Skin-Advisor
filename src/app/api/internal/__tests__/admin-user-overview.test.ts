import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    guard: vi.fn(),
    getOverview: vi.fn(),
    error: vi.fn(),
}));

vi.mock("@/lib/internal-guard", () => ({
    guardInternalUserRequest: mocks.guard,
}));

vi.mock("@/lib/admin-user-overview", () => ({
    getAdminUserOverview: mocks.getOverview,
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: mocks.error, warn: vi.fn(), info: vi.fn() },
}));

import { GET } from "../admin/user-overview/route";

function fakeReq(url: string): NextRequest {
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
    } as unknown as NextRequest;
}

const overview = {
    account: null,
    usage: {
        level: "REGULAR",
        totalUsed: 0,
        todayUsed: 0,
        quota: { lifetimeLimit: 10, dailyLimit: null, unlimited: false },
        remaining: 10,
        todayCheckedIn: false,
    },
    counts: { sessions: 0, completedSessions: 0, diaryEntries: 0 },
    recentSessions: [],
    recentDiary: [],
};

describe("GET /api/internal/admin/user-overview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.guard.mockResolvedValue({ userId: "user-1" });
        mocks.getOverview.mockResolvedValue(overview);
    });

    it("鉴权失败时直接返回 guard 响应", async () => {
        const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        mocks.guard.mockResolvedValue({ error: response });

        const res = await GET(fakeReq("http://localhost/api/internal/admin/user-overview?userId=user-1"));
        expect(res.status).toBe(401);
        expect(mocks.getOverview).not.toHaveBeenCalled();
    });

    it("透传合法会员覆盖参数", async () => {
        const res = await GET(
            fakeReq(
                "http://localhost/api/internal/admin/user-overview?userId=user-1&level=GOLD&totalSpent=6000"
            )
        );
        expect(res.status).toBe(200);
        expect(mocks.getOverview).toHaveBeenCalledWith("user-1", {
            level: "GOLD",
            totalSpent: 6000,
        });
        const body = await res.json();
        expect(body).toEqual({ success: true, data: overview });
    });

    it("非法会员等级/消费额被忽略", async () => {
        await GET(
            fakeReq(
                "http://localhost/api/internal/admin/user-overview?userId=user-1&level=ADVANCED&totalSpent=-3"
            )
        );
        expect(mocks.getOverview).toHaveBeenCalledWith("user-1", {
            level: undefined,
            totalSpent: undefined,
        });
    });

    it("聚合异常返回 500", async () => {
        mocks.getOverview.mockRejectedValue(new Error("db down"));
        const res = await GET(fakeReq("http://localhost/api/internal/admin/user-overview?userId=user-1"));
        expect(res.status).toBe(500);
        expect(mocks.error).toHaveBeenCalled();
    });
});
