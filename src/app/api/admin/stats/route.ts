
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // ===== 基础统计 =====
        const [
            totalUsers,
            totalProducts,
            totalSessions,
            pendingRewards,
            completedSessions
        ] = await Promise.all([
            prisma.user.count(),
            prisma.product.count(),
            prisma.advisorSession.count(),
            prisma.shareReward.count({ where: { status: 'pending' } }),
            prisma.advisorSession.count({ where: { completedAt: { not: null } } }),
        ]);

        // ===== 肤质分布 (使用 SQL 在数据库端聚合，避免全表加载到内存) =====
        const skinTypeRaw = await prisma.$queryRaw<Array<{ skin_type: string; count: bigint }>>`
            SELECT 
                LOWER("analysisResult"->>'skinType') as skin_type,
                COUNT(*) as count
            FROM "AdvisorSession"
            WHERE "analysisResult" IS NOT NULL 
              AND "analysisResult"->>'skinType' IS NOT NULL
            GROUP BY LOWER("analysisResult"->>'skinType')
        `;

        const validSkinTypes = ['dry', 'oily', 'combination', 'sensitive', 'normal'];
        const skinTypeCount: Record<string, number> = {
            'dry': 0, 'oily': 0, 'combination': 0, 'sensitive': 0, 'normal': 0
        };

        skinTypeRaw.forEach(row => {
            const type = row.skin_type;
            if (type && validSkinTypes.includes(type)) {
                skinTypeCount[type] = Number(row.count);
            }
        });

        const skinTypeDistribution = Object.entries(skinTypeCount).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            fill: getSkinTypeColor(name)
        }));

        // ===== 周趋势 (使用 SQL 在数据库端按日期分组) =====
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const weeklyRaw = await prisma.$queryRaw<Array<{ day: Date; started: bigint; completed: bigint }>>`
            SELECT 
                DATE("createdAt") as day,
                COUNT(*) as started,
                COUNT("completedAt") as completed
            FROM "AdvisorSession"
            WHERE "createdAt" >= ${weekAgo}
            GROUP BY DATE("createdAt")
            ORDER BY day
        `;

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weeklyData: Record<string, { started: number; completed: number }> = {};

        // Initialize all 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayName = days[d.getDay()];
            weeklyData[dayName] = { started: 0, completed: 0 };
        }

        weeklyRaw.forEach(row => {
            const dayName = days[new Date(row.day).getDay()];
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

        // ===== 今日数据 =====
        const todayStart = new Date();
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
                    pendingRewards,
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
}

function getSkinTypeColor(type: string): string {
    const colors: Record<string, string> = {
        'dry': '#5B8FB9',
        'oily': '#C19F70',
        'combination': '#8B7355',
        'sensitive': '#D97706',
        'normal': '#3D4430'
    };
    return colors[type] || '#6B7280';
}
