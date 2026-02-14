"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Flame, MapPin, Sparkles } from "lucide-react";
import Image from "next/image";

// Types matching the API response
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

export default function LeaderboardPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'score' | 'pop'>('score');
    const [scoreRanking, setScoreRanking] = useState<LeaderboardEntry[]>([]);
    const [popularityRanking, setPopularityRanking] = useState<PopularityEntry[]>([]);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch leaderboard data
    useEffect(() => {
        async function fetchLeaderboard() {
            try {
                // Fetch top 50
                const res = await fetch(`/api/advisor/leaderboard?limit=50`);
                if (res.ok) {
                    const result = await res.json();
                    setScoreRanking(result.scoreRanking || []);
                    setPopularityRanking(result.popularityRanking || []);
                    setTotalParticipants(result.totalParticipants || 0);
                }
            } catch (error) {
                console.error("Failed to fetch leaderboard:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchLeaderboard();
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
        }
    };

    return (
        <div className="min-h-screen bg-[#F0EDE1] text-[#1A1A1A] font-sans selection:bg-[#3D4430] selection:text-white pb-20">
            {/* Header / Navigation */}
            <div className="sticky top-0 z-50 bg-[#F0EDE1]/80 backdrop-blur-md border-b border-[#3D4430]/5 px-4 md:px-8 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-[#3D4430]/80 hover:text-[#1A1A1A] transition-colors p-2 -ml-2 rounded-lg hover:bg-black/5"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium text-sm">返回首页</span>
                    </button>
                    <div className="font-serif font-bold text-lg md:text-xl tracking-tight text-[#1A1A1A]">
                        肌肤名人堂
                    </div>
                    <div className="w-20"></div> {/* Spacer for center alignment */}
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-4 pt-8 md:pt-12">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center mb-10"
                >
                    <div className="inline-flex items-center justify-center p-3 bg-white/50 rounded-2xl shadow-sm mb-4">
                        <Image
                            src="/partner-nihplod.webp"
                            alt="NIHPLOD"
                            width={100}
                            height={30}
                            className="h-6 w-auto opacity-80"
                        />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold mb-3">
                        本赛季荣耀榜单
                    </h1>
                    <p className="text-[#5E5E5E] text-sm md:text-base max-w-md mx-auto leading-relaxed">
                        已有 <span className="font-bold text-[#3D4430]">{totalParticipants.toLocaleString()}</span> 位护肤达人参与评测<br />
                        探索更科学的护肤方式，见证肌肤蜕变
                    </p>
                </motion.div>

                {/* Tabs */}
                <div className="bg-white/40 sticky top-[80px] z-40 backdrop-blur-xl p-1.5 rounded-2xl flex gap-1 shadow-sm border border-white/50 mb-6">
                    <button
                        onClick={() => setActiveTab('score')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden ${activeTab === 'score'
                                ? 'bg-white text-[#1A1A1A] shadow-sm'
                                : 'text-[#5E5E5E] hover:bg-white/20'
                            }`}
                    >
                        <Trophy className={`w-4 h-4 ${activeTab === 'score' ? 'text-[#D4AF37]' : 'opacity-50'}`} />
                        <span>测肤评分榜</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('pop')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'pop'
                                ? 'bg-white text-[#1A1A1A] shadow-sm'
                                : 'text-[#5E5E5E] hover:bg-white/20'
                            }`}
                    >
                        <Flame className={`w-4 h-4 ${activeTab === 'pop' ? 'text-[#FF4D4F]' : 'opacity-50'}`} />
                        <span>人气热度榜</span>
                    </button>
                </div>

                {/* List Container */}
                <div className="min-h-[400px]">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="bg-white/30 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                                    <div className="w-8 h-8 bg-[#3D4430]/5 rounded-lg"></div>
                                    <div className="w-12 h-12 bg-[#3D4430]/5 rounded-full"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="w-24 h-4 bg-[#3D4430]/5 rounded"></div>
                                        <div className="w-16 h-3 bg-[#3D4430]/5 rounded"></div>
                                    </div>
                                    <div className="w-16 h-6 bg-[#3D4430]/5 rounded"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                className="space-y-3"
                            >
                                {activeTab === 'score' ? (
                                    scoreRanking.length > 0 ? (
                                        scoreRanking.map((item, idx) => (
                                            <LeaderboardCard
                                                key={item.sessionId}
                                                entry={item}
                                                idx={idx}
                                                type="score"
                                            />
                                        ))
                                    ) : (
                                        <EmptyState />
                                    )
                                ) : (
                                    popularityRanking.length > 0 ? (
                                        popularityRanking.map((item, idx) => (
                                            <LeaderboardCard
                                                key={item.sessionId}
                                                entry={item}
                                                idx={idx}
                                                type="pop"
                                            />
                                        ))
                                    ) : (
                                        <EmptyState />
                                    )
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </main>
        </div>
    );
}

// Sub-components
function LeaderboardCard({ entry, idx, type }: { entry: any, idx: number, type: 'score' | 'pop' }) {
    const isTop3 = idx < 3;
    const rankColors = ['text-[#D4AF37]', 'text-[#9CA3AF]', 'text-[#B08D57]'];
    const bgColors = ['bg-[#D4AF37]/10', 'bg-[#9CA3AF]/10', 'bg-[#B08D57]/10'];

    // Format numbers
    const formatScore = (num: number) => num.toFixed(1);
    const formatPop = (num: number) => {
        if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return String(num);
    };

    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
            }}
            className="group relative bg-white/60 hover:bg-white/90 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 border border-transparent hover:border-[#3D4430]/5"
        >
            {/* Rank */}
            <div className={`w-10 flex-shrink-0 flex flex-col items-center justify-center ${isTop3 ? '' : 'opacity-50'}`}>
                <span className={`text-xl font-black font-mono ${isTop3 ? rankColors[idx] : 'text-[#3D4430]'}`}>
                    {idx + 1}
                </span>
                {isTop3 && <Sparkles className={`w-3 h-3 ${rankColors[idx]} opacity-60`} />}
            </div>

            {/* Avatar */}
            <div className="relative">
                <div className={`w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 ${isTop3 ? `border-${rankColors[idx].split('-')[1]}` : 'border-white'} shadow-sm`}>
                    <img
                        src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(entry.nickname)}`}
                        alt={entry.nickname}
                        className="w-full h-full object-cover"
                    />
                </div>
                {isTop3 && (
                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                        {idx === 0 && <span className="text-sm">👑</span>}
                        {idx === 1 && <span className="text-sm">🥈</span>}
                        {idx === 2 && <span className="text-sm">🥉</span>}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[#1A1A1A] truncate text-[15px]">
                    {entry.nickname}
                </h3>
                <div className="flex items-center gap-1 text-xs text-[#5E5E5E] mt-0.5">
                    <MapPin className="w-3 h-3 opacity-60" />
                    <span className="truncate">{entry.city}</span>
                </div>
            </div>

            {/* Score/Value */}
            <div className="text-right">
                {type === 'score' ? (
                    <div className="flex flex-col items-end">
                        <span className="text-lg font-black font-mono text-[#3D4430]">
                            {formatScore(entry.score)}
                        </span>
                        <span className="text-[10px] text-[#5E5E5E] font-medium bg-[#3D4430]/5 px-1.5 py-0.5 rounded">
                            分
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-end">
                        <span className="text-lg font-black font-mono text-[#FF4D4F]">
                            {formatPop(entry.popularity)}
                        </span>
                        <span className="text-[10px] text-[#FF4D4F] font-medium bg-[#FF4D4F]/5 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> 热度
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
            <div className="bg-[#3D4430]/5 p-6 rounded-full mb-4">
                <Trophy className="w-10 h-10 text-[#3D4430]/40" />
            </div>
            <p className="text-[#3D4430] font-medium">暂时没有排行数据</p>
            <p className="text-sm text-[#5E5E5E] mt-1">快来参与测肤成为第一名吧</p>
        </div>
    );
}
