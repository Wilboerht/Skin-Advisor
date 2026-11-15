import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(),
    rateLimit: vi.fn(),
    getClientIP: vi.fn(),
    mergeUserData: vi.fn(),
    logAdminAction: vi.fn(),
    isDisabledUser: vi.fn(),
    error: vi.fn(),
    prisma: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        mergeOperation: {
            findUnique: vi.fn(),
            create: vi.fn(),
            updateMany: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/lib/internal-api", () => ({
    authorizeInternalRequest: mocks.authorize,
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: mocks.rateLimit,
    getClientIP: mocks.getClientIP,
}));
vi.mock("@/lib/prisma", () => ({
    default: mocks.prisma,
}));
vi.mock("@/lib/user-merge", () => ({
    __internal: { mergeUserData: mocks.mergeUserData },
}));
vi.mock("@/lib/admin-auth", () => ({
    logAdminAction: mocks.logAdminAction,
}));
vi.mock("@/lib/permissions", () => ({
    isDisabledUser: mocks.isDisabledUser,
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: mocks.error, warn: vi.fn(), info: vi.fn() },
}));

import { POST } from "../user-data/merge/route";

const ENDPOINT = "http://localhost/api/internal/user-data/merge";

function fakeReq(query: string): NextRequest {
    const url = `${ENDPOINT}?${query}`;
    return {
        url,
        nextUrl: new URL(url),
        headers: new Headers(),
        text: async () => "",
    } as unknown as NextRequest;
}

function query(sourceUserId: string, targetUserId: string, operationId: string): string {
    return new URLSearchParams({
        sourceUserId,
        targetUserId,
        operationId,
        mode: "execute",
    }).toString();
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, mode: "signed" });
    mocks.rateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 });
    mocks.getClientIP.mockReturnValue("1.2.3.4");
    mocks.isDisabledUser.mockReturnValue(false);
    mocks.mergeUserData.mockResolvedValue(undefined);
    mocks.logAdminAction.mockResolvedValue(undefined);
    mocks.prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(
            where.id === "source"
                ? { id: "source", role: "USER" }
                : where.id === "target"
                    ? { id: "target" }
                    : null
        )
    );
    mocks.prisma.mergeOperation.findUnique.mockResolvedValue(null);
    mocks.prisma.mergeOperation.create.mockResolvedValue({});
    mocks.prisma.mergeOperation.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.mergeOperation.update.mockResolvedValue({});
    mocks.prisma.user.create.mockResolvedValue({});
});

describe("POST /api/internal/user-data/merge", () => {
    it("operationId 绑定其他账户对时拒绝执行", async () => {
        mocks.prisma.mergeOperation.findUnique.mockResolvedValue({
            operationId: "op-1",
            sourceUserId: "another-source",
            targetUserId: "target",
            status: "COMPLETED",
            updatedAt: new Date(),
            result: { merged: true },
        });

        const res = await POST(fakeReq(query("source", "target", "op-1")));

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("MERGE_OPERATION_CONFLICT");
        expect(mocks.mergeUserData).not.toHaveBeenCalled();
    });

    it("并发 execute 只有一个能抢占成功", async () => {
        mocks.prisma.mergeOperation.create.mockRejectedValue({ code: "P2002" });

        const res = await POST(fakeReq(query("source", "target", "op-2")));

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("MERGE_IN_PROGRESS");
        expect(mocks.mergeUserData).not.toHaveBeenCalled();
    });

    it("抢占成功后执行合并并标记完成", async () => {
        const res = await POST(fakeReq(query("source", "target", "op-3")));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ operationId: "op-3", merged: true });
        expect(mocks.mergeUserData).toHaveBeenCalledWith("source", "target");
        expect(mocks.prisma.mergeOperation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { operationId: "op-3" },
                data: expect.objectContaining({ status: "COMPLETED" }),
            })
        );
    });
});
