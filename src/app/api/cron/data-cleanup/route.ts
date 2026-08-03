import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

// 游客保留 1 小时
const GUEST_RETENTION_MS = 1 * 60 * 60 * 1000;
// 注册用户保留 3 个月 (90 天)
const USER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
// 单个用户最多保留报告数
const MAX_USER_REPORTS = 100;

interface CleanupStats {
    sessions: number;
    testRecords: number;
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
        };

        const now = Date.now();

        // ===== 1. 清理已过期的游客数据（expiresAt 已过）=====
        // 使用 expiresAt 而非 createdAt，与用户端过期判断同源
        const guestSessions = await prisma.advisorSession.findMany({
            where: {
                userId: null,
                expiresAt: { lt: new Date(now) },
            },
            select: {
                sessionId: true,
            },
        });
        await cleanupSessions(guestSessions, stats);

        // ===== 2. 清理已过期的注册用户数据（expiresAt 已过）=====
        const oldUserSessions = await prisma.advisorSession.findMany({
            where: {
                userId: { not: null },
                expiresAt: { lt: new Date(now) },
            },
            select: {
                sessionId: true,
            },
        });
        await cleanupSessions(oldUserSessions, stats);

        // Recalculate for per-user retention
        const userCutoff = new Date(now - USER_RETENTION_MS);

        // ===== 3. 清理注册用户超量数据（3 个月内每个用户最多保留 100 条）=====
        // 使用 window function 一次性获取所有超量记录，避免 N+1 查询
        const excessSessions = await prisma.$queryRaw<Array<{ sessionId: string }>>`
            SELECT "sessionId"
            FROM (
                SELECT "sessionId", "createdAt",
                       ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC) as rn
                FROM "AdvisorSession"
                WHERE "userId" IS NOT NULL
                  AND "createdAt" >= ${userCutoff}
            ) t
            WHERE rn > ${MAX_USER_REPORTS}
            ORDER BY "createdAt" ASC
        `;

        await cleanupSessions(excessSessions, stats);


        // ===== 4. 清理过期 AI 用量日志（保留 30 天）=====
        const aiLogCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const deletedAiLogs = await prisma.aIUsageLog.deleteMany({
            where: { createdAt: { lt: aiLogCutoff } },
        });

        // ===== 5. 清理过期管理审计日志（保留 180 天）=====
        const auditLogCutoff = new Date(now - 180 * 24 * 60 * 60 * 1000);
        const deletedAuditLogs = await prisma.adminAuditLog.deleteMany({
            where: { createdAt: { lt: auditLogCutoff } },
        });

        // ===== 6. 清理过期 GuestUsage（保留 30 天）=====
        const guestCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const deletedGuests = await prisma.guestUsage.deleteMany({
            where: { lastTestAt: { lt: guestCutoff } },
        });

        // ===== 7. 清理过期 WeatherCache =====
        const deletedWeather = await prisma.weatherCache.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });

        // ===== 8. 清理僵尸 AppInstance（心跳超过 5 分钟未更新）=====
        const staleInstanceCutoff = new Date(now - 5 * 60 * 1000);
        const deletedInstances = await prisma.appInstance.deleteMany({
            where: { lastPing: { lt: staleInstanceCutoff } },
        });

        // ===== 9. 清理过期上传文件（保留 30 天）=====
        let deletedFiles = 0;
        try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const uploadDir = path.resolve(process.cwd(), "public", "uploads");
            const files = await fs.readdir(uploadDir).catch(() => [] as string[]);
            const fileCutoff = now - 30 * 24 * 60 * 60 * 1000;
            for (const file of files) {
                try {
                    // products/ 子目录存的是展品图等永久资产，豁免清理
                    if (file === "products") continue;
                    const filePath = path.join(uploadDir, file);
                    const stat = await fs.stat(filePath);
                    if (stat.mtimeMs < fileCutoff) {
                        await fs.unlink(filePath);
                        deletedFiles++;
                    }
                } catch { /* skip unreadable files */ }
            }
        } catch { /* upload dir may not exist */ }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            stats: {
                ...stats,
                aiLogs: deletedAiLogs.count,
                auditLogs: deletedAuditLogs.count,
                guests: deletedGuests.count,
                weather: deletedWeather.count,
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
