/**
 * Shared leaderboard logic — used by both the API route and server components
 * to avoid self-referencing HTTP fetches.
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

// ===== Types =====
export interface ScoredSession {
    sessionId: string;
    nickname: string;
    city: string;
    score: number;
    popularity: number;
}

export interface LeaderboardEntry {
    rank: number;
    nickname: string;
    city: string;
    score: number;
    sessionId: string;
}

export interface PopularityEntry {
    rank: number;
    nickname: string;
    city: string;
    popularity: number;
    sessionId: string;
}

export interface UserRankInfo {
    rank: number;
    percentile: number;
    totalParticipants: number;
}

// ===== Deterministic Hash =====
function deterministicHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// ===== Deterministic Nickname Generator =====
export function generateRandomNickname(seed: string): string {
    const adjectives = ["可爱的", "阳光", "元气", "甜美", "活力", "清新", "温柔", "俏皮", "优雅", "时尚"];
    const nouns = ["小可爱", "宝贝", "达人", "精灵", "女神", "仙子", "小天使", "小公主", "少女", "美眉"];

    const hash = deterministicHash(seed);
    return adjectives[hash % adjectives.length] + nouns[(hash >> 4) % nouns.length];
}

// ===== Database Direct Queries =====
export const loadTopScores = unstable_cache(
    async (limit: number = 50): Promise<LeaderboardEntry[]> => {
        // 强制使用 DB 级别的 SORT 以防内存溢出，直接从 JSON 中解析分数
        const rows = await prisma.$queryRaw<any[]>`
            SELECT 
                s."sessionId",
                s."city",
                s."province",
                s."analysisResult",
                u."name" as "userName",
                COALESCE(
                    NULLIF(TRIM(s."analysisResult"->'faceAnalysis'->>'overallScore'), ''),
                    NULLIF(TRIM(s."analysisResult"->'skinAnalysis'->>'score'), ''),
                    '0'
                )::float as "calculatedScore"
            FROM "AdvisorSession" s
            LEFT JOIN "User" u ON s."userId" = u."id"
            WHERE s."analysisResult" IS NOT NULL
              AND s."createdAt" >= NOW() - INTERVAL '30 days'
            ORDER BY "calculatedScore" DESC NULLS LAST
            LIMIT ${limit}
        `;

        return rows.map((row, idx) => {
            const result = typeof row.analysisResult === 'string' ? JSON.parse(row.analysisResult) : (row.analysisResult || {});
            const hasRealNickname = !!(result.nickname || row.userName);
            const hasRealCity = !!(result.userLocation?.city || row.city || row.province);

            const nickname = hasRealNickname ? (result.nickname || row.userName) : generateRandomNickname(row.sessionId);
            const city = hasRealCity ? (result.userLocation?.city || row.city || row.province) : "未知城市";

            return {
                rank: idx + 1,
                sessionId: row.sessionId,
                nickname,
                city,
                score: Math.round((row.calculatedScore || 0) * 10) / 10
            };
        });
    },
    ['leaderboard-top-scores'],
    { revalidate: 300 }
);

export const loadTopPopularity = unstable_cache(
    async (limit: number = 50): Promise<PopularityEntry[]> => {
        // 强制使用 DB 级别的 SORT 处理人气计算，保证性能与全量数据正确性
        const rows = await prisma.$queryRaw<any[]>`
            SELECT 
                s."sessionId",
                s."city",
                s."province",
                s."analysisResult",
                u."name" as "userName",
                (
                    100 +
                    CASE WHEN (s."analysisResult"->>'nickname' IS NOT NULL OR s."userId" IS NOT NULL) THEN 50 ELSE 0 END +
                    CASE WHEN (s."analysisResult"->'userLocation'->>'city' IS NOT NULL OR s."city" IS NOT NULL OR s."province" IS NOT NULL) THEN 50 ELSE 0 END +
                    CASE WHEN s."resultShared" = true THEN 3000 ELSE 0 END +
                    GREATEST(0, ROUND(CAST(500 * (1 - EXTRACT(EPOCH FROM (NOW() - s."createdAt")) / (30 * 24 * 3600)) AS NUMERIC), 0))
                ) as "calculatedPopularity"
            FROM "AdvisorSession" s
            LEFT JOIN "User" u ON s."userId" = u."id"
            WHERE s."analysisResult" IS NOT NULL
            AND s."createdAt" >= NOW() - INTERVAL '30 days'
            ORDER BY "calculatedPopularity" DESC NULLS LAST
            LIMIT ${limit}
        `;

        return rows.map((row, idx) => {
            const result = typeof row.analysisResult === 'string' ? JSON.parse(row.analysisResult) : (row.analysisResult || {});
            const hasRealNickname = !!(result.nickname || row.userName);
            const hasRealCity = !!(result.userLocation?.city || row.city || row.province);

            const nickname = hasRealNickname ? (result.nickname || row.userName) : generateRandomNickname(row.sessionId);
            const city = hasRealCity ? (result.userLocation?.city || row.city || row.province) : "未知城市";

            return {
                rank: idx + 1,
                sessionId: row.sessionId,
                nickname,
                city,
                popularity: parseInt(row.calculatedPopularity) || 0
            };
        });
    },
    ['leaderboard-top-popularity'],
    { revalidate: 300 }
);

export const getTotalParticipants = unstable_cache(
    async (): Promise<number> => {
        const result = await prisma.$queryRaw<[{ count: number | bigint }]>`
            SELECT COUNT(*) as count
            FROM "AdvisorSession"
            WHERE "analysisResult" IS NOT NULL
            AND "createdAt" >= NOW() - INTERVAL '30 days'
        `;
        return Number(result[0]?.count || 0);
    },
    ['leaderboard-total-participants'],
    { revalidate: 300 }
);

// ===== Rank Calculation =====
/**
 * Calculate the rank of a specific session within the leaderboard directly from the DB.
 */
