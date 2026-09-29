import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { logger } from "@/lib/logger";

export const maxDuration = 30;

/**
 * 内部接口：用户数据删除（供主站账号注销流程调用，PIPL 删除权）
 *
 * POST /api/internal/user-data/purge?userId=<主站SSO sub>
 * → { ok, userId, purged: { testRecords, diaryEntries, advisorSessions,
 *      productFeedbacks, aiUsageLogs, localUser } }
 *
 * 鉴权：HMAC 签名（internal-guard 模式）；userId 取自 query，
 * 主站开 INTERNAL_API_SIGN_QUERY 后 query 已纳入签名，不可篡改。
 *
 * 数据处置口径（各表决策理由）：
 * - TestRecord（测试次数记录）：纯用量计数，物理删除。
 * - DiaryEntry（护肤日记）：用户手写内容，物理删除。
 * - ProductFeedback（产品反馈）：用户评价原文，物理删除。
 * - AdvisorSession（测肤会话）：含问卷答案/分析结果（个人肤质数据）、IP 哈希、
 *   地理位置，属个人数据且无法靠清字段彻底脱敏（analysisResult 整体即个人画像），
 *   物理删除；账号注销优先于"注册用户历史长期保留"的常规策略。
 *   运营统计（分数分布百分位）基于全量聚合，删除个别用户行不影响其可用性。
 * - AIUsageLog（AI 成本审计）：仅存 token 数/费用/sessionId，无直接 PII，
 *   匿名化（userId 置 null）保留成本审计能力；sessionId 在会话行删除后无法回联用户。
 * - User（本地用户行）：物理删除；RefreshToken/PushSubscription/ReminderSettings
 *   由 DB onDelete: Cascade 级联清除，phoneNumber/email 唯一索引随删除释放。
 *
 * 幂等：全部用 deleteMany/updateMany，重复调用对已清理用户返回 ok:true 且计数为 0；
 * 用户不存在同样返回 ok:true + 全 0 + localUser:false（避免主站重试风暴）。
 * 响应/日志仅含 opaque userId 与计数，不落 PII。
 */
export async function POST(request: NextRequest) {
    // 先读原始文本再验签：HMAC 签名包含请求体哈希（与 diary 写入同口径）
    const rawBody = await request.text();
    const guard = await guardInternalUserRequest(request, {
        scope: "user-data-purge",
        maxRequests: 10,
        rawBody,
    });
    if (guard.error) return guard.error;
    const userId = guard.userId;

    try {
        const [testRecords, diaryEntries, productFeedbacks, advisorSessions, aiUsageLogs, localUser] =
            await prisma.$transaction([
                prisma.testRecord.deleteMany({ where: { userId } }),
                prisma.diaryEntry.deleteMany({ where: { userId } }),
                prisma.productFeedback.deleteMany({ where: { userId } }),
                prisma.advisorSession.deleteMany({ where: { userId } }),
                // 匿名化而非删除：保留成本审计（token/费用无 PII）
                prisma.aIUsageLog.updateMany({ where: { userId }, data: { userId: null } }),
                // 最后删用户行：RefreshToken/PushSubscription/ReminderSettings 级联清除
                prisma.user.deleteMany({ where: { id: userId } }),
            ]);

        const purged = {
            testRecords: testRecords.count,
            diaryEntries: diaryEntries.count,
            advisorSessions: advisorSessions.count,
            productFeedbacks: productFeedbacks.count,
            aiUsageLogs: aiUsageLogs.count,
            localUser: localUser.count > 0,
        };
        logger.info("[internal/user-data] purge completed", { userId, ...purged });
        return NextResponse.json({ ok: true, userId, purged });
    } catch (error) {
        logger.error("[internal/user-data] purge failed", { userId, error: String(error) });
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
    }
}
