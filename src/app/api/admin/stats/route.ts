
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

// GET /api/admin/stats - Dashboard statistics
// Available to super_admin and admin
export const GET = withAdminAuth(async (request: NextRequest) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-stats-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        // ===== 基础统计 =====
        const [
            totalUsers,
            totalProducts,
            totalSessions,
            completedSessions
        ] = await Promise.all([
            prisma.user.count(),
            prisma.product.count(),
            prisma.advisorSession.count(),
            prisma.advisorSession.count({ where: { completedAt: { not: null } } }),
        ]);

        // ===== 肤质分布 (使用 SQL 在数据库端聚合，避免全表加载到内存) =====
        // 注意：数据实际存储在 analysisResult->skinProfile->type，不是根级的 skinType
        const skinTypeRaw = await prisma.$queryRaw<Array<{ skin_type: string; count: bigint }>>`
            SELECT 
                LOWER("analysisResult"->'skinProfile'->>'type') as skin_type,
                COUNT(*) as count
            FROM "AdvisorSession"
            WHERE "analysisResult" IS NOT NULL 
              AND "analysisResult"->'skinProfile'->>'type' IS NOT NULL
            GROUP BY LOWER("analysisResult"->'skinProfile'->>'type')
        `;

        const validSkinTypes = ['dry', 'oily', 'combination', 'sensitive', 'normal'];
        const skinTypeCount: Record<string, number> = {
            'dry': 0, 'oily': 0, 'combination': 0, 'sensitive': 0, 'normal': 0
        };

        skinTypeRaw.forEach(row => {
            const type = row.skin_type;
            if (type && validSkinTypes.includes(type)) {
                // Safe BigInt → Number conversion with overflow guard
                const n = Number(row.count);
                skinTypeCount[type] = Number.isFinite(n) && n >= 0 ? n : 0;
            }
        });

        const skinTypeDistribution = Object.entries(skinTypeCount).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            fill: getSkinTypeColor(name)
        }));

        // ===== 周趋势 (使用 SQL 在数据库端按日期分组) =====
        const TIMEZONE = 'Asia/Shanghai';
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const weeklyRaw = await prisma.$queryRaw<Array<{ day: string; started: bigint; completed: bigint }>>`
            SELECT 
                TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD') as day,
                COUNT(*) as started,
                COUNT("completedAt") as completed
            FROM "AdvisorSession"
            WHERE "createdAt" >= ${weekAgo}
            GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD')
            ORDER BY day
        `;

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weeklyData: Record<string, { started: number; completed: number }> = {};

        // Helper to get day name in Asia/Shanghai timezone
        const getShanghaiDayName = (dateInput: Date | string) => {
            const d = typeof dateInput === 'string'
                ? new Date(dateInput + 'T12:00:00+08:00')
                : dateInput;
            return d.toLocaleDateString('en-US', { timeZone: TIMEZONE, weekday: 'short' });
        };

        // Initialize all 7 days using Shanghai timezone
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayName = getShanghaiDayName(d);
            weeklyData[dayName] = { started: 0, completed: 0 };
        }

        weeklyRaw.forEach(row => {
            const dayName = getShanghaiDayName(row.day);
            if (weeklyData[dayName]) {
                weeklyData[dayName].started = Number(row.started);
                weeklyData[dayName].completed = Number(row.completed);
            }
        });

        const weeklyGrowth = Object.entries(weeklyData).map(([day, data]) => ({
            day,
            started: data.started,
            completed: data.completed
        }));

        // ===== 今日数据 (使用 Asia/Shanghai 时区) =====
        const nowShanghai = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
        const todayStart = new Date(nowShanghai);
        todayStart.setHours(0, 0, 0, 0);

        const [todaySessions, todayCompletions] = await Promise.all([
            prisma.advisorSession.count({
                where: { createdAt: { gte: todayStart } }
            }),
            prisma.advisorSession.count({
                where: { completedAt: { gte: todayStart } }
            })
        ]);

        return NextResponse.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    totalProducts,
                    totalSessions,
                    completedSessions,
                    todaySessions,
                    todayCompletions,
                    completionRate: totalSessions > 0
                        ? Math.round((completedSessions / totalSessions) * 100)
                        : 0
                },
                skinTypeDistribution,
                weeklyGrowth
            }
        });

    } catch (error) {
        console.error("Failed to fetch stats:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});

function getSkinTypeColor(type: string): string {
    const colors: Record<string, string> = {
        'dry': '#5B8FB9',
        'oily': '#C19F70',
        'combination': '#1B3A5C',
        'sensitive': '#D97706',
        'normal': '#1B3A5C'
    };
    return colors[type] || '#6B7280';
}
