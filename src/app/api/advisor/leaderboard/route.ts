import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Types for leaderboard
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
    popularity: number; // View count or share count
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

/**
 * GET /api/advisor/leaderboard
 * 
 * Query params:
 * - limit: number of entries to return (default 10)
 * - sessionId: current user's session ID to calculate their rank
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
        const currentSessionId = searchParams.get("sessionId");

        // Fetch all sessions with valid analysis results for score ranking
        // We need to filter sessions that have overallScore in their analysisResult
        const sessions = await prisma.advisorSession.findMany({
            where: {
                analysisResult: {
                    not: Prisma.JsonNull
                },
                // Only include sessions from last 30 days for freshness
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

        // Process and score sessions
        const scoredSessions = sessions
            .map(session => {
                const result = session.analysisResult as any;
                if (!result) return null;

                const score = result.faceAnalysis?.overallScore || result.skinAnalysis?.score || null;
                if (score === null) return null;

                // Generate nickname priority: result.nickname > user.name > random
                const nickname = result.nickname || session.user?.name || generateRandomNickname(session.sessionId);
                const city = result.userLocation?.city || session.city || session.province || "未知城市";

                // Popularity score: shared = bonus points (simplified model)
                const popularityBase = Math.floor(Math.random() * 5000) + 100; // Base views simulation
                const shareBonus = session.resultShared ? 3000 : 0;

                return {
                    sessionId: session.sessionId,
                    nickname,
                    city,
                    score: typeof score === "number" ? score : parseFloat(score) || 0,
                    popularity: popularityBase + shareBonus
                };
            })
            .filter(Boolean) as Array<{
                sessionId: string;
                nickname: string;
                city: string;
                score: number;
                popularity: number;
            }>;

        // Sort by score (descending)
        const scoreRanked = [...scoredSessions]
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((entry, idx) => ({
                rank: idx + 1,
                nickname: entry.nickname,
                city: entry.city,
                score: Math.round(entry.score * 10) / 10, // Round to 1 decimal
                sessionId: entry.sessionId
            }));

        // Sort by popularity (descending)
        const popularityRanked = [...scoredSessions]
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

        return NextResponse.json(response);
    } catch (error) {
        console.error("Leaderboard API Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}

// Deterministic random nickname based on session ID seed
function generateRandomNickname(seed: string): string {
    const adjectives = ["可爱的", "阳光", "元气", "甜美", "活力", "清新", "温柔", "俏皮", "优雅", "时尚"];
    const nouns = ["小可爱", "宝贝", "达人", "精灵", "女神", "仙子", "小天使", "小公主", "少女", "美眉"];

    // Simple hash from seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    hash = Math.abs(hash);

    return adjectives[hash % adjectives.length] + nouns[(hash >> 4) % nouns.length];
}
