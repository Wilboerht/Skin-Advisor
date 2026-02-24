import { NextRequest, NextResponse } from "next/server";
import {
    loadTopScores,
    loadTopPopularity,
    getTotalParticipants,
    calculateUserRank,
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

        // 并行加载所有数据
        const [scoreRanked, popularityRanked, totalParticipants] = await Promise.all([
            loadTopScores(limit),
            loadTopPopularity(limit),
            getTotalParticipants(),
        ]);

        // Calculate current user's rank if sessionId provided
        let userRank: LeaderboardResponse["userRank"] = undefined;
        if (currentSessionId) {
            userRank = await calculateUserRank(currentSessionId);
        }

        const response: LeaderboardResponse = {
            scoreRanking: scoreRanked,
            popularityRanking: popularityRanked,
            totalParticipants: totalParticipants,
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
