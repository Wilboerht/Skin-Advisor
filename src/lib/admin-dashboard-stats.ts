import prisma from "@/lib/prisma";
import { startOfTodayShanghai } from "@/lib/time";
import { logger } from "@/lib/logger";

export interface AdminDashboardOverview {
    totalUsers: number;
    totalProducts: number;
    totalSessions: number;
    completedSessions: number;
    todaySessions: number;
    todayCompletions: number;
    completionRate: number;
}

export interface AdminSkinTypeDistributionItem {
    key: string;
    name: string;
    value: number;
    fill: string;
}

export interface AdminWeeklyGrowthItem {
    day: string;
    started: number;
    completed: number;
}

export interface AdminDashboardStats {
    overview: AdminDashboardOverview;
    skinTypeDistribution: AdminSkinTypeDistributionItem[];
    weeklyGrowth: AdminWeeklyGrowthItem[];
}

const VALID_SKIN_TYPES = [
    "dry",
    "oily",
    "combination",
    "combination_dry",
    "combination_oily",
    "sensitive",
    "normal",
] as const;

const SKIN_TYPE_LABELS: Record<string, string> = {
    dry: "Dry",
    oily: "Oily",
    combination: "Combination",
    combination_dry: "Combination Dry",
    combination_oily: "Combination Oily",
    sensitive: "Sensitive",
    normal: "Normal",
};

function getSkinTypeColor(type: string): string {
    const colors: Record<string, string> = {
        dry: "#5B8FB9",
        oily: "#C19F70",
        combination: "#8B7355",
        combination_dry: "#4E8C87",
        combination_oily: "#6B8E9E",
        sensitive: "#D97706",
        normal: "#3D4430",
    };
    return colors[type] || "#6B7280";
}

/**
 * 子站管理端仪表盘统计（admin stats 路由与主站控制中台内部接口共用）
 */
export async function getAdvisorDashboardStats(): Promise<AdminDashboardStats> {
    const [totalUsers, totalProducts, totalSessions, completedSessions] = await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.advisorSession.count(),
        prisma.advisorSession.count({ where: { completedAt: { not: null } } }),
    ]);

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
        logger.warn(
            "[admin-dashboard-stats] skin type aggregation failed, degrading to empty distribution:",
            error
        );
    }

    const skinTypeCount: Record<string, number> = Object.fromEntries(
        VALID_SKIN_TYPES.map((type) => [type, 0])
    );
    for (const row of skinTypeRaw) {
        const type = row.skin_type;
        if (type && (VALID_SKIN_TYPES as readonly string[]).includes(type)) {
            const count = Number(row.count);
            skinTypeCount[type] = Number.isFinite(count) && count >= 0 ? count : 0;
        }
    }

    const skinTypeDistribution: AdminSkinTypeDistributionItem[] = Object.entries(
        skinTypeCount
    ).map(([key, value]) => ({
        key,
        name: SKIN_TYPE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
        value,
        fill: getSkinTypeColor(key),
    }));

    const timezone = "Asia/Shanghai";
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let weeklyRaw: Array<{ day: string; started: bigint; completed: bigint }> = [];
    try {
        weeklyRaw = await prisma.$queryRaw<
            Array<{ day: string; started: bigint; completed: bigint }>
        >`
            SELECT
                TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}, 'YYYY-MM-DD') as day,
                COUNT(*) as started,
                COUNT("completedAt") as completed
            FROM "AdvisorSession"
            WHERE "createdAt" >= ${weekAgo}
            GROUP BY 1
            ORDER BY day
        `;
    } catch (error) {
        logger.warn(
            "[admin-dashboard-stats] weekly trend aggregation failed, degrading to zero trend:",
            error
        );
    }

    const weeklyData: Record<string, { started: number; completed: number }> = {};
    const getShanghaiDayName = (dateInput: Date | string) => {
        const date =
            typeof dateInput === "string" ? new Date(dateInput + "T12:00:00+08:00") : dateInput;
        return date.toLocaleDateString("en-US", { timeZone: timezone, weekday: "short" });
    };

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        weeklyData[getShanghaiDayName(date)] = { started: 0, completed: 0 };
    }

    for (const row of weeklyRaw) {
        const dayName = getShanghaiDayName(row.day);
        if (weeklyData[dayName]) {
            weeklyData[dayName].started = Number(row.started);
            weeklyData[dayName].completed = Number(row.completed);
        }
    }

    const weeklyGrowth: AdminWeeklyGrowthItem[] = Object.entries(weeklyData).map(
        ([day, data]) => ({
            day,
            started: data.started,
            completed: data.completed,
        })
    );

    const todayStart = startOfTodayShanghai();
    const [todaySessions, todayCompletions] = await Promise.all([
        prisma.advisorSession.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.advisorSession.count({ where: { completedAt: { gte: todayStart } } }),
    ]);

    return {
        overview: {
            totalUsers,
            totalProducts,
            totalSessions,
            completedSessions,
            todaySessions,
            todayCompletions,
            completionRate:
                totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        },
        skinTypeDistribution,
        weeklyGrowth,
    };
}
