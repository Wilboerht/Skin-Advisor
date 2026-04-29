
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "next-view-transitions";
import { ArrowLeft, Clock, Loader2, ScanFace, Calendar, TrendingUp, ChevronRight, Sparkles, LogOut } from "lucide-react";
import { m } from "framer-motion";

interface HistorySession {
    sessionId: string;
    completedAt: string;
    analysisResult: any;
}

export default function ProfilePage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [auditHistory, setAuditHistory] = useState<HistorySession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            try {
                const res = await fetch("/api/advisor/history");
                if (res.ok) {
                    const data = await res.json();
                    setAuditHistory(data.history);
                }
            } catch (e) {
                console.error("History fetch error:", e);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [user]);

    const handleLogout = async () => {
        await logout();
        router.push("/");
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
            year: date.toLocaleDateString('zh-CN', { year: 'numeric' }),
            weekday: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
            full: date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        };
    };

    const getSkinTypeColor = (type?: string) => {
        if (!type) return "bg-[#3D4430]/10 text-[#3D4430]";
        const t = type.toLowerCase();
        if (t.includes('干')) return "bg-amber-50 text-amber-700 border-amber-200";
        if (t.includes('油')) return "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (t.includes('敏')) return "bg-rose-50 text-rose-700 border-rose-200";
        if (t.includes('混')) return "bg-sky-50 text-sky-700 border-sky-200";
        return "bg-[#3D4430]/10 text-[#3D4430] border-[#3D4430]/20";
    };

    const getScoreColor = (score?: number) => {
        if (!score) return "text-[#5E5E5E]";
        if (score >= 85) return "text-emerald-600";
        if (score >= 70) return "text-amber-600";
        return "text-rose-500";
    };

    const getScoreBg = (score?: number) => {
        if (!score) return "bg-[#F0EDE1]";
        if (score >= 85) return "bg-emerald-50";
        if (score >= 70) return "bg-amber-50";
        return "bg-rose-50";
    };

    if (loading || !user) return null;

    const latestScore = auditHistory[0]?.analysisResult?.faceAnalysis?.overallScore;
    const avgScore = auditHistory.length > 0
        ? Math.round(auditHistory.reduce((sum, s) => sum + (s.analysisResult?.faceAnalysis?.overallScore || 0), 0) / auditHistory.length)
        : null;

    return (
        <div className="min-h-screen bg-[#FAF9F6]">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-[#E8E4DC] sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 text-[#3D4430] hover:text-[#2a2f21] transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">返回</span>
                </Link>
                <div className="flex items-center gap-2 text-[#1A1A1A]">
                    <Sparkles className="w-4 h-4 text-[#3D4430]" />
                    <span className="text-base font-semibold tracking-tight">测肤记录</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-sm text-[#5E5E5E] hover:text-red-600 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">退出</span>
                </button>
            </header>

            <main className="max-w-2xl mx-auto p-4 py-6 sm:py-8">
                {/* User greeting */}
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h1 className="text-xl font-semibold text-[#1A1A1A] tracking-tight">
                        你好，{user.name || "朋友"}
                    </h1>
                    <p className="text-sm text-[#5E5E5E] mt-1">
                        以下是您的测肤历史记录
                    </p>
                </m.div>

                {/* Stats cards */}
                {auditHistory.length > 0 && (
                    <m.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-3 gap-3 mb-6"
                    >
                        <div className="bg-white rounded-xl border border-[#E8E4DC] p-4 text-center">
                            <div className="text-2xl font-bold text-[#3D4430]">{auditHistory.length}</div>
                            <div className="text-[11px] text-[#5E5E5E] mt-0.5">测肤次数</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#E8E4DC] p-4 text-center">
                            <div className={`text-2xl font-bold ${latestScore ? getScoreColor(latestScore) : 'text-[#5E5E5E]'}`}>
                                {latestScore || '--'}
                            </div>
                            <div className="text-[11px] text-[#5E5E5E] mt-0.5">最近评分</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#E8E4DC] p-4 text-center">
                            <div className={`text-2xl font-bold ${avgScore ? getScoreColor(avgScore) : 'text-[#5E5E5E]'}`}>
                                {avgScore || '--'}
                            </div>
                            <div className="text-[11px] text-[#5E5E5E] mt-0.5">平均评分</div>
                        </div>
                    </m.div>
                )}

                {/* History list */}
                <div className="space-y-3">
                    {loadingHistory ? (
                        <div className="h-48 flex flex-col items-center justify-center text-[#5E5E5E] gap-3">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-xs font-medium">加载记录中...</span>
                        </div>
                    ) : auditHistory.length === 0 ? (
                        <m.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-16 bg-white rounded-xl border border-dashed border-[#D9D0C3]"
                        >
                            <div className="w-16 h-16 bg-[#F0EDE1] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-7 h-7 text-[#A89F91]" />
                            </div>
                            <h3 className="text-[#1A1A1A] font-semibold mb-1">暂无测肤记录</h3>
                            <p className="text-[#5E5E5E] text-sm mb-5">
                                开始您的第一次 AI 皮肤分析，记录护肤历程
                            </p>
                            <Link
                                href="/questions"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3D4430] text-white rounded-lg text-sm font-medium hover:bg-[#2a2f21] transition-colors"
                            >
                                <ScanFace className="w-4 h-4" />
                                立即测肤
                            </Link>
                        </m.div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between px-1 mb-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
                                    <Calendar className="w-4 h-4 text-[#3D4430]" />
                                    全部记录
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-[#A89F91]">
                                    <TrendingUp size={12} />
                                    按时间倒序
                                </div>
                            </div>

                            {auditHistory.map((session, i) => {
                                const result = session.analysisResult;
                                const score = result?.faceAnalysis?.overallScore;
                                const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                                const skinTypeRaw = result?.skinProfile?.type || result?.skinType?.type;
                                const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                                const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                                const dateInfo = formatDate(session.completedAt);

                                return (
                                    <m.div
                                        key={session.sessionId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                    >
                                        <Link
                                            href={`/result?id=${session.sessionId}`}
                                            className="block group"
                                        >
                                            <div className="bg-white rounded-xl border border-[#E8E4DC] hover:border-[#3D4430]/30 hover:shadow-lg transition-all duration-200 overflow-hidden">
                                                <div className="p-4 sm:p-5">
                                                    <div className="flex items-start gap-4">
                                                        {/* Date block */}
                                                        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-[#F0EDE1] flex flex-col items-center justify-center text-center">
                                                            <span className="text-[10px] text-[#5E5E5E] font-medium leading-none">{dateInfo.date.split('/')[0]}月</span>
                                                            <span className="text-lg font-bold text-[#3D4430] leading-none mt-0.5">{dateInfo.date.split('/')[1]}</span>
                                                            <span className="text-[9px] text-[#A89F91] leading-none mt-0.5">{dateInfo.weekday}</span>
                                                        </div>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    {skinType && (
                                                                        <h3 className="text-base font-semibold text-[#1A1A1A] truncate">
                                                                            {skinType}
                                                                        </h3>
                                                                    )}
                                                                    <p className="text-xs text-[#A89F91] mt-0.5">{dateInfo.full}</p>
                                                                </div>

                                                                {score && (
                                                                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getScoreBg(score)} flex flex-col items-center justify-center`}>
                                                                        <span className={`text-lg font-bold ${getScoreColor(score)} leading-none`}>{score}</span>
                                                                        <span className="text-[9px] text-[#5E5E5E] leading-none mt-0.5">分</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Tags */}
                                                            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                                                                {skinType && (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getSkinTypeColor(skinTypeRaw)}`}>
                                                                        {skinType}
                                                                    </span>
                                                                )}
                                                                {skinAge && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F0E8] text-[#8B7355]">
                                                                        肤龄 {skinAge} 岁
                                                                    </span>
                                                                )}
                                                                {concerns.slice(0, 2).map((c: string, idx: number) => (
                                                                    <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F5] text-[#5E5E5E]">
                                                                        {c}
                                                                    </span>
                                                                ))}
                                                                {concerns.length > 2 && (
                                                                    <span className="text-[11px] text-[#A89F91]">+{concerns.length - 2}</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Arrow */}
                                                        <div className="flex-shrink-0 self-center">
                                                            <ChevronRight className="w-5 h-5 text-[#D9D0C3] group-hover:text-[#3D4430] group-hover:translate-x-0.5 transition-all" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </m.div>
                                );
                            })}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
