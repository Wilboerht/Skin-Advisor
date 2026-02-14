import { NextRequest, NextResponse } from "next/server";
import {
    loadScoredSessions,
    type LeaderboardEntry,
    type PopularityEntry,
} from "@/lib/leaderboard";

// ===== Types =====
interface LeaderboardResponse {
    scoreRanking: LeaderboardEntry[];
    popularityRanking: PopularityEntry[];
    totalParticipants: number;
    userRank?: {
        rank: number;
        percentile: number;
    };
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
