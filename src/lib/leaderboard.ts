/**
 * Shared leaderboard logic — used by both the API route and server components
 * to avoid self-referencing HTTP fetches.
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

// ===== In-Memory Cache (5 min TTL) =====
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedSessions: ScoredSession[] | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
    return cachedSessions !== null && (Date.now() - cacheTimestamp) < CACHE_TTL_MS;
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

// ===== Deterministic Popularity =====
function calculatePopularity(
    sessionId: string,
    resultShared: boolean,
    createdAt: Date
): number {
    const baseScore = (deterministicHash(sessionId) % 2000) + 100;
    const shareBonus = resultShared ? 3000 : 0;
    const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, Math.round(500 * (1 - ageDays / 30)));
    return baseScore + shareBonus + recencyBonus;
}

// ===== Deterministic Nickname Generator =====
export function generateRandomNickname(seed: string): string {
    const adjectives = ["可爱的", "阳光", "元气", "甜美", "活力", "清新", "温柔", "俏皮", "优雅", "时尚"];
    const nouns = ["小可爱", "宝贝", "达人", "精灵", "女神", "仙子", "小天使", "小公主", "少女", "美眉"];

    const hash = deterministicHash(seed);
    return adjectives[hash % adjectives.length] + nouns[(hash >> 4) % nouns.length];
}

// ===== Data Loading with Cache =====
export async function loadScoredSessions(): Promise<ScoredSession[]> {
    if (isCacheValid()) {
        return cachedSessions!;
    }

    const sessions = await prisma.advisorSession.findMany({
        where: {
            analysisResult: {
                not: Prisma.JsonNull
            },
            createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        },
        select: {
            sessionId: true,
            analysisResult: true,
            city: true,
            province: true,
            resultShared: true,
            createdAt: true,
            user: {
                select: {
                    name: true
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        },
        take: 500 // Cap to prevent unbounded memory growth
    });

    const scoredSessions = sessions
        .map(session => {
            const result = session.analysisResult as any;
            if (!result) return null;

            const score = result.faceAnalysis?.overallScore || result.skinAnalysis?.score || null;
            if (score === null) return null;

            const nickname = result.nickname || session.user?.name || generateRandomNickname(session.sessionId);
            const city = result.userLocation?.city || session.city || session.province || "未知城市";

            const popularity = calculatePopularity(
                session.sessionId,
                session.resultShared,
                session.createdAt
            );

            return {
                sessionId: session.sessionId,
                nickname,
                city,
                score: typeof score === "number" ? score : parseFloat(score) || 0,
                popularity
            };
        })
        .filter(Boolean) as ScoredSession[];

    cachedSessions = scoredSessions;
    cacheTimestamp = Date.now();

    return scoredSessions;
}

// ===== Rank Calculation =====
/**
 * Calculate the rank of a specific session within the leaderboard.
 * Called directly by server components — no HTTP self-call needed.
 */
export async function calculateUserRank(sessionId: string, fallbackScore: number): Promise<UserRankInfo> {
    try {
        const scoredSessions = await loadScoredSessions();

        if (scoredSessions.length === 0) {
            return { rank: 1, percentile: 90, totalParticipants: 1 };
        }

        const allScoreRanked = [...scoredSessions].sort((a, b) => b.score - a.score);
        const userIndex = allScoreRanked.findIndex(s => s.sessionId === sessionId);

        if (userIndex !== -1) {
            const rank = userIndex + 1;
            const percentile = Math.round(((allScoreRanked.length - rank) / allScoreRanked.length) * 100);
            return { rank, percentile, totalParticipants: allScoreRanked.length };
        }
    } catch (error) {
        console.error("Failed to calculate rank from scored sessions:", error);
    }

    // Fallback: estimate from total count
    const totalCount = await prisma.advisorSession.count({
        where: {
            analysisResult: { not: Prisma.JsonNull },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
    });

    const clampedPercentile = Math.min(95, Math.max(60, Math.round(fallbackScore)));
    const estimatedRank = Math.max(1, Math.round(totalCount * (100 - clampedPercentile) / 100));

    return { rank: estimatedRank, percentile: clampedPercentile, totalParticipants: totalCount };
}
