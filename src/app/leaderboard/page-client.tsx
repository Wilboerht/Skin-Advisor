"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Flame, MapPin, Crown, AlertCircle, RefreshCcw } from "lucide-react";
import Image from "next/image";
import { advisorStorage } from "@/lib/advisor-storage";

// Types
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

interface LeaderboardPageClientProps {
    initialScoreRanking: LeaderboardEntry[];
    initialPopularityRanking: PopularityEntry[];
    initialTotalParticipants: number;
}

export default function LeaderboardPageClient({
    initialScoreRanking,
    initialPopularityRanking,
    initialTotalParticipants
}: LeaderboardPageClientProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'score' | 'pop'>('score');
    const [scoreRanking, setScoreRanking] = useState<LeaderboardEntry[]>(initialScoreRanking);
    const [popularityRanking, setPopularityRanking] = useState<PopularityEntry[]>(initialPopularityRanking);
    const [totalParticipants, setTotalParticipants] = useState(initialTotalParticipants);
    // If we have initial data (from server), we don't need to show a loading skeleton initially.
    const [isLoading, setIsLoading] = useState(initialScoreRanking.length === 0);
    const [error, setError] = useState<string | null>(null);
    const [userRankInfo, setUserRankInfo] = useState<{ rank: number, percentile: number } | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // Fetch leaderboard data (client-side override to get user's specific rank / fresh data)
    const fetchLeaderboard = async (showLoadingFlag = true) => {
        try {
            if (showLoadingFlag) setIsLoading(true);
            setError(null);

            let sessionId = null;
            try {
                const result = await advisorStorage.getResult();
                if (result && result.sessionId) {
                    sessionId = result.sessionId;
                    setCurrentSessionId(sessionId);
                }
            } catch (e) {
                console.error("Failed to get sessionId from storage", e);
            }

            const query = sessionId ? `?limit=50&sessionId=${sessionId}` : `?limit=50`;
            const res = await fetch(`/api/advisor/leaderboard${query}`);
            if (res.ok) {
                const result = await res.json();
                setScoreRanking(result.scoreRanking || []);
                setPopularityRanking(result.popularityRanking || []);
                setTotalParticipants(result.totalParticipants || 0);
                if (result.userRank) {
                    setUserRankInfo(result.userRank);
                }
            } else {
                throw new Error("Failed to fetch data");
            }
        } catch (error) {
            console.error("Failed to fetch leaderboard:", error);
            // Only set error if we don't have initial data to fall back on
            if (scoreRanking.length === 0) {
                setError("无法连接到服务器，请检查网络后重试");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Automatically fetch to get the user's sessionId rank & fresh scores
        // But don't trigger the skeleton screen if we already have server data
        const hasInitialData = initialScoreRanking.length > 0;
        fetchLeaderboard(!hasInitialData);
    }, []);

    return (
        <div className="min-h-screen bg-[#F9F7F5] font-sans text-[#1A1A1A]">
            {/* 1. Immersive Header Section */}
            <header className="relative bg-[#00263e] text-white pt-8 pb-32 px-4 md:px-8 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#D4AF37] rounded-full mix-blend-overlay filter blur-[120px] translate-x-1/3 translate-y-1/3"></div>
                </div>

                <div className="max-w-7xl mx-auto relative z-10">
                    {/* Nav Bar */}
                    <div className="flex items-center justify-between mb-12">
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors group"
                        >
                            <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </div>
                            <span className="font-medium tracking-wide">返回首页</span>
                        </button>
                        <Image
                            src="/partner-nihplod.webp"
                            alt="NIHPLOD"
                            width={120}
                            height={40}
                            className="h-8 w-auto brightness-0 invert opacity-90"
                        />
                        <div className="w-24"></div> {/* Spacer */}
                    </div>

                    {/* Hero Content */}
                    <div className="text-center max-w-2xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#F0EDE1] via-white to-[#D4AF37] drop-shadow-sm">
                                荣耀殿堂
                            </h1>
                            <p className="text-white/60 text-lg md:text-xl leading-relaxed font-light">
                                汇聚全国 <span className="text-[#D4AF37] font-bold font-mono text-2xl mx-1">{totalParticipants.toLocaleString()}</span> 位护肤达人<br />
                                共同见证肌肤的科学蜕变之旅
                            </p>
                        </motion.div>
                    </div>
                </div>
            </header>

            {/* 2. Main Content - Elevated Container */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 -mt-20 relative z-20 pb-20">

                {/* Mobile Tabs */}
                <div className="lg:hidden bg-white rounded-2xl p-1.5 shadow-lg shadow-black/5 flex gap-1 mb-8 mx-4">
                    <button
                        onClick={() => setActiveTab('score')}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'score' ? 'bg-[#00263e] text-white shadow-md' : 'text-gray-500'}`}
                    >
                        <Trophy className="w-4 h-4" /> 测肤榜
                    </button>
                    <button
                        onClick={() => setActiveTab('pop')}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'pop' ? 'bg-[#FF4D4F] text-white shadow-md' : 'text-gray-500'}`}
                    >
                        <Flame className="w-4 h-4" /> 人气榜
                    </button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
                        <SkeletonTable />
                        <div className="hidden lg:block"><SkeletonTable /></div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100 mx-4 md:mx-0">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">加载失败</h3>
                        <p className="text-gray-500 mb-8">{error}</p>
                        <button
                            onClick={() => fetchLeaderboard(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-[#00263e] text-white rounded-xl font-medium hover:bg-black transition-colors"
                        >
                            <RefreshCcw className="w-4 h-4" /> 重新加载
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

                        {/* LEFT COLUMN: SCORE RANKING */}
                        <div className={`${activeTab === 'score' ? 'block' : 'hidden'} lg:block`}>
                            <SectionHeader
                                title="测肤评分榜"
                                icon={<Trophy className="w-6 h-6 text-[#D4AF37]" />}
                                subtitle="基于 AI 深度皮肤分析得分"
                                theme="gold"
                            />

                            {/* Podium for Top 3 */}
                            <div className="mb-10">
                                <Podium entries={scoreRanking.slice(0, 3)} type="score" />
                            </div>

                            {/* List for 4-50 */}
                            <div className="bg-white rounded-[24px] border border-gray-100 shadow-xl shadow-[#00263e]/5 overflow-hidden">
                                {scoreRanking.slice(3).map((entry, idx) => (
                                    <RankListItem
                                        key={entry.sessionId}
                                        entry={entry}
                                        rank={idx + 4}
                                        type="score"
                                    />
                                ))}
                                {scoreRanking.length === 0 && <EmptyState />}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: POPULARITY RANKING */}
                        <div className={`${activeTab === 'pop' ? 'block' : 'hidden'} lg:block`}>
                            <SectionHeader
                                title="人气热度榜"
                                icon={<Flame className="w-6 h-6 text-[#FF4D4F]" />}
                                subtitle="基于分享裂变与社区互动"
                                theme="red"
                            />

                            {/* Podium for Top 3 */}
                            <div className="mb-10">
                                <Podium entries={popularityRanking.slice(0, 3)} type="pop" />
                            </div>

                            {/* List for 4-50 */}
                            <div className="bg-white rounded-[24px] border border-gray-100 shadow-xl shadow-[#00263e]/5 overflow-hidden">
                                {popularityRanking.slice(3).map((entry, idx) => (
                                    <RankListItem
                                        key={entry.sessionId}
                                        entry={entry}
                                        rank={idx + 4}
                                        type="pop"
                                    />
                                ))}
                                {popularityRanking.length === 0 && <EmptyState />}
                            </div>
                        </div>

                    </div>
                )}
            </main>

            {/* 3. Sticky Footer for User Rank */}
            {userRankInfo && currentSessionId && (
                <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-4 md:py-6 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] transform transition-transform duration-500 ease-out translate-y-0">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-[#00263E] to-[#004A7C] text-white flex justify-center items-center font-bold text-lg md:text-xl font-mono shadow-md border border-white/20">
                                {userRankInfo.rank > 500 ? '500+' : userRankInfo.rank}
                            </div>
                            <div>
                                <div className="font-bold text-sm md:text-lg text-gray-900 tracking-tight">我的实时排名</div>
                                <div className="text-xs md:text-sm text-gray-500 mt-0.5">
                                    击败了 <span className="font-bold text-[#D4AF37] text-sm md:text-base">{userRankInfo.percentile}%</span> 的护肤达人
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push(`/result?id=${currentSessionId}`)}
                            className="px-4 py-2 md:px-6 md:py-2.5 bg-[#00263E] text-white text-sm md:text-base font-medium rounded-full hover:bg-black transition-colors shadow-md whitespace-nowrap active:scale-95 flex items-center gap-1"
                        >
                            <Trophy className="w-4 h-4" /> 查看报告
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------- Sub Components ----------------------

function SectionHeader({ title, icon, subtitle, theme }: { title: string, icon: React.ReactNode, subtitle: string, theme: 'gold' | 'red' }) {
    const colorClass = theme === 'gold' ? 'text-[#D4AF37]' : 'text-[#FF4D4F]';
    return (
        <div className="flex items-center gap-4 mb-8 px-2">
            <div className={`p-3 rounded-2xl bg-white shadow-sm border border-gray-100 ${colorClass}`}>
                {icon}
            </div>
            <div>
                <h2 className="text-2xl font-black text-[#00263e] tracking-tight">{title}</h2>
                <p className="text-sm text-gray-500 font-medium opacity-80">{subtitle}</p>
            </div>
        </div>
    );
}

function Podium({ entries, type }: { entries: any[], type: 'score' | 'pop' }) {
    if (entries.length === 0) return null;

    // Ensure we have 3 spots even if fewer entries
    const [first, second, third] = [entries[0], entries[1], entries[2]];

    return (
        <div className="flex justify-center items-end gap-2 md:gap-4 h-[280px] px-2">
            {/* 2nd Place */}
            <PodiumItem entry={second} rank={2} type={type} className="order-1" />

            {/* 1st Place - Center & Largest */}
            <PodiumItem entry={first} rank={1} type={type} className="order-2 -mt-8 z-10" />

            {/* 3rd Place */}
            <PodiumItem entry={third} rank={3} type={type} className="order-3" />
        </div>
    );
}

function PodiumItem({ entry, rank, type, className }: { entry: { nickname: string, city: string, score?: number, popularity?: number } | null, rank: number, type: 'score' | 'pop', className?: string }) {
    if (!entry) return <div className={`w-[30%] opacity-0 ${className}`}></div>;

    const isFirst = rank === 1;
    const heightClass = isFirst ? 'h-[180px]' : rank === 2 ? 'h-[150px]' : 'h-[130px]';
    const bgColor = isFirst ? 'bg-gradient-to-b from-[#FFD700]/20 to-[#FFD700]/5 border-[#FFD700]'
        : rank === 2 ? 'bg-gradient-to-b from-[#C0C0C0]/20 to-[#C0C0C0]/5 border-[#C0C0C0]'
            : 'bg-gradient-to-b from-[#CD7F32]/20 to-[#CD7F32]/5 border-[#CD7F32]';

    const crownColor = isFirst ? 'text-[#FFD700]' : rank === 2 ? 'text-[#C0C0C0]' : 'text-[#CD7F32]';
    const scoreColor = type === 'score' ? 'text-[#00263e]' : 'text-[#FF4D4F]';

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.1 }}
            className={`flex flex-col items-center flex-1 min-w-[30%] ${className}`}
        >
            {/* Avatar Section */}
            <div className="relative mb-3 group cursor-pointer">
                {isFirst && (
                    <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-[#FFD700] drop-shadow-sm animate-bounce-slow" />
                )}
                <div className={`relative rounded-full p-1 border-2 ${rank === 1 ? 'border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.3)]' : rank === 2 ? 'border-[#C0C0C0]' : 'border-[#CD7F32]'} bg-white`}>
                    <div className={`rounded-full overflow-hidden ${isFirst ? 'w-20 h-20 md:w-24 md:h-24' : 'w-16 h-16 md:w-20 md:h-20'}`}>
                        <img
                            src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(entry.nickname)}`}
                            alt={entry.nickname}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover transform transition-transform group-hover:scale-110"
                        />
                    </div>
                    <div className={`absolute -bottom-2 inset-x-0 flex justify-center`}>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white border shadow-sm ${rank === 1 ? 'border-[#FFD700] text-[#B8860B]' : rank === 2 ? 'border-[#C0C0C0] text-gray-500' : 'border-[#CD7F32] text-[#A0522D]'}`}>
                            #{rank}
                        </span>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className={`w-full rounded-t-2xl p-4 flex flex-col items-center justify-start border-t border-x ${heightClass} ${bgColor} relative backdrop-blur-sm`}>
                <h3 className="font-bold text-[#1A1A1A] truncate w-full text-center text-sm md:text-base mb-1">
                    {entry.nickname}
                </h3>
                <div className="flex items-center gap-1 text-xs text-black/50 mb-3">
                    <MapPin className="w-3 h-3" /> {entry.city || "未知"}
                </div>

                <div className={`font-black font-mono text-xl md:text-2xl ${scoreColor}`}>
                    {type === 'score' ? (entry.score ?? 0).toFixed(1) : ((entry.popularity ?? 0) >= 1000 ? ((entry.popularity ?? 0) / 1000).toFixed(1) + 'k' : (entry.popularity ?? 0))}
                </div>
                <div className="text-[10px] uppercase font-bold tracking-widest opacity-40 mt-1">
                    {type === 'score' ? 'Score' : 'Hot'}
                </div>
            </div>
        </motion.div>
    );
}

