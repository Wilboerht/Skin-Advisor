import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ===== Types =====
interface LeaderboardEntry {
    rank: number;
    nickname: string;
    city: string;
    score: number;
    sessionId: string;
}

interface PopularityEntry {
    rank: number;
    nickname: string;
    city: string;
    popularity: number;
    sessionId: string;
}

interface LeaderboardResponse {
    scoreRanking: LeaderboardEntry[];
    popularityRanking: PopularityEntry[];
    totalParticipants: number;
    userRank?: {
        rank: number;
        percentile: number; // Percentage of users beaten
    };
}

interface ScoredSession {
    sessionId: string;
    nickname: string;
    city: string;
    score: number;
    popularity: number;
}

// ===== In-Memory Cache (5 min TTL) =====
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedSessions: ScoredSession[] | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
    return cachedSessions !== null && (Date.now() - cacheTimestamp) < CACHE_TTL_MS;
}

// ===== Deterministic Hash =====
// Stable hash based on string input, always returns the same value for same input
function deterministicHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// ===== Deterministic Popularity =====
// Uses real signals (share status, recency) + stable session hash
// Result is consistent across API calls — no more random jitter
function calculatePopularity(
    sessionId: string,
    resultShared: boolean,
    createdAt: Date
): number {
    // 1. Base score: deterministic hash mapped to 100–2100 range
    const baseScore = (deterministicHash(sessionId) % 2000) + 100;

    // 2. Share bonus: sharing is a real user action, reward it heavily
    const shareBonus = resultShared ? 3000 : 0;

    // 3. Recency bonus: newer sessions get up to +500, decaying linearly over 30 days
    const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, Math.round(500 * (1 - ageDays / 30)));

    return baseScore + shareBonus + recencyBonus;
}

// ===== Deterministic Nickname Generator =====
function generateRandomNickname(seed: string): string {
    const adjectives = ["可爱的", "阳光", "元气", "甜美", "活力", "清新", "温柔", "俏皮", "优雅", "时尚"];
    const nouns = ["小可爱", "宝贝", "达人", "精灵", "女神", "仙子", "小天使", "小公主", "少女", "美眉"];

    const hash = deterministicHash(seed);
    return adjectives[hash % adjectives.length] + nouns[(hash >> 4) % nouns.length];
}

// ===== Data Loading with Cache =====
async function loadScoredSessions(): Promise<ScoredSession[]> {
    // Return cached data if still valid
    if (isCacheValid()) {
        return cachedSessions!;
    }

    // Fetch from database
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
        }
    });

    // Process sessions
    const scoredSessions = sessions
        .map(session => {
            const result = session.analysisResult as any;
            if (!result) return null;

            const score = result.faceAnalysis?.overallScore || result.skinAnalysis?.score || null;
            if (score === null) return null;

            // Nickname priority: analysisResult.nickname > user.name > deterministic random
            const nickname = result.nickname || session.user?.name || generateRandomNickname(session.sessionId);
            const city = result.userLocation?.city || session.city || session.province || "未知城市";

            // Deterministic popularity — stable across refreshes
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

    // Update cache
    cachedSessions = scoredSessions;
    cacheTimestamp = Date.now();

    return scoredSessions;
}

// ===== API Handler =====
/**
 * GET /api/advisor/leaderboard
 *
 * Query params:
 * - limit: number of entries to return (default 10, max 50)
 * - sessionId: current user's session ID to calculate their rank
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
        const currentSessionId = searchParams.get("sessionId");

        // Load data (from cache or database)
        const scoredSessions = await loadScoredSessions();

        // Sort by score (descending) and take top N
        const scoreRanked: LeaderboardEntry[] = [...scoredSessions]
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((entry, idx) => ({
                rank: idx + 1,
                nickname: entry.nickname,
                city: entry.city,
                score: Math.round(entry.score * 10) / 10,
                sessionId: entry.sessionId
            }));

        // Sort by popularity (descending) and take top N
        const popularityRanked: PopularityEntry[] = [...scoredSessions]
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, limit)
            .map((entry, idx) => ({
                rank: idx + 1,
                nickname: entry.nickname,
                city: entry.city,
                popularity: entry.popularity,
                sessionId: entry.sessionId
            }));

        // Calculate current user's rank if sessionId provided
        let userRank: LeaderboardResponse["userRank"] = undefined;
        if (currentSessionId) {
            const allScoreRanked = [...scoredSessions].sort((a, b) => b.score - a.score);
            const userIndex = allScoreRanked.findIndex(s => s.sessionId === currentSessionId);

            if (userIndex !== -1) {
                const rank = userIndex + 1;
                const percentile = Math.round(((allScoreRanked.length - rank) / allScoreRanked.length) * 100);
                userRank = { rank, percentile };
            }
        }

        const response: LeaderboardResponse = {
            scoreRanking: scoreRanked,
            popularityRanking: popularityRanked,
            totalParticipants: scoredSessions.length,
            userRank
        };

        // HTTP cache: CDN caches 5 min, allows stale-while-revalidate for 1 min beyond that
        return NextResponse.json(response, {
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60"
            }
        });
    } catch (error) {
        console.error("Leaderboard API Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}
