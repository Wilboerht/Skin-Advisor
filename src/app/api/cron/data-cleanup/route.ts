import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildArchivedSummary } from "@/lib/session-archive";
import { cleanupOrphanProductAssets } from "@/lib/product-assets";
import { DATA_RETENTION, coldSummaryCutoff } from "@/lib/data-retention";

export const maxDuration = 60;

const MAX_FULL_REPORTS = DATA_RETENTION.fullReportLimit;
const ARCHIVE_BATCH_LIMIT = 500;
const MAX_USER_REPORTS = DATA_RETENTION.maxReportsPerUser;
const EXCESS_BATCH_LIMIT = 1000;
const REGULAR_RETENTION_DAYS = DATA_RETENTION.fullReportDays;

interface CleanupStats {
    sessions: number;
    testRecords: number;
    archived: number;
}

type CleanupTx = Prisma.TransactionClient;

/**
 * 删除前在事务内重新校验候选会话：查询到删除之间用户可能刚好完成分析/认领会话，
 * 不能只凭批次查询结果直接删。
 */
async function revalidateSessionIds(
    tx: CleanupTx,
    sessionIds: string[],
    whereSql: Prisma.Sql
): Promise<string[]> {
    if (sessionIds.length === 0) return [];
    const rows = await tx.$queryRaw<Array<{ sessionId: string }>>(Prisma.sql`
        SELECT "sessionId" FROM "AdvisorSession"
        WHERE "sessionId" IN (${Prisma.join(sessionIds)})
          AND (${whereSql})
    `);
    return rows.map((row) => row.sessionId);
}

async function cleanupSessions(
    sessions: Array<{ sessionId: string; userId?: string | null }>,
    stats: CleanupStats,
    revalidate?: (tx: CleanupTx, sessionIds: string[]) => Promise<string[]>
): Promise<void> {
    if (sessions.length === 0) return;

    const candidateIds = sessions.map((s) => s.sessionId);

    const deletedStats = await prisma.$transaction(async (tx) => {
        const sessionIds = revalidate ? await revalidate(tx, candidateIds) : candidateIds;
        if (sessionIds.length === 0) return { testRecords: 0, sessions: 0 };

        const guestSessionIds = sessions
            .filter((s) => !s.userId && sessionIds.includes(s.sessionId))
            .map((s) => s.sessionId);

        // 注册用户的 TestRecord 是终身/每日额度计数来源，不能随历史报告删除而释放额度。
        const testRecords = guestSessionIds.length > 0
            ? await tx.testRecord.deleteMany({
                where: { sessionId: { in: guestSessionIds } },
            })
            : { count: 0 };
        // 无外键引用：会话删除后把日记/产品反馈的 sessionId 置空/哨兵值，
        // 避免前端"查看报告"跳到已删除的 404，或反馈记录无法回联。
        // 产品反馈使用 _nosession_ 哨兵，保持唯一索引语义（NULL 在 Postgres 唯一索引中互不相等）
        await tx.diaryEntry.updateMany({
            where: { sessionId: { in: sessionIds } },
            data: { sessionId: null },
        });
        // 产品反馈使用 _nosession_ 哨兵（NULL 不参与唯一约束）；
        // 同一用户/产品可能有多条不同 session 的反馈，直接 updateMany 会撞唯一键，
        // 因此逐条检查：已有哨兵记录时删除待清理记录，否则改写成哨兵。
        const feedbacks = await tx.productFeedback.findMany({
            where: { sessionId: { in: sessionIds } },
            select: { id: true, userId: true, productId: true },
        });
        for (const feedback of feedbacks) {
            const existing = await tx.productFeedback.findFirst({
                where: {
                    userId: feedback.userId,
                    productId: feedback.productId,
                    sessionId: "_nosession_",
                },
                select: { id: true },
            });
            if (existing) {
                await tx.productFeedback.delete({ where: { id: feedback.id } });
            } else {
                await tx.productFeedback.update({
                    where: { id: feedback.id },
                    data: { sessionId: "_nosession_" },
                });
            }
        }
        const advisorSessions = await tx.advisorSession.deleteMany({
            where: { sessionId: { in: sessionIds } },
        });
        return {
            testRecords: testRecords.count,
            sessions: advisorSessions.count,
        };
    });

    stats.sessions += deletedStats.sessions;
    stats.testRecords += deletedStats.testRecords;
}

