import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
        const guestCutoff = new Date(now - GUEST_RETENTION_MS);
        const userCutoff = new Date(now - USER_RETENTION_MS);

        // ===== 1. 清理游客数据（超过 1 小时）=====
        const guestSessions = await prisma.advisorSession.findMany({
            where: {
                userId: null,
                createdAt: { lt: guestCutoff },
            },
            select: {
                sessionId: true,
            },
        });
        await cleanupSessions(guestSessions, stats);

        // ===== 2. 清理注册用户超期数据（超过 3 个月）=====
        const oldUserSessions = await prisma.advisorSession.findMany({
            where: {
                userId: { not: null },
                createdAt: { lt: userCutoff },
            },
            select: {
                sessionId: true,
            },
        });
        await cleanupSessions(oldUserSessions, stats);

        // ===== 3. 清理注册用户超量数据（3 个月内每个用户最多保留 100 条）=====
        // 使用 window function 一次性获取所有超量记录，避免 N+1 查询
        const excessSessions = await prisma.$queryRaw<Array<{ sessionId: string }>>`
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

        await cleanupSessions(excessSessions, stats);


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
