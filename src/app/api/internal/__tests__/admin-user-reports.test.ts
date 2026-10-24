import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    guard: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
}));

vi.mock("@/lib/internal-guard", () => ({
    guardInternalUserRequest: mocks.guard,
}));
vi.mock("@/lib/admin-user-reports", () => ({
    listAdminUserReports: mocks.list,
    getAdminUserReportDetail: mocks.detail,
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { GET as listReports } from "../admin/user-reports/route";
import { GET as getReport } from "../admin/user-report/route";

function req(url: string): NextRequest {
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
    } as unknown as NextRequest;
}

describe("internal admin user reports routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.guard.mockResolvedValue({ userId: "user-1" });
    });

    it("列表返回摘要和分页", async () => {
        mocks.list.mockResolvedValue({
            reports: [{ sessionId: "s1" }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
        const res = await listReports(
            req("http://localhost/api/internal/admin/user-reports?userId=user-1&page=1&limit=10")
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.reports).toHaveLength(1);
        expect(mocks.list).toHaveBeenCalledWith("user-1", { page: 1, limit: 10 });
    });

    it("非法 sessionId 返回 400", async () => {
        const res = await getReport(
            req("http://localhost/api/internal/admin/user-report?userId=user-1&sessionId=bad")
        );
        expect(res.status).toBe(400);
        expect(mocks.detail).not.toHaveBeenCalled();
    });

    it("报告不存在返回 404", async () => {
        mocks.detail.mockResolvedValue(null);
        const res = await getReport(
            req(
                "http://localhost/api/internal/admin/user-report?userId=user-1&sessionId=session-1"
            )
        );
        expect(res.status).toBe(404);
    });

    it("详情成功返回结构化数据", async () => {
        mocks.detail.mockResolvedValue({ sessionId: "session-1", summary: {} });
        const res = await getReport(
            req(
                "http://localhost/api/internal/admin/user-report?userId=user-1&sessionId=session-1"
            )
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.sessionId).toBe("session-1");
    });

    it("guard 失败直接返回", async () => {
        mocks.guard.mockResolvedValue({
            error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
        const res = await listReports(
            req("http://localhost/api/internal/admin/user-reports?userId=user-1")
        );
        expect(res.status).toBe(401);
    });
});
