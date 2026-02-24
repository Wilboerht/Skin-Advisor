import { Metadata } from 'next';
import LeaderboardPageClient from './page-client';
import { loadTopScores, loadTopPopularity, getTotalParticipants, type LeaderboardEntry, type PopularityEntry } from '@/lib/leaderboard';

export const metadata: Metadata = {
    title: '荣耀殿堂 | 智能测肤排行榜',
    description: '汇聚全国护肤达人，共同见证肌肤的科学蜕变之旅。查看你的专属护肤评分与人气排名。',
};

export const revalidate = 300;

export default async function LeaderboardPage() {
    let scoreRanking: LeaderboardEntry[] = [];
    let popularityRanking: PopularityEntry[] = [];
    let totalParticipants = 0;

    // Server-side fetch logic matching the API route
    try {
        const limit = 50;

        scoreRanking = await loadTopScores(limit);
        popularityRanking = await loadTopPopularity(limit);
        totalParticipants = await getTotalParticipants();

    } catch (e) {
        console.error("Server-side failed to load leaderboard data:", e);
        // It's okay if it fails, we will pass empty arrays and the client component 
        // can handle its own fetch / error state.
    }

    return (
        <LeaderboardPageClient
            initialScoreRanking={scoreRanking}
            initialPopularityRanking={popularityRanking}
            initialTotalParticipants={totalParticipants}
        />
    );
}
