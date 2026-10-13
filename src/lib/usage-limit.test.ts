import { describe, it, expect, vi } from "vitest";

// usage-limit.ts 顶层引入 sso-auth（→ sso-sdk → next/server ESM 在 vitest 下解析失败），
// 本测试只覆盖纯函数 getMemberQuota，mock 掉重依赖即可
vi.mock("@/lib/sso-auth", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { getMemberQuota } from "./usage-limit";

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
