
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { startOfTodayShanghai } from "@/lib/time";
import { logger } from "@/lib/logger";

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
        // 新版数据在 analysisResult->skinProfile->type；旧版兼容 skinAnalysis.type/skinType。
        // raw SQL 容错：聚合查询失败时降级为空分布，
        // 不让仪表盘整体 500（基础统计仍可展示）
        let skinTypeRaw: Array<{ skin_type: string; count: bigint }> = [];
        try {
            skinTypeRaw = await prisma.$queryRaw<Array<{ skin_type: string; count: bigint }>>`
            SELECT 
                LOWER(COALESCE(
                    "analysisResult"->'skinProfile'->>'type',
                    "analysisResult"->'skinAnalysis'->>'type',
                    "analysisResult"->'skinAnalysis'->>'skinType'
                )) as skin_type,
                COUNT(*) as count
            FROM "AdvisorSession"
            WHERE "analysisResult" IS NOT NULL
            GROUP BY 1
            HAVING LOWER(COALESCE(
                "analysisResult"->'skinProfile'->>'type',
                "analysisResult"->'skinAnalysis'->>'type',
                "analysisResult"->'skinAnalysis'->>'skinType'
            )) IS NOT NULL
        `;
        } catch (error) {
            logger.warn("[admin/stats] skin type aggregation failed, degrading to empty distribution:", error);
        }

        const validSkinTypes = [
            'dry', 'oily', 'combination', 'combination_dry', 'combination_oily', 'sensitive', 'normal',
        ];
        const skinTypeCount: Record<string, number> = {
            'dry': 0,
            'oily': 0,
            'combination': 0,
            'combination_dry': 0,
            'combination_oily': 0,
            'sensitive': 0,
            'normal': 0,
        };

        skinTypeRaw.forEach(row => {
            const type = row.skin_type;
            if (type && validSkinTypes.includes(type)) {
                // Safe BigInt → Number conversion with overflow guard
                const n = Number(row.count);
                skinTypeCount[type] = Number.isFinite(n) && n >= 0 ? n : 0;
            }
        });

        const skinTypeLabels: Record<string, string> = {
            dry: 'Dry',
            oily: 'Oily',
            combination: 'Combination',
            combination_dry: 'Combination Dry',
            combination_oily: 'Combination Oily',
            sensitive: 'Sensitive',
            normal: 'Normal',
        };

        const skinTypeDistribution = Object.entries(skinTypeCount).map(([name, value]) => ({
            name: skinTypeLabels[name] || name.charAt(0).toUpperCase() + name.slice(1),
            value,
            fill: getSkinTypeColor(name)
        }));

        // ===== 周趋势 (使用 SQL 在数据库端按日期分组) =====
        const TIMEZONE = 'Asia/Shanghai';
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 同样容错：周趋势聚合失败时降级为零值趋势，不影响基础统计展示
        let weeklyRaw: Array<{ day: string; started: bigint; completed: bigint }> = [];
        try {
            weeklyRaw = await prisma.$queryRaw<Array<{ day: string; started: bigint; completed: bigint }>>`
            SELECT 
                TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD') as day,
                COUNT(*) as started,
                COUNT("completedAt") as completed
            FROM "AdvisorSession"
            WHERE "createdAt" >= ${weekAgo}
            GROUP BY 1
            ORDER BY day
        `;
        } catch (error) {
            logger.warn("[admin/stats] weekly trend aggregation failed, degrading to zero trend:", error);
        }

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
        // 直接计算北京时间当日零点的 UTC 绝对时刻，
        // 避免 toLocaleString 再二次解析带来的漂移与本地时区依赖
        const todayStart = startOfTodayShanghai();

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
        logger.error("Failed to fetch stats:", error);
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
        'combination': '#8B7355',
        'combination_dry': '#4E8C87',
        'combination_oily': '#6B8E9E',
        'sensitive': '#D97706',
        'normal': '#3D4430'
    };
    return colors[type] || '#6B7280';
}
