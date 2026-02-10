"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useAuth } from "@/hooks/useAuth";

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
        // Guest simplified analysis
        guestAnalysis?: {
            summary: string;
            concerns: string[];
            tips: string[];
            skinTypeKey: string;
            hydrationLevel: string | null;
        };
    }
}

export default function ShareLandingClient({ data }: ShareLandingProps) {
    const router = useRouter();
    const { openAuthModal } = useAuthModal();
    const { user } = useAuth();
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
                                <p className="text-sm text-[#666]">{data.isGuest ? "临时用户 · " : ""}{data.city}</p>
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

                    {/* 3. Report Module / Back Button */}
                    {user ? (
                        <motion.div
                            custom={3}
                            initial="hidden"
                            animate="visible"
                            variants={revealVariants}
                            className="glass-module rounded-[32px] p-[30px] flex flex-col items-center justify-center transition-all duration-400 md:col-span-2"
                        >
                            <p className="text-[#666] mb-4">您已登录，可以查看完整报告</p>
                            <button
                                onClick={() => router.push(`/result?id=${data.sessionId}`)}
                                className="bg-[#00263e] text-white px-[30px] py-[12px] rounded-full border-none font-semibold cursor-pointer shadow-[0_10px_20px_rgba(0,38,62,0.2)] hover:scale-105 transition-transform"
                            >
                                回到报告
                            </button>
                        </motion.div>
                    ) : null}

                    {/* 4. Guest Simplified Analysis (New) */}
                    {data.isGuest && data.guestAnalysis && (
                        <motion.div
                            custom={3}
                            initial="hidden"
                            animate="visible"
                            variants={revealVariants}
                            className="glass-module rounded-[32px] p-[30px] flex flex-col transition-all duration-400 md:col-span-2 relative overflow-hidden"
                        >
                            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5 bg-[#00263e] text-white w-fit">
                                初步诊断
                            </span>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <span className="text-2xl">🔍</span>
                                        肤质概览
                                    </h3>
                                    <div className="bg-white/40 rounded-2xl p-5 space-y-4">
                                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                                            <span className="text-[#666]">肤质类型</span>
                                            <span className="font-bold text-lg">{data.skinType}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                                            <span className="text-[#666]">肌龄检测</span>
                                            <span className="font-bold text-lg">{data.skinAge}岁</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[#666]">主要关注</span>
                                            <div className="flex gap-2">
                                                {data.guestAnalysis.concerns.map(c => (
                                                    <span key={c} className="text-xs bg-[#FF4D4F]/10 text-[#FF4D4F] px-2 py-1 rounded-md font-medium">
                                                        {c}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <span className="text-2xl">📝</span>
                                        分析摘要
                                    </h3>
                                    <div className="bg-white/40 rounded-2xl p-5 relative">
                                        <p className="text-[#444] leading-relaxed relative z-10">
                                            {data.guestAnalysis.summary}
                                        </p>
                                        <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent z-0 rounded-2xl pointer-events-none" />
                                        <div className="absolute bottom-3 right-4 z-20">
                                            <button
                                                onClick={() => openAuthModal('register')}
                                                className="text-[#00263e] text-xs font-bold hover:underline"
                                            >
                                                查看完整分析 →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tips Teaser */}
                            <div className="bg-[#00263e]/5 rounded-2xl p-5">
                                <h4 className="font-bold flex items-center gap-2 mb-3 text-[#00263e]">
                                    <span>💡</span> 护肤小贴士
                                </h4>
                                <ul className="space-y-2">
                                    {data.guestAnalysis.tips.map((tip, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-[#444]">
                                            <span className="text-[#00263e] mt-1">•</span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    )}

                    {/* 5. Locked Full Report Teaser (Guest Only) */}
                    {data.isGuest && (
                        <motion.div
                            custom={4}
                            initial="hidden"
                            animate="visible"
                            variants={revealVariants}
                            className="glass-module rounded-[32px] p-0 flex flex-col transition-all duration-400 md:col-span-2 relative overflow-hidden min-h-[400px]"
                        >
                            {/* Blurred Content Background used as teaser */}
                            <div className="absolute inset-0 p-8 filter blur-[8px] opacity-60 pointer-events-none select-none overflow-hidden">
                                <div className="flex justify-between items-end mb-8">
                                    <div className="w-1/2 h-8 bg-black/10 rounded-lg"></div>
                                    <div className="w-20 h-20 bg-green-500/20 rounded-full"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="h-32 bg-white/50 rounded-2xl"></div>
                                    <div className="h-32 bg-white/50 rounded-2xl"></div>
                                </div>
                                <div className="h-60 bg-white/50 rounded-2xl mb-4"></div>
                                <div className="space-y-4">
                                    <div className="h-12 bg-black/5 rounded-xl"></div>
                                    <div className="h-12 bg-black/5 rounded-xl"></div>
                                    <div className="h-12 bg-black/5 rounded-xl"></div>
                                </div>
                            </div>

                            {/* Lock Overlay */}
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-white/30 to-white/90 p-8 text-center">
                                <div className="w-16 h-16 bg-[#00263e] rounded-full flex items-center justify-center mb-6 shadow-xl text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </div>

                                <h3 className="text-2xl font-bold text-[#1A1A1A] mb-3">解锁 30+ 页完整专业报告</h3>
                                <p className="text-[#666] max-w-md mb-8 leading-relaxed">
                                    注册账户即可永久保存您的测肤数据，解锁十二维深度分析雷达图、
                                    个性化护肤方案生成、以及成分级产品推荐。
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                                    <button
                                        onClick={() => openAuthModal('register')}
                                        className="flex-1 py-4 bg-[#00263e] text-white rounded-xl font-bold text-base shadow-lg hover:bg-[#003859] hover:scale-[1.02] transition-all"
                                    >
                                        立即注册解锁
                                    </button>
                                    <button
                                        onClick={() => openAuthModal('login')}
                                        className="flex-1 py-4 bg-white border border-gray-200 text-[#333] rounded-xl font-bold text-base shadow-sm hover:bg-gray-50 transition-all"
                                    >
                                        已有账号登录
                                    </button>
                                </div>

                                <p className="mt-6 text-xs text-[#999] bg-white/50 px-3 py-1 rounded-full">
                                    🎁 新用户注册限时解锁所有高级功能
                                </p>
                            </div>
                        </motion.div>
                    )}

                </div>
                {/* Footer */}
                <div className="w-full text-center py-8 text-[#999] text-xs font-medium opacity-80">
                    © 2026 NIHPLOD. All Rights Reserved.
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
                                    onClick={() => {
                                        setShowModal(false);
                                        openAuthModal('login');
                                    }}
                                    className="p-4 rounded-2xl border-none font-semibold cursor-pointer transition-colors bg-[#00263e] text-white hover:bg-[#003859]"
                                >
                                    登录更新本次报告
                                </button>
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        openAuthModal('register');
                                    }}
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
        </div >
    );
}