/**
 * 分批删除会话：避免积压后一次性 findMany 全部主键 + 超大 IN 参数（Postgres 绑定参数上限）。
 * 每批删除后重新查询，直到不足一批为止。
 */
async function cleanupInBatches(
    where: Prisma.AdvisorSessionWhereInput,
    stats: CleanupStats,
    batchSize = 500,
    revalidate?: (tx: CleanupTx, sessionIds: string[]) => Promise<string[]>
): Promise<void> {
    for (;;) {
        const batch = await prisma.advisorSession.findMany({
            where,
            select: { sessionId: true, userId: true },
            take: batchSize,
        });
        if (batch.length === 0) return;
        await cleanupSessions(batch, stats, revalidate);
        if (batch.length < batchSize) return;
    }
}

function guestExpiredSql(nowDate: Date, fallback: Date): Prisma.Sql {
    return Prisma.sql`
        "userId" IS NULL
        AND (
            "expiresAt" < ${nowDate}
            OR ("expiresAt" IS NULL AND "createdAt" < ${fallback})
        )
    `;
}

function registeredIncompleteSql(nowDate: Date, fallback: Date): Prisma.Sql {
    return Prisma.sql`
        "userId" IS NOT NULL
        AND "completedAt" IS NULL
        AND (
            "expiresAt" < ${nowDate}
            OR ("expiresAt" IS NULL AND "createdAt" < ${fallback})
        )
        AND (
            "analysisResult" IS NULL
            OR (
                COALESCE("analysisResult"->>'reportVersion', '') <> '2'
                AND "analysisResult"->>'consultantReport' IS NULL
                AND "analysisResult"->>'skinProfile' IS NULL
                AND "analysisResult"->>'skinAnalysis' IS NULL
                AND "analysisResult"->>'analysis' IS NULL
            )
        )
    `;
}

