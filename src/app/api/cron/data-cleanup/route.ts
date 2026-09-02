import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildArchivedSummary } from "@/lib/session-archive";

export const maxDuration = 60;

// 热层：每用户最近 N 条已完成报告保留完整数据、用户可见；更早的脱水为冷层摘要
const MAX_FULL_REPORTS = 10;
// 冷层归档单轮处理上限（多轮 cron 收敛，避免超时）
const ARCHIVE_BATCH_LIMIT = 500;
// 单个用户最多保留报告数（热层 + 冷层摘要合计，滚动续期策略下的安全阀）
const MAX_USER_REPORTS = 100;
// 普通会员（REGULAR）测肤数据留存天数，满期降级为冷层摘要；高级会员（ADVANCED）永久保留
const REGULAR_RETENTION_DAYS = 365;

interface CleanupStats {
    sessions: number;
    testRecords: number;
    archived: number;
}

async function cleanupSessions(
    sessions: Array<{ sessionId: string }>,
    stats: CleanupStats
): Promise<void> {
    if (sessions.length === 0) return;

    const sessionIds = sessions.map((s) => s.sessionId);

    const deletedStats = await prisma.$transaction(async (tx) => {
        const testRecords = await tx.testRecord.deleteMany({
            where: { sessionId: { in: sessionIds } },
        });
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

export async function GET(request: NextRequest) {
    try {
        // 安全验证（与其他 cron 保持一致）
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret) {
            const isValidHeader = authHeader === `Bearer ${cronSecret}`;
            const isValidQuery = request.nextUrl.searchParams.get("secret") === cronSecret;

            if (!isValidHeader && !isValidQuery) {
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
        const guestSessions = await prisma.advisorSession.findMany({
            where: {
                userId: null,
                OR: [
                    { expiresAt: { lt: new Date(now) } },
                    { expiresAt: null, createdAt: { lt: nullExpiryFallback } },
                ],
            },
            select: {
                sessionId: true,
            },
        });
        await cleanupSessions(guestSessions, stats);

        // ===== 2. 清理注册用户的垃圾会话 =====
        // 「滚动续期的长期资产」策略：已完成的报告是用户的历史肌肤档案，
        // 按冷热分层保留（见步骤 3），不按 expiresAt 删除；expiresAt 仅表示
        // "当前档案"的 90 天有效期（报告页据此提示复测）。
        // 此步骤仅清理从未完成分析的中断会话（无档案价值），按 expiresAt 过期或
        // createdAt 满 24 小时兜底清理。
        const oldUserSessions = await prisma.advisorSession.findMany({
            where: {
                userId: { not: null },
                completedAt: null, // 仅清理从未完成分析的中断会话；已完成报告进入冷热分层保留
                OR: [
                    { expiresAt: { lt: new Date(now) } },
                    { expiresAt: null, createdAt: { lt: nullExpiryFallback } },
                ],
            },
            select: {
                sessionId: true,
            },
        });
        await cleanupSessions(oldUserSessions, stats);

        // ===== 3. 冷热分层：REGULAR 用户最近 10 条之外、或满 365 天的报告脱水为脱敏摘要 =====
        // 热层（最近 10 条）用户可见、数据完整；冷层仅留统计摘要（无敏感问卷字段），
        // 用户不可见，供趋势对比与白皮书群体统计。高级会员（ADVANCED）档案永久保留、不参与归档。
        // 单次限量，多轮 cron 收敛。
        const retentionCutoff = new Date(now - REGULAR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const archivable = await prisma.$queryRaw<Array<{ sessionId: string }>>`
            SELECT "sessionId"
            FROM (
                SELECT s."sessionId",
                       s."completedAt",
                       u."membershipLevel",
                       ROW_NUMBER() OVER (PARTITION BY s."userId" ORDER BY s."completedAt" DESC) as rn
                FROM "AdvisorSession" s
                LEFT JOIN "User" u ON u."id" = s."userId"
                WHERE s."userId" IS NOT NULL
                  AND s."completedAt" IS NOT NULL
                  AND s."archivedAt" IS NULL
            ) t
            WHERE t."membershipLevel" IS DISTINCT FROM 'ADVANCED'
              AND (t.rn > ${MAX_FULL_REPORTS} OR t."completedAt" < ${retentionCutoff})
            LIMIT ${ARCHIVE_BATCH_LIMIT}
        `;

        for (const { sessionId } of archivable) {
            try {
                const row = await prisma.advisorSession.findUnique({
                    where: { sessionId },
                    select: { analysisResult: true, answers: true },
                });
                if (!row) continue;
                const summary = buildArchivedSummary(row.analysisResult, row.answers);
                await prisma.advisorSession.update({
                    where: { sessionId },
                    data: {
                        analysisResult: summary as unknown as Prisma.InputJsonValue,
                        answers: Prisma.DbNull,      // 敏感问卷字段不进冷层
                        interactions: Prisma.DbNull, // 行为记录一并清除
                        archivedAt: new Date(now),
                    },
                });
                stats.archived++;
            } catch (archiveErr) {
                // 单行失败不阻塞整体任务，下一轮 cron 重试
                logger.error("[Cleanup] Archive session failed", { sessionId, error: String(archiveErr) });
            }
        }

        // ===== 4. 清理注册用户超量数据（普通会员最多保留 100 条，含冷层摘要；高级会员永久保留豁免）=====
        // 使用 window function 一次性获取所有超量记录，避免 N+1 查询
        const excessSessions = await prisma.$queryRaw<Array<{ sessionId: string }>>`
            SELECT "sessionId"
            FROM (
                SELECT s."sessionId", s."createdAt",
                       u."membershipLevel",
                       ROW_NUMBER() OVER (PARTITION BY s."userId" ORDER BY s."createdAt" DESC) as rn
                FROM "AdvisorSession" s
                LEFT JOIN "User" u ON u."id" = s."userId"
                WHERE s."userId" IS NOT NULL
            ) t
            WHERE t."membershipLevel" IS DISTINCT FROM 'ADVANCED'
              AND t.rn > ${MAX_USER_REPORTS}
            ORDER BY t."createdAt" ASC
        `;

        await cleanupSessions(excessSessions, stats);


        // ===== 5. 清理过期 AI 用量日志（保留 30 天）=====
        const aiLogCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const deletedAiLogs = await prisma.aIUsageLog.deleteMany({
            where: { createdAt: { lt: aiLogCutoff } },
        });

        // ===== 6. 清理过期管理审计日志（保留 180 天）=====
        const auditLogCutoff = new Date(now - 180 * 24 * 60 * 60 * 1000);
        const deletedAuditLogs = await prisma.adminAuditLog.deleteMany({
            where: { createdAt: { lt: auditLogCutoff } },
        });

        // ===== 7. 清理过期 GuestUsage（保留 30 天）=====
        const guestCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const deletedGuests = await prisma.guestUsage.deleteMany({
            where: { lastTestAt: { lt: guestCutoff } },
        });

        // ===== 8. 清理僵尸 AppInstance（心跳超过 5 分钟未更新）=====
        const staleInstanceCutoff = new Date(now - 5 * 60 * 1000);
        const deletedInstances = await prisma.appInstance.deleteMany({
            where: { lastPing: { lt: staleInstanceCutoff } },
        });

        // ===== 9. 清理过期上传文件（保留 30 天，递归处理嵌套目录）=====
        // 旧实现只对根目录条目 unlink，guest/、advisor/ 等子目录会因 EISDIR 被吞掉永不清理
        let deletedFiles = 0;
        try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const uploadDir = path.resolve(process.cwd(), "public", "uploads");
            const fileCutoff = now - 30 * 24 * 60 * 60 * 1000;

            // 递归按 mtime 清理；目录自底向上、仅在过期且已清空时删除
            const cleanDir = async (dir: string, isRoot: boolean): Promise<void> => {
                const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
                for (const entry of entries) {
                    // products/ 子目录存的是展品图等永久资产，豁免清理
                    if (isRoot && entry.name === "products") continue;
                    const fullPath = path.join(dir, entry.name);
                    try {
                        if (entry.isDirectory()) {
                            await cleanDir(fullPath, false);
                            const stat = await fs.stat(fullPath);
                            const remaining = await fs.readdir(fullPath);
                            if (stat.mtimeMs < fileCutoff && remaining.length === 0) {
                                await fs.rmdir(fullPath);
                            }
                        } else if (entry.isFile()) {
                            const stat = await fs.stat(fullPath);
                            if (stat.mtimeMs < fileCutoff) {
                                await fs.unlink(fullPath);
                                deletedFiles++;
                            }
                        }
                    } catch { /* skip unreadable files */ }
                }
            };
            await cleanDir(uploadDir, true);
        } catch { /* upload dir may not exist */ }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            stats: {
                ...stats,
                aiLogs: deletedAiLogs.count,
                auditLogs: deletedAuditLogs.count,
                guests: deletedGuests.count,
                instances: deletedInstances.count,
                files: deletedFiles,
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
