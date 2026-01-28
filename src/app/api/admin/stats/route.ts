
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
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

        // ===== 肤质分布 (从已完成的分析结果中提取) =====
        const sessionsWithSkinType = await prisma.advisorSession.findMany({
            where: {
                NOT: { analysisResult: { equals: undefined } }
            },
            select: {
                analysisResult: true
            },
            take: 1000 // Limit for performance
        });

        const skinTypeCount: Record<string, number> = {
            'dry': 0,
            'oily': 0,
            'combination': 0,
            'sensitive': 0,
            'normal': 0
        };

        sessionsWithSkinType.forEach(session => {
            const result = session.analysisResult as any;
            if (result?.skinType) {
                const type = result.skinType.toLowerCase();
                if (skinTypeCount[type] !== undefined) {
                    skinTypeCount[type]++;
                }
            }
        });

        const skinTypeDistribution = Object.entries(skinTypeCount).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            fill: getSkinTypeColor(name)
        }));

        // ===== 周趋势 (最近7天每天的测肤次数) =====
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recentSessions = await prisma.advisorSession.findMany({
            where: {
                createdAt: { gte: weekAgo }
            },
            select: {
                createdAt: true,
                completedAt: true
            }
        });

        const weeklyData: Record<string, { started: number; completed: number }> = {};
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Initialize all 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayName = days[d.getDay()];
            weeklyData[dayName] = { started: 0, completed: 0 };
        }

        recentSessions.forEach(s => {
            const dayName = days[new Date(s.createdAt).getDay()];
            if (weeklyData[dayName]) {
                weeklyData[dayName].started++;
                if (s.completedAt) {
                    weeklyData[dayName].completed++;
                }
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
