import { describe, it, expect, vi, beforeEach } from "vitest";

// usage-limit.ts 顶层引入 sso-auth（→ sso-sdk → next/server ESM 在 vitest 下解析失败），
// 本测试通过 mock 隔离重依赖；getMemberQuota 为纯函数，getSkinTestUsageSummary 用 Prisma mock。
const prismaMock = vi.hoisted(() => ({
    user: { findUnique: vi.fn() },
    testRecord: { count: vi.fn(), deleteMany: vi.fn() },
    diaryEntry: { findUnique: vi.fn() },
    $transaction: vi.fn(),
}));

vi.mock("@/lib/sso-auth", () => ({
    getSessionUser: vi.fn(),
    isSubsiteAccountDisabled: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { getMemberQuota, getSkinTestUsageSummary, rollbackUsage } from "./usage-limit";

beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.testRecord.count.mockResolvedValue(0);
    prismaMock.testRecord.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.diaryEntry.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
});

describe("getMemberQuota", () => {
    it("普通会员默认：终身 10 次、无每日上限", () => {
        const q = getMemberQuota({ membershipLevel: null, dailyTestLimit: 10, totalSpent: 0 });
        expect(q).toMatchObject({ level: "REGULAR", dailyLimit: null, lifetimeLimit: 10, unlimited: false });
    });

    it("管理员自定义（普通会员）：每日按设定值，且解除终身限制", () => {
        // 2026-10 生产 bug：终身 10 次曾静默架空管理员调整
        const q = getMemberQuota({ membershipLevel: "REGULAR", dailyTestLimit: 50, totalSpent: 0 });
        expect(q).toMatchObject({ level: "REGULAR", dailyLimit: 50, lifetimeLimit: null });
    });

    it("管理员自定义（银卡）：覆盖每日 10 次并解除终身池", () => {
        const q = getMemberQuota({ membershipLevel: "SILVER", dailyTestLimit: 3, totalSpent: 5000 });
        expect(q).toMatchObject({ level: "SILVER", dailyLimit: 3, lifetimeLimit: null });
    });

    it("管理员显式设 10 视为未自定义（schema 默认值的哨兵语义）", () => {
        const q = getMemberQuota({ membershipLevel: "REGULAR", dailyTestLimit: 10, totalSpent: 0 });
        expect(q.lifetimeLimit).toBe(10);
        expect(q.dailyLimit).toBeNull();
    });

    it("金卡无管理员覆盖：每日 10 次、总量不限", () => {
        const q = getMemberQuota({ membershipLevel: "GOLD", dailyTestLimit: 10, totalSpent: 0 });
        expect(q).toMatchObject({ dailyLimit: 10, lifetimeLimit: null, unlimited: true });
    });

    it("银卡无覆盖：终身池 = 10 + 20×⌊消费/1000⌋，每日 10 次", () => {
        const q = getMemberQuota({ membershipLevel: "SILVER", dailyTestLimit: 10, totalSpent: 2500 });
        expect(q).toMatchObject({ dailyLimit: 10, lifetimeLimit: 50, unlimited: false });
    });
});

describe("getSkinTestUsageSummary 会员覆盖", () => {
    it("子站无本地用户 + 主站 GOLD/6000 → 按 GOLD 配额返回", async () => {
        const summary = await getSkinTestUsageSummary("user_gold", {
            level: "GOLD",
            totalSpent: 6000,
        });

        expect(summary).toMatchObject({
            level: "GOLD",
            totalUsed: 0,
            todayUsed: 0,
            quota: { lifetimeLimit: null, dailyLimit: 10, unlimited: true },
            remaining: null,
            todayCheckedIn: false,
        });
    });

    it("本地 REGULAR + 主站 SILVER/2500 → 按 SILVER 终身池 50 次", async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            membershipLevel: "REGULAR",
            totalSpent: 0,
            dailyTestLimit: 10,
        });
        prismaMock.testRecord.count
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(2);

        const summary = await getSkinTestUsageSummary("user_silver", {
            level: "SILVER",
            totalSpent: 2500,
        });

        expect(summary).toMatchObject({
            level: "SILVER",
            totalUsed: 12,
            todayUsed: 2,
            quota: { lifetimeLimit: 50, dailyLimit: 10, unlimited: false },
            remaining: 38,
        });
    });

    it("无 override 且子站无用户 → 保持 level null + REGULAR 配额", async () => {
        const summary = await getSkinTestUsageSummary("user_never_used");

        expect(summary).toMatchObject({
            level: null,
            quota: { lifetimeLimit: 10, dailyLimit: null, unlimited: false },
            remaining: 10,
        });
    });
});

describe("rollbackUsage 归属用户", () => {
    it("传入预占 userId 时不依赖 getSessionUser，会话过期也能回滚", async () => {
        const ok = await rollbackUsage(null as never, "sess-1", "user-1");

        expect(ok).toBe(true);
        expect(prismaMock.testRecord.deleteMany).toHaveBeenCalledWith({
            where: { sessionId: "sess-1", userId: "user-1" },
        });
    });
});
