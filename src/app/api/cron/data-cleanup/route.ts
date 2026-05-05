import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteOSSFiles } from "@/lib/ali-oss";
import { deleteSupabaseFiles } from "@/lib/supabase-storage";

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

async function deleteCloudFiles(urls: string[]): Promise<number> {
    if (urls.length === 0) return 0;

    const supabaseUrls = urls.filter((u) => u.includes("supabase.co"));
    const ossUrls = urls.filter((u) => !u.includes("supabase.co"));

    let deleted = 0;
    if (supabaseUrls.length > 0) {
        try {
            await deleteSupabaseFiles(supabaseUrls);
            deleted += supabaseUrls.length;
        } catch (e) {
            console.error("[Cleanup] Failed to delete Supabase files:", e);
        }
    }
    if (ossUrls.length > 0) {
        try {
            await deleteOSSFiles(ossUrls);
            deleted += ossUrls.length;
        } catch (e) {
            console.error("[Cleanup] Failed to delete OSS files:", e);
        }
    }
    return deleted;
}

async function cleanupSessions(
    sessions: Array<{ sessionId: string; analysisResult: unknown }>,
    stats: CleanupStats
): Promise<void> {
    if (sessions.length === 0) return;

    const sessionIds = sessions.map((s) => s.sessionId);
    const urlsToDelete = extractAvatarUrls(sessions);

    // 清理 AvatarQueue 中残留的原始照片
    const avatarQueueItems = await prisma.avatarQueue.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { frontPhoto: true },
    });

    for (const item of avatarQueueItems) {
        if (item.frontPhoto && item.frontPhoto.startsWith("http")) {
            try {
                if (item.frontPhoto.includes("supabase.co")) {
                    await deleteSupabaseFiles([item.frontPhoto]);
                } else {
                    await deleteOSSFiles([item.frontPhoto]);
                }
            } catch {
                // ignore
            }
        }
    }

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
        const usersWithExcess = await prisma.advisorSession.groupBy({
            by: ["userId"],
            where: {
                userId: { not: null },
                createdAt: { gte: userCutoff },
            },
            _count: { id: true },
            having: {
                id: {
                    _count: {
                        gt: MAX_USER_REPORTS,
                    },
                },
            },
        });

        console.log(`[Cleanup] Found ${usersWithExcess.length} users with > ${MAX_USER_REPORTS} reports`);

        for (const user of usersWithExcess) {
            if (!user.userId) continue;
            const excess = user._count.id - MAX_USER_REPORTS;
            if (excess <= 0) continue;

            const sessionsToDelete = await prisma.advisorSession.findMany({
                where: {
                    userId: user.userId,
                    createdAt: { gte: userCutoff },
                },
                orderBy: { createdAt: "asc" },
                take: excess,
                select: {
                    sessionId: true,
                    analysisResult: true,
                },
            });

            console.log(
                `[Cleanup] User ${user.userId}: deleting ${sessionsToDelete.length} oldest sessions`
            );
            await cleanupSessions(sessionsToDelete, stats);
        }

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
