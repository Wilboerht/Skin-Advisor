/**
 * 用户数据物理删除（PIPL 删除权）公共实现。
 *
 * 主站注销（/api/internal/user-data/purge）与管理端删除用户共用，
 * 避免两处口径不一致：管理端也必须删除 OSS/本地头像与人脸文件，
 * 并匿名化 AI 成本日志。
 */
import prisma from "@/lib/prisma";
import { deleteUserAvatar, deleteUserFaceUploads } from "@/lib/user-data-files";

export interface PurgeUserResult {
    testRecords: number;
    diaryEntries: number;
    advisorSessions: number;
    productFeedbacks: number;
    reportQualityLogs: number;
    aiUsageLogs: number;
    localUser: boolean;
    deletedAvatarFiles: number;
    deletedFaceUploads: number;
}

export async function purgeUserData(userId: string): Promise<PurgeUserResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
    });
    const sessions = await prisma.advisorSession.findMany({
        where: { userId },
        select: { sessionId: true },
    });

    const sessionIds = sessions.map((session) => session.sessionId);
    const deletedAvatarFiles = await deleteUserAvatar(user?.avatarUrl, userId);
    const deletedFaceUploads = await deleteUserFaceUploads(userId, sessionIds);

    const [testRecords, diaryEntries, productFeedbacks, reportQualityLogs, advisorSessions, aiUsageLogs, localUser] =
        await prisma.$transaction([
            prisma.testRecord.deleteMany({ where: { userId } }),
            prisma.diaryEntry.deleteMany({ where: { userId } }),
            prisma.productFeedback.deleteMany({ where: { userId } }),
            // 质量日志没有用户外键；按 userId + sessionId 双条件清理，
            // 避免匿名/历史行在删除会话后残留。
            prisma.reportQualityLog.deleteMany({
                where: {
                    OR: [
                        { userId },
                        ...(sessionIds.length > 0 ? [{ sessionId: { in: sessionIds } }] : []),
                    ],
                },
            }),
            prisma.advisorSession.deleteMany({ where: { userId } }),
            // 匿名化而非删除：保留成本审计（token/费用无 PII）
            prisma.aIUsageLog.updateMany({ where: { userId }, data: { userId: null } }),
            // 最后删用户行：RefreshToken/PushSubscription/ReminderSettings 级联清除
            prisma.user.deleteMany({ where: { id: userId } }),
        ]);

    return {
        testRecords: testRecords.count,
        diaryEntries: diaryEntries.count,
        advisorSessions: advisorSessions.count,
        productFeedbacks: productFeedbacks.count,
        reportQualityLogs: reportQualityLogs.count,
        aiUsageLogs: aiUsageLogs.count,
        localUser: localUser.count > 0,
        deletedAvatarFiles,
        deletedFaceUploads,
    };
}
