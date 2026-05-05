import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteOSSFiles } from "@/lib/ali-oss";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

/**
 * POST /api/admin/cleanup-guests
 * 自动清理超过 3 小时的游客数据
 * 必须携带 Authorization: Bearer <ADMIN_SECRET>
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

    // 1. 安全校验 (由环境变量控制密钥，防止外部恶意扫描触发)
    const authHeader = req.headers.get("authorization");
    const secret = process.env.ADMIN_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
        console.warn("[Cleanup] 鉴权失败或 ADMIN_SECRET 未在 .env 设定");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 计算 3 小时前的时间点
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

        // 2. 查找过期的游客会话 (没有绑定 userId)
        const guestSessions = await prisma.advisorSession.findMany({
            where: {
                userId: null,
                createdAt: { lt: threeHoursAgo }
            },
            select: {
                sessionId: true,
                analysisResult: true
            }
        });

        if (guestSessions.length === 0) {
            return NextResponse.json({ 
                success: true, 
                message: "没有发现过期的游客数据",
                deletedCount: 0 
            });
        }

        const sessionIds = guestSessions.map(s => s.sessionId);
        
        // 3. 提取所有关联的 OSS 图片 URL (主要用于批量删除头像)
        const urlsToDelete: string[] = [];
        guestSessions.forEach(session => {
            const result = session.analysisResult as Record<string, unknown>;
            if (result?.generatedAvatar && typeof result.generatedAvatar === 'string' && result.generatedAvatar.startsWith('http')) {
                urlsToDelete.push(result.generatedAvatar);
            }
        });

        // 4. 执行数据库事务物理删除
        const deletedStats = await prisma.$transaction(async (tx) => {
            // A. 删除过期的测试记录 (针对无 userId 的旧记录)
            const testRecords = await tx.testRecord.deleteMany({
                where: {
                    userId: null,
                    sessionId: { in: sessionIds }
                }
            });

            // B. 最后删除会话主表
            const sessions = await tx.advisorSession.deleteMany({
                where: { sessionId: { in: sessionIds } }
            });

            return {
                sessions: sessions.count,
                testRecords: testRecords.count
            };
        });

        // 5. 异步调用 OSS 批量删除 API
        let ossDeleted = 0;
        if (urlsToDelete.length > 0) {
            try {
                await deleteOSSFiles(urlsToDelete);
                ossDeleted = urlsToDelete.length;
            } catch (ossError) {
                console.error("[Cleanup OSS Error]:", ossError);
                // OSS 删失败不回滚 DB，因为数据合规优先
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            message: `成功清理 ${threeHoursAgo.toISOString()} 之前的游客数据`,
            data: {
                dbStats: deletedStats,
                ossFilesDeleted: ossDeleted
            }
        });

    } catch (error: unknown) {
        console.error("[Cleanup Global Error]:", error);
        return NextResponse.json({
            success: false,
            error: "清理失败"
        }, { status: 500 });
    }
}