function RankListItem({ entry, rank, type }: { entry: { nickname: string, city: string, score?: number, popularity?: number }, rank: number, type: 'score' | 'pop' }) {
    const scoreColor = type === 'score' ? 'text-[#00263e]' : 'text-[#FF4D4F]';

    return (
        <div className="flex items-center p-4 border-b border-gray-50 hover:bg-[#F9F9F9] transition-colors group">
            {/* Rank */}
            <div className="w-8 md:w-12 text-center font-bold text-gray-400 font-mono text-lg italic">
                {rank}
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-100 mx-3 md:mx-4 flex-shrink-0">
                <img
                    src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(entry.nickname)}`}
                    alt={entry.nickname}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-[#1A1A1A] text-sm md:text-base truncate group-hover:text-[#00263e] transition-colors">
                    {entry.nickname}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <span className="truncate">{entry.city || "火星"}</span>
                </div>
            </div>

            {/* Score */}
            <div className={`font-bold font-mono text-lg md:text-xl ${scoreColor} text-right min-w-[60px]`}>
                {type === 'score' ? (entry.score ?? 0).toFixed(1) : (entry.popularity ?? 0)}
            </div>
        </div>
    );
}

function SkeletonTable() {
    return (
        <div className="space-y-4">
            {/* Podium Skeleton */}
            <div className="flex justify-center items-end gap-4 h-[200px] mb-8">
                {[2, 1, 3].map(i => (
                    <div key={i} className={`bg-gray-200 rounded-t-2xl w-1/3 animate-pulse ${i === 1 ? 'h-[180px]' : 'h-[140px]'}`}></div>
                ))}
            </div>
            {/* List Skeleton */}
            {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-8 bg-gray-100 rounded"></div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                    <div className="flex-1 h-4 bg-gray-100 rounded"></div>
                    <div className="w-12 h-6 bg-gray-100 rounded"></div>
                </div>
            ))}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="p-8 text-center text-gray-400 text-sm">
            暂无更多数据
        </div>
    );
}
