import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    findUser: vi.fn(),
    findToken: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        $transaction: mocks.transaction,
        user: { findUnique: mocks.findUser },
        refreshToken: {
            findFirst: mocks.findToken,
            updateMany: mocks.updateMany,
            create: mocks.create,
        },
    },
}));

import { rotateLocalSession, signRefreshToken } from "./auth";

beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters-long";
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
        user: { findUnique: mocks.findUser },
        refreshToken: {
            findFirst: mocks.findToken,
            updateMany: mocks.updateMany,
            create: mocks.create,
        },
    }));
    mocks.findToken.mockResolvedValue({ id: "stored-token" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.create.mockResolvedValue({});
    mocks.findUser.mockResolvedValue({
        id: "user-1",
        email: null,
        phoneNumber: null,
        name: "User",
        avatarUrl: null,
        gender: null,
        role: "user",
        tokenVersion: 0,
        dailyTestLimit: 10,
        membershipLevel: null,
        totalSpent: 0,
    });
});

describe("rotateLocalSession", () => {
    it("在事务内消费旧令牌并保存新令牌", async () => {
        const token = await signRefreshToken({ sub: "user-1", tokenVersion: 0 });
        const rotated = await rotateLocalSession(token);
        expect(rotated).not.toBeNull();
        expect(mocks.updateMany).toHaveBeenCalledWith({
            where: { id: "stored-token", revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
        expect(mocks.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId: "user-1", token: expect.any(String) }),
        });
    });

    it("旧令牌已被消费时拒绝重放且不再签发", async () => {
        mocks.updateMany.mockResolvedValue({ count: 0 });
        const token = await signRefreshToken({ sub: "user-1", tokenVersion: 0 });
        await expect(rotateLocalSession(token)).resolves.toBeNull();
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findUser).not.toHaveBeenCalled();
    });
});
