"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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

interface ShareLandingProps {
    data: {
        score: number;
        skinType: string;
        skinAge: number;
        dimensions: any;
        publishDate: string;
        nickname: string;
        city: string;
        isGuest: boolean;
        // New rank-related fields
        sessionId: string;
        userRank: number;
        userPercentile: number;
        totalParticipants: number;
        generatedAvatar?: string;
    }
}

export default function ShareLandingClient({ data }: ShareLandingProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'score' | 'pop'>('score');
    const [showModal, setShowModal] = useState(false);
    const [comment, setComment] = useState("");

    // Leaderboard state
    const [scoreRanking, setScoreRanking] = useState<LeaderboardEntry[]>([]);
    const [popularityRanking, setPopularityRanking] = useState<PopularityEntry[]>([]);
    const [totalParticipants, setTotalParticipants] = useState(data.totalParticipants);
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

    // Random comments from reference
    const comments = [
        "报告评语：您的肌肤细腻度很高，几乎看不见毛孔，水油平衡状态非常理想，请继续保持现有的基础护肤流程！",
        "报告评语：肤色匀净度极佳，近期防晒工作做得非常到位。眼周状态紧致，是实至名归的素颜女神候选人。",
        "报告评语：整体状态非常健康，胶原蛋白感十足。建议在接下来的换季期加强补水，让肌肤屏障更加稳固。",
        "报告评语：水油平衡控制得很好，即使是素颜也散发着自然的光泽感。当前排名反映了你极佳的保养习惯。"
    ];

    // Fetch leaderboard data
    useEffect(() => {
        setMounted(true);
        setComment(comments[Math.floor(Math.random() * comments.length)]);

        // Fetch leaderboard from API
        async function fetchLeaderboard() {
            try {
                const res = await fetch(`/api/advisor/leaderboard?limit=5&sessionId=${data.sessionId}`);
                if (res.ok) {
                    const result = await res.json();
                    setScoreRanking(result.scoreRanking || []);
                    setPopularityRanking(result.popularityRanking || []);
                    if (result.totalParticipants) {
                        setTotalParticipants(result.totalParticipants);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch leaderboard:", error);
            } finally {
                setIsLoadingLeaderboard(false);
            }
        }

        fetchLeaderboard();
    }, [data.sessionId]);

    // Animation Variants
    const revealVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.8, ease: [0.23, 1, 0.32, 1] as any } // cubic-bezier matching ref
        })
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#F0EDE1] font-sans text-[#333] p-5 flex justify-center items-start md:items-center overflow-x-hidden">
            <style jsx global>{`
                :root {
                    --primary-bg: #F0EDE1;
                    --accent-yellow: #FFD700;
                    --accent-blue: #00263e;
                    --glass-white: rgba(255, 255, 255, 0.4);
                    --glass-border: rgba(255, 255, 255, 0.6);
                }
                .glass-module {
                    background: var(--glass-white);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid var(--glass-border);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
                }
                .glass-module:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.06);
                }
            `}</style>

            <div className="w-full max-w-[1100px] flex flex-col gap-6">
                <div className="flex justify-center">
                    <img src="/partner-nihplod.webp" alt="Partner Logo" className="h-10 md:h-14 object-contain opacity-90" />
                </div>
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* 1. Challenge Module */}
                    <motion.div
                        custom={1}
                        initial="hidden"
                        animate="visible"
                        variants={revealVariants}
                        className="glass-module rounded-[32px] p-[30px] flex flex-col transition-all duration-400 relative overflow-hidden"
                    >
                        <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5 bg-[#FFD700] text-black w-fit">
                            测肤大挑战
                        </span>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-20 h-20 rounded-3xl bg-[#eee] border-[3px] border-white overflow-hidden relative">
                                {/* Dynamic Avatar: Prioritize AI generated, fallback to DiceBear */}
                                <img
                                    src={data.generatedAvatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(data.nickname)}`}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-2xl font-bold mb-1">{data.nickname}</h2>
                                <p className="text-sm text-[#666]">{data.isGuest ? "临时用户" : "注册用户"} · {data.city}</p>
                            </div>
                        </div>

                        <div className="bg-black/5 p-5 rounded-3xl mb-6 text-center">
                            <span className="text-sm text-[#666] block mb-1">当前全国排名</span>
                            <span className="text-4xl font-extrabold text-black block">{data.userRank}</span>
                            <p className="font-semibold text-[#27ae60] mt-2 text-sm">超越了全国 {data.userPercentile}% 的用户</p>
                        </div>

                        <div className="text-base leading-[1.6] text-[#444] p-4 border-l-4 border-[#FFD700] bg-white/30 mb-[30px] rounded-r-xl min-h-[80px]">
                            {comment}
                        </div>

                        <button
                            onClick={() => setShowModal(true)}
                            className="w-full py-[18px] bg-black text-white rounded-[20px] text-base font-semibold transition-transform active:scale-[0.98] hover:bg-[#333]"
                        >
                            分享我的战报
                        </button>
                        <p className="mt-[15px] text-[13px] text-[#666] text-center">
                            邀请好友开启素颜测肤大对决，提升人气分，赢取限时好礼。
                        </p>
                    </motion.div>

                    {/* 2. Leaderboard Module */}
                    <motion.div
                        custom={2}
                        initial="hidden"
                        animate="visible"
                        variants={revealVariants}
                        className="glass-module rounded-[32px] p-[30px] flex flex-col transition-all duration-400 relative overflow-hidden"
                    >
                        <div className="flex gap-2.5 mb-[25px]">
                            <div
                                onClick={() => setActiveTab('score')}
                                className={`px-5 py-2.5 rounded-xl cursor-pointer font-semibold text-[15px] transition-all border border-transparent flex items-center gap-1.5 
                                ${activeTab === 'score' ? 'bg-white border-[rgba(255,255,255,0.6)] shadow-sm' : 'bg-black/3 hover:bg-black/5'}`}
                            >
                                测肤排行
                            </div>
                            <div
                                onClick={() => setActiveTab('pop')}
                                className={`px-5 py-2.5 rounded-xl cursor-pointer font-semibold text-[15px] transition-all border border-transparent flex items-center gap-1.5 
                                ${activeTab === 'pop' ? 'bg-white border-[rgba(255,255,255,0.6)] shadow-sm' : 'bg-black/3 hover:bg-black/5'}`}
                            >
                                人气排行 <span className="text-[#FF4D4F]">🔥</span>
                            </div>
                        </div>

                        <div className="flex-grow flex flex-col">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex flex-col"
                                >
                                    {isLoadingLeaderboard ? (
                                        // Loading skeleton
                                        <div className="space-y-3">
                                            {[1, 2, 3, 4, 5].map((i) => (
                                                <div key={i} className="flex items-center py-3 px-2 animate-pulse">
                                                    <div className="w-[30px] h-6 bg-gray-200 rounded" />
                                                    <div className="w-11 h-11 rounded-xl mx-3 bg-gray-200" />
                                                    <div className="flex-grow">
                                                        <div className="h-4 bg-gray-200 rounded w-20 mb-1" />
                                                        <div className="h-3 bg-gray-200 rounded w-16" />
                                                    </div>
                                                    <div className="h-5 bg-gray-200 rounded w-12" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : activeTab === 'score' ? (
                                        <>
                                            {/* Score Rank Items */}
                                            {scoreRanking.length > 0 ? scoreRanking.map((item, idx) => {
                                                const rankColors = ['#D4AF37', '#A8A8A8', '#B08D57', '#999', '#999'];
                                                return (
                                                    <div key={item.sessionId} className="flex items-center py-3 border-b border-black/5 last:border-0 hover:bg-white/20 transition-colors px-2 rounded-lg">
                                                        <span className="w-[30px] font-extrabold text-lg" style={{ color: rankColors[idx] || '#999' }}>
                                                            {String(item.rank).padStart(2, '0')}
                                                        </span>
                                                        <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(item.nickname)}`} className="w-11 h-11 rounded-xl mx-3 bg-gray-200" alt="avatar" />
                                                        <div className="flex-grow">
                                                            <p className="font-semibold text-[15px]">{item.nickname}</p>
                                                            <p className="text-xs text-[#666]">{item.city}</p>
                                                        </div>
                                                        <span className="font-bold text-lg text-[#00263e]">{item.score}</span>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="text-center py-8 text-gray-500">暂无排行数据</div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {/* Pop Rank Items */}
                                            {popularityRanking.length > 0 ? popularityRanking.map((item, idx) => {
                                                const rankColors = ['#D4AF37', '#A8A8A8', '#B08D57', '#999', '#999'];
                                                const formatPopularity = (num: number) => {
                                                    if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
                                                    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
                                                    return String(num);
                                                };
                                                return (
                                                    <div key={item.sessionId} className="flex items-center py-3 border-b border-black/5 last:border-0 hover:bg-white/20 transition-colors px-2 rounded-lg">
                                                        <span className="w-[30px] font-extrabold text-lg" style={{ color: rankColors[idx] || '#999' }}>
                                                            {String(item.rank).padStart(2, '0')}
                                                        </span>
                                                        <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(item.nickname)}`} className="w-11 h-11 rounded-xl mx-3 bg-gray-200" alt="avatar" />
                                                        <div className="flex-grow">
                                                            <p className="font-semibold text-[15px]">{item.nickname}</p>
                                                            <p className="text-xs text-[#666]">{item.city}</p>
                                                        </div>
                                                        <span className="font-bold text-lg text-[#FF4D4F]">{formatPopularity(item.popularity)} 🔥</span>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="text-center py-8 text-gray-500">暂无人气数据</div>
                                            )}
                                        </>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <div className="mt-5 pt-5 border-t border-dashed border-black/10 text-center text-sm text-[#666]">
                            已有 {totalParticipants.toLocaleString()}+ 人参与本赛季挑战
                        </div>
                    </motion.div>

                    {/* 3. Report Module (Full Width on Desktop) */}
                    <motion.div
                        custom={3}
                        initial="hidden"
                        animate="visible"
                        variants={revealVariants}
                        className="glass-module rounded-[32px] p-[30px] flex flex-col transition-all duration-400 relative overflow-hidden min-h-[300px] md:col-span-2"
                    >
                        <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5 bg-[#00263e] text-white w-fit">
                            专业报告
                        </span>
                        <h3 className="mb-5 text-xl font-bold">个性化完整版测肤报告</h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-5">
                            <div className="bg-white/50 p-5 rounded-[20px] text-center">
                                <p className="text-[28px] font-extrabold mb-1.5">{data.skinAge || 22}岁</p>
                                <p className="text-[13px] text-[#666]">肌肤年龄</p>
                            </div>
                            <div className="bg-white/50 p-5 rounded-[20px] text-center">
                                <p className="text-[28px] font-extrabold mb-1.5 text-[#E67E22]">{data.skinType || '中性'}</p>
                                <p className="text-[13px] text-[#666]">肤质类型</p>
                            </div>
                            <div className="bg-white/50 p-5 rounded-[20px] text-center">
                                <p className="text-[28px] font-extrabold mb-1.5">良好</p>
                                <p className="text-[13px] text-[#666]">毛孔状态</p>
                            </div>
                            <div className="bg-white/50 p-5 rounded-[20px] text-center">
                                <p className="text-[28px] font-extrabold mb-1.5">轻度</p>
                                <p className="text-[13px] text-[#666]">黑眼圈指数</p>
                            </div>
                        </div>

                        {/* Fold Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-gradient-to-b from-transparent to-[var(--glass-white)] flex items-end justify-center pb-[30px] backdrop-blur-[4px]">
                            <button
                                onClick={() => router.push('/login')}
                                className="bg-[#00263e] text-white px-[30px] py-[12px] rounded-full border-none font-semibold cursor-pointer shadow-[0_10px_20px_rgba(0,38,62,0.2)] hover:scale-105 transition-transform"
                            >
                                登录查看完整专业报告
                            </button>
                        </div>
                    </motion.div>

                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex justify-center items-center"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="bg-[#F0EDE1] w-[90%] max-w-[400px] rounded-[32px] p-[40px] text-center transform scale-90"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold mb-[15px] leading-relaxed">
                                您的当前数据已入选<br />素颜测肤排位全国较前排名
                            </h2>
                            <p className="text-[#666] mb-[30px] text-[15px] leading-relaxed">
                                在赛季结束之前有概率获得礼品，请选择后续操作。
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => router.push('/login')}
                                    className="p-4 rounded-2xl border-none font-semibold cursor-pointer transition-colors bg-[#00263e] text-white hover:bg-[#003859]"
                                >
                                    登录更新本次报告
                                </button>
                                <button
                                    onClick={() => router.push('/register')}
                                    className="p-4 rounded-2xl font-semibold cursor-pointer transition-colors bg-white border border-[#ddd] text-[#333] hover:bg-gray-50"
                                >
                                    注册账号获得更多权益
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 rounded-2xl bg-transparent text-[#888] underline text-[13px] hover:text-[#555]"
                                >
                                    不注册，只想晒下战报
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