export async function GET(request: NextRequest) {
    try {
        // 安全验证（与其他 cron 保持一致）
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret) {
            // 只接受 Authorization Header（不再接受 query secret，避免进入访问日志）；
            // 使用常量时间比较，防止计时侧信道
            const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
            const a = Buffer.from(provided);
            const b = Buffer.from(cronSecret);
            const isValidHeader =
                a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
            if (!isValidHeader) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        } else if (process.env.NODE_ENV === "production") {
            return NextResponse.json(
                { error: "CRON_SECRET not configured" },
                { status: 500 }
            );
        }

        const stats: CleanupStats = {
            sessions: 0,
            testRecords: 0,
            archived: 0,
        };

        const now = Date.now();

        // 兜底时限：expiresAt 为 NULL 的会话（从未完成分析，如 analytics track 创建的中断会话）
        // 按 createdAt 满 24 小时清理，避免表无限增长（比较操作符不匹配 NULL）
        const nullExpiryFallback = new Date(now - 24 * 60 * 60 * 1000);

        // ===== 1. 清理已过期的游客数据（expiresAt 已过 或 expiresAt 为 NULL 且创建超过兜底时限）=====
        // 使用 expiresAt 而非 createdAt，与用户端过期判断同源
        const nowDate = new Date(now);
        await cleanupInBatches(
            {
                userId: null,
                OR: [
                    { expiresAt: { lt: nowDate } },
                    { expiresAt: null, createdAt: { lt: nullExpiryFallback } },
                ],
            },
            stats,
            500,
            (tx, sessionIds) =>
                revalidateSessionIds(tx, sessionIds, guestExpiredSql(nowDate, nullExpiryFallback))
        );

        // ===== 2. 清理注册用户的垃圾会话 =====
        // 报告结果先于 completedAt 落库；第二步写失败时，完整结果仍必须保留。
        // 与 isCompletedAnalysisResult 同口径排除 v2/v1 完整报告，只删除真正的中断会话。
        for (;;) {
            const batch = await prisma.$queryRaw<Array<{ sessionId: string; userId: string }>>`
                SELECT "sessionId", "userId"
                FROM "AdvisorSession"
                WHERE "userId" IS NOT NULL
                  AND "completedAt" IS NULL
                  AND (
                    "expiresAt" < ${new Date(now)}
                    OR ("expiresAt" IS NULL AND "createdAt" < ${nullExpiryFallback})
                  )
                  AND (
                    "analysisResult" IS NULL
                    OR (
                      COALESCE("analysisResult"->>'reportVersion', '') <> '2'
                      AND "analysisResult"->>'consultantReport' IS NULL
                      AND "analysisResult"->>'skinProfile' IS NULL
                      AND "analysisResult"->>'skinAnalysis' IS NULL
                      AND "analysisResult"->>'analysis' IS NULL
                    )
                  )
                LIMIT 500
            `;
            if (batch.length === 0) break;
            await cleanupSessions(batch, stats, (tx, sessionIds) =>
                revalidateSessionIds(tx, sessionIds, registeredIncompleteSql(nowDate, nullExpiryFallback))
            );
            if (batch.length < 500) break;
        }

        // ===== 3. 冷热分层：最近 10 条之外、或满 365 天的报告脱水为脱敏摘要 =====
        // 热层（最近 10 条）用户可见、数据完整；冷层仅留统计摘要（无敏感问卷字段），
        // 用户不可见，供趋势对比与白皮书群体统计。所有会员档位统一适用。
        // 单次限量，多轮 cron 收敛。
        const retentionCutoff = new Date(now - REGULAR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const archivable = await prisma.$queryRaw<Array<{
            sessionId: string;
            analysisResult: Prisma.JsonValue | null;
            answers: Prisma.JsonValue | null;
        }>>`
            SELECT "sessionId", "analysisResult", "answers"
            FROM (
                SELECT s."sessionId",
                       s."analysisResult",
                       s."answers",
                       s."completedAt",
                       u."membershipLevel",
                       ROW_NUMBER() OVER (PARTITION BY s."userId" ORDER BY s."completedAt" DESC) as rn
                FROM "AdvisorSession" s
                LEFT JOIN "User" u ON u."id" = s."userId"
                WHERE s."userId" IS NOT NULL
                  AND s."completedAt" IS NOT NULL
                  AND s."archivedAt" IS NULL
                  -- 免费重试进行中（analysisStartedAt 晚于 completedAt）不归档
                  AND (s."analysisStartedAt" IS NULL OR s."analysisStartedAt" <= s."completedAt")
            ) t
            WHERE (t.rn > ${MAX_FULL_REPORTS} OR t."completedAt" < ${retentionCutoff})
            LIMIT ${ARCHIVE_BATCH_LIMIT}
        `;

        // 归档结果随主查询一次取回，避免逐条 findUnique 的 N+1 查询
        for (const row of archivable) {
            try {
                const summary = buildArchivedSummary(row.analysisResult, row.answers);
                await prisma.advisorSession.update({
                    where: { sessionId: row.sessionId },
                    data: {
                        analysisResult: summary as unknown as Prisma.InputJsonValue,
                        answers: Prisma.DbNull,
                        interactions: Prisma.DbNull,
                        ip: null,
                        province: null,
                        city: null,
                        userAgent: null,
                        deviceType: null,
                        browser: null,
                        os: null,
                        referrer: null,
                        utmSource: null,
                        utmMedium: null,
                        utmCampaign: null,
                        refSource: null,
                        resultShared: false,
                        shareMethod: null,
                        archivedAt: new Date(now),
                    },
                });
                stats.archived++;
            } catch (archiveErr) {
                // 单行失败不阻塞整体任务，下一轮 cron 重试
                logger.error("[Cleanup] Archive session failed", { sessionId: row.sessionId, error: String(archiveErr) });
            }
        }

        // ===== 4. 清理注册用户超量数据（每用户最多保留 100 条，含冷层摘要）=====
        // 只统计已完成报告（中断/埋点会话由步骤 2 清理），并按 createdAt 保留最新 100 条；
        // 单轮最多删除 EXCESS_BATCH_LIMIT 条，积压时由后续 cron 轮次收敛。
        const excessSessions = await prisma.$queryRaw<Array<{ sessionId: string; userId: string }>>`
            SELECT "sessionId", "userId"
            FROM (
                SELECT s."sessionId", s."userId", s."createdAt",
                       u."membershipLevel",
                       ROW_NUMBER() OVER (PARTITION BY s."userId" ORDER BY s."createdAt" DESC) as rn
                FROM "AdvisorSession" s
                LEFT JOIN "User" u ON u."id" = s."userId"
                WHERE s."userId" IS NOT NULL
                  AND s."completedAt" IS NOT NULL
            ) t
            WHERE t.rn > ${MAX_USER_REPORTS}
            ORDER BY t."createdAt" ASC
            LIMIT ${EXCESS_BATCH_LIMIT}
        `;

        await cleanupSessions(excessSessions, stats, (tx, sessionIds) =>
            revalidateSessionIds(
                tx,
                sessionIds,
                Prisma.sql`"userId" IS NOT NULL AND "completedAt" IS NOT NULL`
            )
        );

        // ===== 4b. 清理超过保留期的冷层摘要 =====
        await cleanupInBatches(
            {
                userId: { not: null },
                archivedAt: { lt: coldSummaryCutoff() },
            },
            stats
        );


        // ===== 5. 清理过期 AI 用量日志（保留 35 天，覆盖完整自然月 + 缓冲）=====
        const aiLogCutoff = new Date(now - 35 * 24 * 60 * 60 * 1000);
        const deletedAiLogs = await prisma.aIUsageLog.deleteMany({
            where: { createdAt: { lt: aiLogCutoff } },
        });

        // ===== 6. 清理过期管理审计日志（保留 180 天）=====
        const auditLogCutoff = new Date(now - 180 * 24 * 60 * 60 * 1000);
        const deletedAuditLogs = await prisma.adminAuditLog.deleteMany({
            where: { createdAt: { lt: auditLogCutoff } },
        });

        // ===== 7. 清理僵尸 AppInstance（心跳超过 5 分钟未更新）=====
        const staleInstanceCutoff = new Date(now - 5 * 60 * 1000);
        const deletedInstances = await prisma.appInstance.deleteMany({
            where: { lastPing: { lt: staleInstanceCutoff } },
        });

        // ===== 8. 清理 RefreshToken（撤销超 7 天 / 过期超 7 天）=====
        // 原表只增不减：每次 SSO 会话重建都会新增一行，注销也不撤销
        const refreshTokenCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const deletedRefreshTokens = await prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    { revokedAt: { lt: refreshTokenCutoff } },
                    { expiresAt: { lt: refreshTokenCutoff } },
                ],
            },
        });

        // ===== 9. 清理过期上传文件（guest 24 小时，其他 30 天，递归处理嵌套目录）=====
        // 人脸照片属于敏感数据，按 24 小时保留；products/ 等永久资产继续豁免。
        let deletedFiles = 0;
        let deletedGuestFiles = 0;
        try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const uploadDir = path.resolve(process.cwd(), "public", "uploads");
            const fileCutoff = now - 30 * 24 * 60 * 60 * 1000;
            const guestCutoff = now - 24 * 60 * 60 * 1000;

            // 递归按 mtime 清理；目录自底向上、仅在过期且已清空时删除
            const cleanDir = async (dir: string, isRoot: boolean, cutoff: number): Promise<void> => {
                const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
                for (const entry of entries) {
                    // products/ 展品图、avatars/ 用户头像属于永久资产，豁免清理
                    if (isRoot && (entry.name === "products" || entry.name === "avatars")) continue;
                    const fullPath = path.join(dir, entry.name);
                    try {
                        if (entry.isDirectory()) {
                            const isGuestDir = isRoot && entry.name === "guest";
                            const childCutoff = isGuestDir ? guestCutoff : cutoff;
                            await cleanDir(fullPath, false, childCutoff);
                            const stat = await fs.stat(fullPath);
                            const remaining = await fs.readdir(fullPath);
                            if (remaining.length === 0 && (stat.mtimeMs < childCutoff || isGuestDir)) {
                                await fs.rmdir(fullPath);
                            }
                        } else if (entry.isFile()) {
                            const stat = await fs.stat(fullPath);
                            if (stat.mtimeMs < cutoff) {
                                await fs.unlink(fullPath);
                                deletedFiles++;
                                if (cutoff === guestCutoff) deletedGuestFiles++;
                            }
                        }
                    } catch { /* skip unreadable files */ }
                }
            };
            await cleanDir(uploadDir, true, fileCutoff);
        } catch { /* upload dir may not exist */ }

        // ===== 9.1 清理 products/ 下无产品/无可见报告引用的孤儿图片 =====
        let deletedProductFiles = 0;
        try {
            deletedProductFiles = await cleanupOrphanProductAssets();
        } catch (productFileErr) {
            logger.error("[Cleanup] Product asset cleanup failed", {
                error: productFileErr instanceof Error ? productFileErr.message : String(productFileErr),
            });
        }

        // ===== 10. 清理孤儿预占：租约过期（或超过 24h）且没有成功 AI 消费 =====
        // 这些通常是 face-analyze 预占后请求中断/回滚失败留下的 TestRecord，
        // 会白扣用户额度；有成功 AI 消费的预占不在这里删（另行补偿）。
        const orphanCutoff = new Date(now - 24 * 60 * 60 * 1000);
        const orphanLeaseExpiredBefore = new Date(now);
        const orphanActiveAnalysisAfter = new Date(now - 5 * 60 * 1000);
        let deletedOrphanReservations = 0;
        try {
            deletedOrphanReservations = await prisma.$executeRaw`
                DELETE FROM "TestRecord" tr
                WHERE tr."status" = 'reserved'
                  AND (
                    tr."testDate" < ${orphanCutoff}
                    OR (tr."leaseExpiresAt" IS NOT NULL AND tr."leaseExpiresAt" < ${orphanLeaseExpiredBefore})
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM "AIUsageLog" l
                    WHERE l."sessionId" = tr."sessionId" AND l.success = true
                  )
                  -- 已完成报告或近 5 分钟仍在分析的不删；其余残留预占释放额度
                  AND NOT EXISTS (
                    SELECT 1 FROM "AdvisorSession" s
                    WHERE s."sessionId" = tr."sessionId"
                      AND (
                        s."completedAt" IS NOT NULL
                        OR s."analysisStartedAt" > ${orphanActiveAnalysisAfter}
                      )
                  )
            `;
        } catch (orphanErr) {
            logger.error("[Cleanup] Orphan reservation cleanup failed", {
                error: orphanErr instanceof Error ? orphanErr.message : String(orphanErr),
            });
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            stats: {
                ...stats,
                aiLogs: deletedAiLogs.count,
                auditLogs: deletedAuditLogs.count,
                instances: deletedInstances.count,
                refreshTokens: deletedRefreshTokens.count,
                files: deletedFiles,
                guestFiles: deletedGuestFiles,
                productFiles: deletedProductFiles,
                orphanReservations: deletedOrphanReservations,
            },
        });
    } catch (error: unknown) {
        logger.error("[Cleanup] Cron job failed", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal error",
            },
            { status: 500 }
        );
    }
}
