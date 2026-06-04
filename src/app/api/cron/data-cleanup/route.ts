import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteOSSFiles } from "@/lib/ali-oss";

export const maxDuration = 60;

// 游客保留 3 小时
const GUEST_RETENTION_MS = 3 * 60 * 60 * 1000;
// 注册用户保留 3 个月 (90 天)
const USER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
// 单个用户最多保留报告数
const MAX_USER_REPORTS = 100;

interface CleanupStats {
    sessions: number;
    testRecords: number;
    avatarQueues: number;
    cloudFiles: number;
}

function extractAvatarUrls(sessions: Array<{ analysisResult: unknown }>): string[] {
    const urls: string[] = [];
    for (const session of sessions) {
        const result = session.analysisResult as Record<string, unknown> | null;
        if (
            result?.generatedAvatar &&
            typeof result.generatedAvatar === "string" &&
            result.generatedAvatar.startsWith("http")
        ) {
            urls.push(result.generatedAvatar);
        }
    }
    return urls;
}

/**
 * 从 AvatarQueue 中提取需要删除的 cloud 文件 URL
 */
function extractQueueUrls(items: Array<{ frontPhoto: string | null; generatedUrl: string | null }>): string[] {
    const urls: string[] = [];
    for (const item of items) {
        if (item.generatedUrl && item.generatedUrl.startsWith("http")) {
            urls.push(item.generatedUrl);
        }
        if (item.frontPhoto && item.frontPhoto.startsWith("http")) {
            urls.push(item.frontPhoto);
        }
    }
    return urls;
}

async function deleteCloudFiles(urls: string[]): Promise<number> {
    if (urls.length === 0) return 0;

    try {
        await deleteOSSFiles(urls);
        return urls.length;
    } catch (e) {
        console.error("[Cleanup] Failed to delete OSS files:", e);
        return 0;
    }
}

async function cleanupSessions(
    sessions: Array<{ sessionId: string; analysisResult: unknown }>,
    stats: CleanupStats
): Promise<void> {
    if (sessions.length === 0) return;

    const sessionIds = sessions.map((s) => s.sessionId);
    const urlsToDelete = extractAvatarUrls(sessions);

    // 清理 AvatarQueue 中残留的原始照片和生成的 avatar（可能未同步到 analysisResult）
    const avatarQueueItems = await prisma.avatarQueue.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { frontPhoto: true, generatedUrl: true },
    });

    const queueUrls = extractQueueUrls(avatarQueueItems);
    urlsToDelete.push(...queueUrls);

    const deletedStats = await prisma.$transaction(async (tx) => {
        const testRecords = await tx.testRecord.deleteMany({
            where: { sessionId: { in: sessionIds } },
        });
        const avatarQueues = await tx.avatarQueue.deleteMany({
            where: { sessionId: { in: sessionIds } },
        });
        const advisorSessions = await tx.advisorSession.deleteMany({
            where: { sessionId: { in: sessionIds } },
        });
        return {
            testRecords: testRecords.count,
            avatarQueues: avatarQueues.count,
            sessions: advisorSessions.count,
        };
    });

    const cloudDeleted = await deleteCloudFiles(urlsToDelete);

    stats.sessions += deletedStats.sessions;
    stats.testRecords += deletedStats.testRecords;
    stats.avatarQueues += deletedStats.avatarQueues;
    stats.cloudFiles += cloudDeleted;
}

export async function GET(request: NextRequest) {
    try {
        // 安全验证（与 vip-expiry cron 保持一致）
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
            avatarQueues: 0,
            cloudFiles: 0,
        };

        const now = Date.now();
        const guestCutoff = new Date(now - GUEST_RETENTION_MS);
        const userCutoff = new Date(now - USER_RETENTION_MS);

        // ===== 1. 清理游客数据（超过 3 小时）=====
        console.log(`[Cleanup] Guest cutoff: ${guestCutoff.toISOString()}`);
        const guestSessions = await prisma.advisorSession.findMany({
            where: {
                userId: null,
                createdAt: { lt: guestCutoff },
            },
            select: {
                sessionId: true,
                analysisResult: true,
            },
        });
        console.log(`[Cleanup] Found ${guestSessions.length} expired guest sessions`);
        await cleanupSessions(guestSessions, stats);

        // ===== 2. 清理注册用户超期数据（超过 3 个月）=====
        console.log(`[Cleanup] User cutoff: ${userCutoff.toISOString()}`);
        const oldUserSessions = await prisma.advisorSession.findMany({
            where: {
                userId: { not: null },
                createdAt: { lt: userCutoff },
            },
            select: {
                sessionId: true,
                analysisResult: true,
            },
        });
        console.log(`[Cleanup] Found ${oldUserSessions.length} expired user sessions (> 3 months)`);
        await cleanupSessions(oldUserSessions, stats);

        // ===== 3. 清理注册用户超量数据（3 个月内每个用户最多保留 100 条）=====
        // 使用 window function 一次性获取所有超量记录，避免 N+1 查询
        const excessSessions = await prisma.$queryRaw<Array<{ sessionId: string; analysisResult: unknown }>>`
            SELECT "sessionId", "analysisResult"
            FROM (
                SELECT "sessionId", "analysisResult", "createdAt",
                       ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC) as rn
                FROM "AdvisorSession"
                WHERE "userId" IS NOT NULL
                  AND "createdAt" >= ${userCutoff}
            ) t
            WHERE rn > ${MAX_USER_REPORTS}
            ORDER BY "createdAt" ASC
        `;

        console.log(`[Cleanup] Found ${excessSessions.length} excess user sessions to delete`);
        await cleanupSessions(excessSessions, stats);

        console.log("[Cleanup] Done:", stats);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            stats,
        });
    } catch (error: unknown) {
        console.error("[Cleanup] ❌ Cron job failed:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal error",
            },
            { status: 500 }
        );
    }
}
