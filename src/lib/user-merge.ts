/**
 * 本地账号合并：当微信登录/绑定返回的 userId 与既有手机号账号不一致时，
 * 把旧账号的业务数据迁移到新账号，再删除旧账号。
 *
 * 背景：`User.phoneNumber` 唯一。原先冲突时把旧账号手机号改成
 * `merged_<id>_<phone>` 伪值，但历史报告、日记、打卡额度、同意记录仍留在
 * 旧 userId 下，新账号看不到（静默数据丢失）。本模块在事务内完成迁移。
 *
 * 注意：
 * - RefreshToken 不迁移：旧账号的会话 tokenVersion 可能不一致，直接撤销更安全；
 * - 冲突的唯一键（日记日期、同意 scope/version、产品反馈）按合并策略处理；
 * - 迁移完成后删除旧账号，避免留下任何伪手机号或孤儿数据。
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isDisabledUser } from "@/lib/permissions";
import { logger } from "@/lib/logger";

const MERGE_TRANSACTION_TIMEOUT_MS = 30_000;

async function mergeUserData(fromUserId: string, toUserId: string): Promise<void> {
    if (fromUserId === toUserId) return;

    await prisma.$transaction(async (tx) => {
        const [from, to] = await Promise.all([
            tx.user.findUnique({ where: { id: fromUserId } }),
            tx.user.findUnique({ where: { id: toUserId } }),
        ]);
        if (!from) return;

        // 目标账号必须存在；调用方已提前 upsert 占位
        if (!to) {
            throw new Error(`merge target user not found: ${toUserId}`);
        }
        // 旧账号已被禁用：不能通过“换手机号登录”合并绕过封禁
        if (isDisabledUser(from.role)) {
            throw new Error("legacy account is disabled; refuse to merge");
        }

        // ===== 直接迁移的关联（无用户维度唯一约束） =====
        await tx.advisorSession.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } });
        await tx.testRecord.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } });
        await tx.pushSubscription.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } });
        await tx.statusWebhookEvent.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } });
        await tx.aIUsageLog.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } });

        // 旧会话不迁移：tokenVersion/设备语义不一致，强制重新登录
        await tx.refreshToken.deleteMany({ where: { userId: fromUserId } });

        // ===== ConsentRecord：userId+scope+version 唯一 =====
        const consents = await tx.consentRecord.findMany({ where: { userId: fromUserId } });
        for (const consent of consents) {
            const existing = await tx.consentRecord.findUnique({
                where: {
                    userId_scope_version: {
                        userId: toUserId,
                        scope: consent.scope,
                        version: consent.version,
                    },
                },
            });
            if (!existing) {
                await tx.consentRecord.update({ where: { id: consent.id }, data: { userId: toUserId } });
                continue;
            }
            // 合并：保留最早授权时间；任一方未撤销则视为未撤销；保留最新撤销时间
            const grantedAt = existing.grantedAt < consent.grantedAt ? existing.grantedAt : consent.grantedAt;
            const revokedAt =
                existing.revokedAt === null || consent.revokedAt === null
                    ? null
                    : existing.revokedAt > consent.revokedAt
                      ? existing.revokedAt
                      : consent.revokedAt;
            await tx.consentRecord.update({
                where: { id: existing.id },
                data: { grantedAt, revokedAt, ipHash: existing.ipHash ?? consent.ipHash },
            });
            await tx.consentRecord.delete({ where: { id: consent.id } });
        }

        // ===== DiaryEntry：userId+date 唯一 =====
        const diaries = await tx.diaryEntry.findMany({ where: { userId: fromUserId } });
        for (const diary of diaries) {
            const existing = await tx.diaryEntry.findUnique({
                where: { userId_date: { userId: toUserId, date: diary.date } },
            });
            if (!existing) {
                await tx.diaryEntry.update({ where: { id: diary.id }, data: { userId: toUserId } });
                continue;
            }
            // 同一天两边都有：保留更新时间较新的一方，缺失字段用另一方补齐
            const useOld = diary.updatedAt > existing.updatedAt;
            const mergedTags = (useOld ? diary.tags : existing.tags) ?? existing.tags ?? diary.tags;
            await tx.diaryEntry.update({
                where: { id: existing.id },
                data: {
                    skinState: useOld ? diary.skinState : existing.skinState,
                    tags: mergedTags === null
                        ? Prisma.DbNull
                        : (mergedTags as Prisma.InputJsonValue),
                    note: useOld ? (diary.note ?? existing.note) : (existing.note ?? diary.note),
                    sessionId: existing.sessionId ?? diary.sessionId,
                },
            });
            await tx.diaryEntry.delete({ where: { id: diary.id } });
        }

        // ===== ProductFeedback：userId+productId+sessionId 唯一 =====
        const feedbacks = await tx.productFeedback.findMany({ where: { userId: fromUserId } });
        for (const feedback of feedbacks) {
            // 历史清理可能把 sessionId 置为 NULL；迁移时统一归一化为 _nosession_ 哨兵，
            // 避免 NULL 绕过唯一约束造成同一用户/产品重复反馈
            const targetSessionId = feedback.sessionId ?? "_nosession_";
            const existing = await tx.productFeedback.findFirst({
                where: {
                    userId: toUserId,
                    productId: feedback.productId,
                    sessionId: targetSessionId,
                },
            });
            if (existing) {
                await tx.productFeedback.delete({ where: { id: feedback.id } });
            } else {
                await tx.productFeedback.update({
                    where: { id: feedback.id },
                    data: { userId: toUserId, sessionId: targetSessionId },
                });
            }
        }

        // ===== ReminderSettings：userId 唯一 =====
        const reminder = await tx.reminderSettings.findUnique({ where: { userId: fromUserId } });
        if (reminder) {
            const existing = await tx.reminderSettings.findUnique({ where: { userId: toUserId } });
            if (existing) {
                await tx.reminderSettings.delete({ where: { userId: fromUserId } });
            } else {
                await tx.reminderSettings.update({ where: { userId: fromUserId }, data: { userId: toUserId } });
            }
        }

        // ===== 用户资料：补全目标账号缺失字段，保留目标已有值 =====
        await tx.user.update({
            where: { id: toUserId },
            data: {
                email: to.email ?? from.email,
                name: to.name || from.name,
                avatarUrl: to.avatarUrl || from.avatarUrl,
                gender: to.gender ?? from.gender,
                membershipLevel: to.membershipLevel ?? from.membershipLevel,
                totalSpent: Math.max(to.totalSpent ?? 0, from.totalSpent ?? 0),
                dailyTestLimit: Math.max(to.dailyTestLimit, from.dailyTestLimit),
                privacyConsentAt: to.privacyConsentAt ?? from.privacyConsentAt,
                privacyConsentVersion: to.privacyConsentVersion ?? from.privacyConsentVersion,
                lastStatusEventAt:
                    to.lastStatusEventAt && from.lastStatusEventAt
                        ? to.lastStatusEventAt > from.lastStatusEventAt
                            ? to.lastStatusEventAt
                            : from.lastStatusEventAt
                        : (to.lastStatusEventAt ?? from.lastStatusEventAt),
            },
        });

        // 释放旧账号手机号并删除；所有关联已迁移或删除
        await tx.user.update({ where: { id: fromUserId }, data: { phoneNumber: null } });
        await tx.user.delete({ where: { id: fromUserId } });
    }, { timeout: MERGE_TRANSACTION_TIMEOUT_MS });
}

/**
 * 若手机号已被其他本地账号占用，把该旧账号合并到目标账号。
 * 调用方随后可安全 upsert 目标账号并写入手机号。
 */
export async function mergeUserByPhone(targetUserId: string, phone: string): Promise<boolean> {
    const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    if (!existing || existing.id === targetUserId) return false;
    if (isDisabledUser(existing.role)) {
        // 在创建占位账号之前拒绝，避免留下无手机号的孤儿目标账号
        throw new Error("legacy account is disabled; refuse to merge");
    }

    logger.warn("[UserMerge] Phone collision detected, merging legacy account", {
        fromUserId: existing.id,
        toUserId: targetUserId,
    });

    // 目标账号可能尚未创建：先占位，事务内再迁移数据
    await prisma.user.upsert({
        where: { id: targetUserId },
        update: {},
        create: { id: targetUserId, phoneNumber: null },
    });

    await mergeUserData(existing.id, targetUserId);
    return true;
}

export const __internal = { mergeUserData };
