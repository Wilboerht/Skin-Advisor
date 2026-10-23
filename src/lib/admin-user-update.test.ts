import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    userFindUnique: vi.fn(),
    userUpdate: vi.fn(),
    refreshUpdateMany: vi.fn(),
    shadowFindUnique: vi.fn(),
    logAdminAction: vi.fn(),
    getClientInfo: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        $transaction: mocks.transaction,
        adminUser: { findUnique: mocks.shadowFindUnique },
    },
}));

vi.mock("@/lib/admin-auth", () => ({
    logAdminAction: mocks.logAdminAction,
    getClientInfo: mocks.getClientInfo,
}));

import { updateAdminUser } from "./admin-user-update";

const request = {
    headers: new Headers({ "user-agent": "test-agent" }),
} as unknown as NextRequest;

const baseUser = {
    id: "user-1",
    role: "user",
    previousRole: null,
    dailyTestLimit: 10,
};

function setupTransaction() {
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({
            user: {
                findUnique: mocks.userFindUnique,
                update: mocks.userUpdate,
            },
            refreshToken: { updateMany: mocks.refreshUpdateMany },
        })
    );
}

describe("updateAdminUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupTransaction();
        mocks.userFindUnique.mockResolvedValue(baseUser);
        mocks.userUpdate.mockResolvedValue({ role: "user", dailyTestLimit: 10 });
        mocks.refreshUpdateMany.mockResolvedValue({ count: 0 });
        mocks.shadowFindUnique.mockResolvedValue({ id: "shadow-1" });
        mocks.getClientInfo.mockReturnValue({ ip: "1.2.3.4", userAgent: "test-agent" });
        mocks.logAdminAction.mockResolvedValue(undefined);
    });

    it("用户不存在时返回 found=false 且不写审计", async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        const result = await updateAdminUser({
            userId: "user-1",
            patch: { dailyTestLimit: 20 },
            operator: { id: "admin-1" },
            request,
        });
        expect(result).toEqual({ found: false });
        expect(mocks.logAdminAction).not.toHaveBeenCalled();
    });

    it("禁用用户：保存 previousRole、递增 tokenVersion、撤销 refresh token", async () => {
        mocks.userUpdate.mockResolvedValue({ role: "disabled", dailyTestLimit: 10 });
        mocks.refreshUpdateMany.mockResolvedValue({ count: 2 });

        const result = await updateAdminUser({
            userId: "user-1",
            patch: { role: "disabled" },
            operator: { id: "admin-1", email: "admin@test.com", name: "Admin" },
            mainAuditId: "audit-main-1",
            request,
        });

        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user-1" },
                data: expect.objectContaining({
                    role: "disabled",
                    previousRole: "user",
                    tokenVersion: { increment: 1 },
                }),
            })
        );
        expect(mocks.refreshUpdateMany).toHaveBeenCalledWith({
            where: { userId: "user-1", revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
        expect(result).toEqual({
            found: true,
            changed: true,
            previous: { role: "user", dailyTestLimit: 10 },
            current: { role: "disabled", dailyTestLimit: 10 },
            revokedRefreshTokens: 2,
        });
        expect(mocks.logAdminAction).toHaveBeenCalledWith(
            expect.objectContaining({
                adminId: "shadow-1",
                action: "update",
                resource: "User",
                resourceId: "user-1",
                details: expect.objectContaining({
                    source: "main-console",
                    mainAuditId: "audit-main-1",
                    previous: { role: "user", dailyTestLimit: 10 },
                    current: { role: "disabled", dailyTestLimit: 10 },
                }),
            })
        );
    });

    it("启用用户：优先恢复 previousRole", async () => {
        mocks.userFindUnique.mockResolvedValue({
            ...baseUser,
            role: "disabled",
            previousRole: "user",
        });
        mocks.userUpdate.mockResolvedValue({ role: "user", dailyTestLimit: 10 });

        const result = await updateAdminUser({
            userId: "user-1",
            patch: { role: "user" },
            operator: { id: "admin-1" },
            request,
        });

        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    role: "user",
                    previousRole: null,
                    tokenVersion: { increment: 1 },
                }),
            })
        );
        expect(result.found && result.current.role).toBe("user");
    });

    it("启用用户：previousRole 非法时回退普通用户", async () => {
        mocks.userFindUnique.mockResolvedValue({
            ...baseUser,
            role: "disabled",
            previousRole: "disabled",
        });
        mocks.userUpdate.mockResolvedValue({ role: "user", dailyTestLimit: 10 });

        await updateAdminUser({
            userId: "user-1",
            patch: { role: "user" },
            operator: { id: "admin-1" },
            request,
        });

        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ role: "user" }),
            })
        );
    });

    it("仅修改每日上限时不撤销 refresh token", async () => {
        mocks.userUpdate.mockResolvedValue({ role: "user", dailyTestLimit: 20 });

        const result = await updateAdminUser({
            userId: "user-1",
            patch: { dailyTestLimit: 20 },
            operator: { id: "admin-1" },
            request,
        });

        expect(mocks.refreshUpdateMany).not.toHaveBeenCalled();
        expect(result.found && result.changed).toBe(true);
        expect(result.found && result.current.dailyTestLimit).toBe(20);
    });

    it("字段未变化时不执行 update", async () => {
        const result = await updateAdminUser({
            userId: "user-1",
            patch: { dailyTestLimit: 10, role: "user" },
            operator: { id: "admin-1" },
            request,
        });

        expect(mocks.userUpdate).not.toHaveBeenCalled();
        expect(result.found && result.changed).toBe(false);
    });
});
