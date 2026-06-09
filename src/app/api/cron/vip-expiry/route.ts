import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * VIP 过期自动降级 Cron Job
 * 
 * 功能：
 * - 查找所有 role='vip' 且 vipExpiresAt 已过期的用户
 * - 将其 role 自动回退为 'user'
 * - 记录降级日志
 * 
 * 调用方式：
 * - Linux Crontab: 0 2 * * * curl "https://your-domain/api/cron/vip-expiry?secret=YOUR_CRON_SECRET"
 * - 手动: GET /api/cron/vip-expiry?secret=YOUR_CRON_SECRET
 * 
 * 安全：
 * - 需要 CRON_SECRET 验证
 */

export const maxDuration = 30; // 防止超时

export async function GET(request: NextRequest) {
    try {
        // 1. 安全验证
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret) {
            // 生产环境: 严格校验 secret
            const isValidHeader = authHeader === `Bearer ${cronSecret}`;
            const isValidQuery = request.nextUrl.searchParams.get("secret") === cronSecret;

            if (!isValidHeader && !isValidQuery) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
        } else if (process.env.NODE_ENV === "production") {
            // 生产环境没有配置 CRON_SECRET = 拒绝访问
            return NextResponse.json(
                { error: "CRON_SECRET not configured" },
                { status: 500 }
            );
        }
        // 开发环境无 CRON_SECRET 时允许直接访问（方便测试）

        // 2. 查找过期的 VIP 用户
        const now = new Date();

        const expiredVipUsers = await prisma.user.findMany({
            where: {
                role: "vip",
                vipExpiresAt: {
                    not: null,
                    lt: now, // 过期时间早于当前时间
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                vipExpiresAt: true,
            },
        });

        if (expiredVipUsers.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No expired VIP users found",
                downgraded: 0,
                checkedAt: now.toISOString(),
            });
        }

        // 3. 批量降级
        const expiredIds = expiredVipUsers.map((u) => u.id);

        const updateResult = await prisma.user.updateMany({
            where: {
                id: { in: expiredIds },
            },
            data: {
                role: "user",
            },
        });

        // 4. 日志记录
        const logDetails = expiredVipUsers.map((u) => ({
            id: u.id,
            name: u.name,
            expiredAt: u.vipExpiresAt?.toISOString(),
        }));


        // 5. 返回结果
        return NextResponse.json({
            success: true,
            message: `Downgraded ${updateResult.count} expired VIP users`,
            downgraded: updateResult.count,
            users: logDetails,
            checkedAt: now.toISOString(),
        });

    } catch (error: unknown) {
        console.error("[VIP-Cron] ❌ Cron job failed:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal error",
            },
            { status: 500 }
        );
    }
}
