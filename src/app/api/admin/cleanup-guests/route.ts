import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyAdminSession, logAdminAction } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/cleanup-guests
 * 自动清理超过 1 小时的游客数据
 * 支持两种鉴权方式：
 * 1. Authorization: Bearer <ADMIN_SECRET>（用于定时任务）
 * 2. Admin Session Cookie（用于管理员手动触发）
 */
export async function POST(req: NextRequest) {
    // Rate limit: max 10 requests per minute per IP
    const ip = getClientIP(req);
    const rateLimitResult = await rateLimit(`cleanup-guests-${ip}`, "default", {
        maxRequests: 10,
        windowMs: 60 * 1000,
    });
    if (!rateLimitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // 1. 安全校验 - 支持 ADMIN_SECRET 或 admin session
    const authHeader = req.headers.get("authorization");
    const secret = process.env.ADMIN_SECRET;
    const admin = await verifyAdminSession();

    let authMethod: string;
    let adminId: string | null = null;

    if (admin) {
        // 使用 admin session 鉴权
        authMethod = "admin_session";
        adminId = admin.adminId;
    } else if (secret && authHeader?.startsWith("Bearer ")) {
        // 使用 ADMIN_SECRET 鉴权（定时任务等）
        const provided = authHeader.slice(7);
        if (safeTimingEqual(provided, secret)) {
            authMethod = "ADMIN_SECRET";
        } else {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    } else {
        logger.warn("[Cleanup] 鉴权失败：既无有效 admin session，也无正确的 ADMIN_SECRET");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 与 data-cleanup 同源：以 expiresAt 为过期判据（expiresAt 缺失时用 createdAt 24h 兑底）。
        // 原按 createdAt 清理会提前删除仍在"完成+1h"免费回看期内有效的报告。
        // 注意：兑底时限与 data-cleanup 保持一致（24 小时）。
        const nowDate = new Date();
        const nullExpiryFallback = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000);

        // 2. 查找过期的游客会话 (没有绑定 userId)，分批处理避免参数超限
        const DB_BATCH_SIZE = 500;
        let totalDeletedSessions = 0;
        let totalDeletedTestRecords = 0;
        let hasMore = true;
        let processedCount = 0;

        while (hasMore) {
            const guestSessions = await prisma.advisorSession.findMany({
                where: {
                    userId: null,
                    OR: [
                        { expiresAt: { lt: nowDate } },
                        { expiresAt: null, createdAt: { lt: nullExpiryFallback } },
                    ],
                },
                select: {
                    sessionId: true
                },
                take: DB_BATCH_SIZE,
            });

            if (guestSessions.length === 0) {
                hasMore = false;
                break;
            }

            processedCount += guestSessions.length;
            const sessionIds = guestSessions.map(s => s.sessionId);

            // 3. 执行数据库事务物理删除
            const deletedStats = await prisma.$transaction(async (tx) => {
                const testRecords = await tx.testRecord.deleteMany({
                    where: {
                        userId: null,
                        sessionId: { in: sessionIds }
                    }
                });

                const sessions = await tx.advisorSession.deleteMany({
                    where: { sessionId: { in: sessionIds } }
                });

                return {
                    sessions: sessions.count,
                    testRecords: testRecords.count
                };
            });

            totalDeletedSessions += deletedStats.sessions;
            totalDeletedTestRecords += deletedStats.testRecords;

            // If we got fewer than batch size, we're done
            if (guestSessions.length < DB_BATCH_SIZE) {
                hasMore = false;
            }
        }

        if (processedCount === 0) {
            return NextResponse.json({ 
                success: true, 
                message: "没有发现过期的游客数据",
                deletedCount: 0 
            });
        }

        const deletedStats = {
            sessions: totalDeletedSessions,
            testRecords: totalDeletedTestRecords,
        };

        // Audit log
        await logAdminAction({
            adminId: adminId,
            action: "cleanup_guests",
            resource: "AdvisorSession",
            details: {
                dbStats: deletedStats,
                threshold: nowDate.toISOString(),
                authMethod: authMethod,
            },
            ip: ip,
            userAgent: req.headers.get("user-agent") || "unknown",
        });

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            message: `成功清理已过期的游客数据（expiresAt < ${nowDate.toISOString()}）`,
            data: {
                dbStats: deletedStats
            }
        });

    } catch (error: unknown) {
        logger.error("[Cleanup Global Error]:", error);
        return NextResponse.json({
            success: false,
            error: "清理失败"
        }, { status: 500 });
    }
}

function safeTimingEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
        return false;
    }
}
