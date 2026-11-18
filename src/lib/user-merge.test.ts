import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    userFindUnique: vi.fn(),
    diaryFindMany: vi.fn(),
    diaryFindUnique: vi.fn(),
    diaryUpdate: vi.fn(),
    diaryDelete: vi.fn(),
    reportFeedbackFindMany: vi.fn(),
    reportFeedbackFindUnique: vi.fn(),
    reportFeedbackUpdate: vi.fn(),
    reportFeedbackDelete: vi.fn(),
    userUpdate: vi.fn(),
    userDelete: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
    const tx = {
        user: {
            findUnique: mocks.userFindUnique,
            update: mocks.userUpdate,
            delete: mocks.userDelete,
        },
        advisorSession: { updateMany: vi.fn() },
        testRecord: { updateMany: vi.fn() },
        pushSubscription: { updateMany: vi.fn() },
        statusWebhookEvent: { updateMany: vi.fn() },
        aIUsageLog: { updateMany: vi.fn() },
        refreshToken: { deleteMany: vi.fn() },
        consentRecord: { findMany: vi.fn().mockResolvedValue([]) },
        diaryEntry: {
            findMany: mocks.diaryFindMany,
            findUnique: mocks.diaryFindUnique,
            update: mocks.diaryUpdate,
            delete: mocks.diaryDelete,
        },
        productFeedback: { findMany: vi.fn().mockResolvedValue([]) },
        reportFeedback: {
            findMany: mocks.reportFeedbackFindMany,
            findUnique: mocks.reportFeedbackFindUnique,
            update: mocks.reportFeedbackUpdate,
            delete: mocks.reportFeedbackDelete,
        },
        reminderSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    return {
        default: {
            $transaction: mocks.transaction.mockImplementation(
                async (handler: (client: typeof tx) => Promise<void>) => handler(tx)
            ),
        },
    };
});
vi.mock("@/lib/permissions", () => ({
    isDisabledUser: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/logger", () => ({
    logger: { info: mocks.info, warn: mocks.warn, error: mocks.error },
}));

import { __internal } from "./user-merge";

const sourceUser = {
    id: "source",
    email: null,
    name: "旧账号",
    avatarUrl: null,
    gender: null,
    membershipLevel: null,
    totalSpent: 0,
    dailyTestLimit: 10,
    privacyConsentAt: null,
    privacyConsentVersion: null,
    lastStatusEventAt: null,
    role: "USER",
};
const targetUser = {
    id: "target",
    email: null,
    name: "新账号",
    avatarUrl: null,
    gender: null,
    membershipLevel: null,
    totalSpent: 0,
    dailyTestLimit: 10,
    privacyConsentAt: null,
    privacyConsentVersion: null,
    lastStatusEventAt: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === "source" ? sourceUser : targetUser)
    );
    mocks.userUpdate.mockResolvedValue({});
    mocks.userDelete.mockResolvedValue({});
    mocks.diaryUpdate.mockResolvedValue({});
    mocks.diaryDelete.mockResolvedValue({});
    mocks.reportFeedbackFindMany.mockResolvedValue([]);
    mocks.reportFeedbackFindUnique.mockResolvedValue(null);
    mocks.reportFeedbackUpdate.mockResolvedValue({});
    mocks.reportFeedbackDelete.mockResolvedValue({});
});

describe("mergeUserData 日记冲突", () => {
    it("同一天手动打卡与自动记录冲突时保留 manual 和更早 createdAt", async () => {
        const oldCreatedAt = new Date("2026-01-01T00:00:00.000Z");
        const existingCreatedAt = new Date("2026-01-02T00:00:00.000Z");
        mocks.diaryFindMany.mockResolvedValue([
            {
                id: "old",
                user: sourceUser,
                date: new Date("2026-02-01T00:00:00.000Z"),
                skinState: "good",
                tags: ["熬夜"],
                note: "手动",
                sessionId: null,
                source: "manual",
                createdAt: oldCreatedAt,
                updatedAt: new Date("2026-02-01T00:00:00.000Z"),
            },
        ]);
        mocks.diaryFindUnique.mockResolvedValue({
            id: "existing",
            user: targetUser,
            date: new Date("2026-02-01T00:00:00.000Z"),
            skinState: "normal",
            tags: null,
            note: "自动",
            sessionId: "session-1",
            source: "auto",
            createdAt: existingCreatedAt,
            updatedAt: new Date("2026-02-02T00:00:00.000Z"),
        });

        await __internal.mergeUserData("source", "target");

        expect(mocks.diaryUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "existing" },
                data: expect.objectContaining({
                    source: "manual",
                    createdAt: oldCreatedAt,
                    sessionId: "session-1",
                }),
            })
        );
        expect(mocks.diaryDelete).toHaveBeenCalledWith({ where: { id: "old" } });
    });
});

describe("mergeUserData 报告反馈迁移", () => {
    const oldFeedback = {
        id: "rf-old",
        userId: "source",
        sessionId: "session-1",
        targetType: "report",
        targetKey: "report",
        verdict: "inaccurate",
        note: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        updatedAt: new Date("2026-02-03T00:00:00.000Z"),
    };

    it("无冲突时改挂到目标账号，避免级联删除", async () => {
        mocks.reportFeedbackFindMany.mockResolvedValue([oldFeedback]);

        await __internal.mergeUserData("source", "target");

        expect(mocks.reportFeedbackFindUnique).toHaveBeenCalledWith({
            where: {
                userId_sessionId_targetType_targetKey: {
                    userId: "target",
                    sessionId: "session-1",
                    targetType: "report",
                    targetKey: "report",
                },
            },
        });
        expect(mocks.reportFeedbackUpdate).toHaveBeenCalledWith({
            where: { id: "rf-old" },
            data: { userId: "target", updatedAt: new Date("2026-02-03T00:00:00.000Z") },
        });
        expect(mocks.reportFeedbackDelete).not.toHaveBeenCalled();
    });

    it("目标账号已有同位置反馈时保留目标行，删除旧行", async () => {
        mocks.reportFeedbackFindMany.mockResolvedValue([oldFeedback]);
        mocks.reportFeedbackFindUnique.mockResolvedValue({ id: "rf-new" });

        await __internal.mergeUserData("source", "target");

        expect(mocks.reportFeedbackDelete).toHaveBeenCalledWith({ where: { id: "rf-old" } });
        expect(mocks.reportFeedbackUpdate).not.toHaveBeenCalled();
    });
});
