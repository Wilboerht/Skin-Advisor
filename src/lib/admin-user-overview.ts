/**
 * 管理端用户测肤概览（主站控制中台 → 子站内部接口）
 *
 * 只汇总客服/运营需要的状态与近期摘要：
 * - 子站本地账号状态、管理员自定义配额
 * - 测肤用量（复用 getSkinTestUsageSummary，主站可传会员覆盖）
 * - 最近测肤记录与打卡（不含问卷答案、日记备注）
 *
 * userId 为主站 SSO sub，与子站 User.id 相同。
 */
import prisma from "@/lib/prisma";
import {
    getSkinTestUsageSummary,
    type SkinTestUsageMembershipOverride,
    type SkinTestUsageSummary,
} from "@/lib/usage-limit";
import { extractSessionLite } from "@/lib/session-lite";

const RECENT_SESSIONS_LIMIT = 10;
const RECENT_DIARY_LIMIT = 7;

export interface AdminUserOverviewAccount {
    role: string;
    dailyTestLimit: number;
    createdAt: string;
    lastActiveAt: string | null;
}

export interface AdminUserOverviewSession {
    sessionId: string;
    createdAt: string;
    completedAt: string | null;
    overallScore: number | null;
    skinTypeLabel: string | null;
}

export interface AdminUserOverviewDiary {
    date: string;
    skinState: string;
    tags: string[];
}

export interface AdminUserOverview {
    account: AdminUserOverviewAccount | null;
    usage: SkinTestUsageSummary;
    counts: {
        sessions: number;
        completedSessions: number;
        diaryEntries: number;
    };
    recentSessions: AdminUserOverviewSession[];
    recentDiary: AdminUserOverviewDiary[];
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function latestDate(values: Array<Date | null | undefined>): Date | null {
    let latest: Date | null = null;
    for (const value of values) {
        if (value && (!latest || value.getTime() > latest.getTime())) {
            latest = value;
        }
    }
    return latest;
}

export async function getAdminUserOverview(
    userId: string,
    membership?: SkinTestUsageMembershipOverride
): Promise<AdminUserOverview> {
    const [user, usage, sessionCount, completedCount, diaryCount, recentSessions, recentDiary] =
        await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    role: true,
                    dailyTestLimit: true,
                    createdAt: true,
                },
            }),
            getSkinTestUsageSummary(userId, membership),
            prisma.advisorSession.count({ where: { userId } }),
            prisma.advisorSession.count({ where: { userId, completedAt: { not: null } } }),
            prisma.diaryEntry.count({ where: { userId } }),
            prisma.advisorSession.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: RECENT_SESSIONS_LIMIT,
                select: {
                    sessionId: true,
                    createdAt: true,
                    completedAt: true,
                    analysisResult: true,
                },
            }),
            prisma.diaryEntry.findMany({
                where: { userId },
                orderBy: { date: "desc" },
                take: RECENT_DIARY_LIMIT,
                select: {
                    date: true,
                    skinState: true,
                    tags: true,
                    updatedAt: true,
                },
            }),
        ]);

    const lastActiveAt = latestDate([
        recentSessions[0]?.createdAt,
        ...recentDiary.map((entry) => entry.updatedAt),
    ]);

    return {
        account: user
            ? {
                  role: user.role,
                  dailyTestLimit: user.dailyTestLimit,
                  createdAt: user.createdAt.toISOString(),
                  lastActiveAt: lastActiveAt?.toISOString() ?? null,
              }
            : null,
        usage,
        counts: {
            sessions: sessionCount,
            completedSessions: completedCount,
            diaryEntries: diaryCount,
        },
        recentSessions: recentSessions.map((session) => {
            const lite = extractSessionLite(session.analysisResult);
            return {
                sessionId: session.sessionId,
                createdAt: session.createdAt.toISOString(),
                completedAt: session.completedAt?.toISOString() ?? null,
                overallScore: lite.score,
                skinTypeLabel: lite.typeLabel,
            };
        }),
        recentDiary: recentDiary.map((entry) => ({
            date: entry.date.toISOString().slice(0, 10),
            skinState: entry.skinState,
            tags: toStringArray(entry.tags),
        })),
    };
}