export async function calculateUserRank(sessionId: string): Promise<UserRankInfo> {
    try {
        const total = await getTotalParticipants();
        if (total === 0) {
            return { rank: 1, percentile: 90, totalParticipants: 1 };
        }

        // 1. 获取该用户自身的分数
        const userRow = await prisma.$queryRaw<any[]>`
            SELECT COALESCE(
                NULLIF(TRIM("analysisResult"->'faceAnalysis'->>'overallScore'), ''),
                NULLIF(TRIM("analysisResult"->'skinAnalysis'->>'score'), ''),
                '0'
            )::float as "calculatedScore"
            FROM "AdvisorSession"
            WHERE "sessionId" = ${sessionId}
              AND "analysisResult" IS NOT NULL
            LIMIT 1
        `;

        if (!userRow || userRow.length === 0) {
            return { rank: total, percentile: 10, totalParticipants: total };
        }

        const userScore = userRow[0].calculatedScore || 0;

        // 2. 统计分数严格大于该用户的人数
        const higherRow = await prisma.$queryRaw<any[]>`
            SELECT COUNT(*) as count
            FROM "AdvisorSession"
            WHERE "analysisResult" IS NOT NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
              AND COALESCE(
                    NULLIF(TRIM("analysisResult"->'faceAnalysis'->>'overallScore'), ''),
                    NULLIF(TRIM("analysisResult"->'skinAnalysis'->>'score'), ''),
                    '0'
                )::float > ${userScore}
        `;

        const higherCount = Number(higherRow[0]?.count || 0);
        const rank = higherCount + 1;
        const percentile = Math.round(((total - rank) / Math.max(total, 1)) * 100);

        return {
            rank,
            percentile: Math.max(1, Math.min(99, percentile)), // Cap between 1 and 99
            totalParticipants: total
        };
    } catch (e) {
        console.error("Failed to calculate user rank via SQL:", e);
        return { rank: 999, percentile: 10, totalParticipants: 1000 };
    }
}
