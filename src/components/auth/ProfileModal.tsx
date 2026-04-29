"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, Clock, Loader2, ScanFace, Calendar, TrendingUp, ChevronRight } from "lucide-react";

interface HistorySession {
    sessionId: string;
    completedAt: string;
    analysisResult: any;
}

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [auditHistory, setAuditHistory] = useState<HistorySession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
        if (isOpen && user) {
            const fetchHistory = async () => {
                setLoadingHistory(true);
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
        }
    }, [isOpen, user]);

    const handleLogout = async () => {
        try {
            await logout();
            toast.success("已安全退出");
            onClose();
        } catch (e) {
            toast.error("退出失败");
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
            year: date.toLocaleDateString('zh-CN', { year: 'numeric' }),
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

    if (!user && !isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className="relative z-10 w-full max-w-[520px] max-h-[80vh] bg-[#FAF9F6] rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-[#E8E4DC]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E4DC] bg-white/60 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-[#3D4430] flex items-center justify-center text-white text-sm font-semibold">
                                    {user?.name?.[0]?.toUpperCase() || <ScanFace size={16} />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-[#1A1A1A]">{user?.name}</h3>
                                    <p className="text-[11px] text-[#5E5E5E]">测肤记录</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#5E5E5E] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <LogOut size={13} />
                                    <span>退出</span>
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-[#F0EDE1] text-[#5E5E5E] hover:text-[#1A1A1A] transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                            {loadingHistory ? (
                                <div className="h-48 flex flex-col items-center justify-center text-[#5E5E5E] gap-3">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-xs font-medium">加载记录中...</span>
                                </div>
                            ) : auditHistory.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-center">
                                    <div className="w-14 h-14 bg-[#F0EDE1] rounded-2xl flex items-center justify-center mb-4">
                                        <Clock className="w-6 h-6 text-[#A89F91]" />
                                    </div>
                                    <h4 className="text-[#1A1A1A] font-semibold text-sm mb-1">暂无测肤记录</h4>
                                    <p className="text-[#5E5E5E] text-xs mb-5 max-w-[200px]">
                                        开始您的第一次 AI 皮肤分析，记录护肤历程
                                    </p>
                                    <button
                                        onClick={() => {
                                            onClose();
                                            router.push("/questions");
                                        }}
                                        className="px-5 py-2 bg-[#3D4430] text-white rounded-lg text-xs font-medium hover:bg-[#2a2f21] transition-colors"
                                    >
                                        立即测肤
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Summary stats */}
                                    <div className="flex items-center gap-4 mb-4 px-1">
                                        <div className="flex items-center gap-1.5 text-xs text-[#5E5E5E]">
                                            <TrendingUp size={13} className="text-[#3D4430]" />
                                            <span>共 {auditHistory.length} 次测肤</span>
                                        </div>
                                        {auditHistory[0]?.analysisResult?.faceAnalysis?.overallScore && (
                                            <div className="flex items-center gap-1.5 text-xs text-[#5E5E5E]">
                                                <Calendar size={13} className="text-[#3D4430]" />
                                                <span>最近 {formatDate(auditHistory[0].completedAt).date}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* History list */}
                                    {auditHistory.map((session, i) => {
                                        const result = session.analysisResult;
                                        const score = result?.faceAnalysis?.overallScore;
                                        const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                                        const skinTypeRaw = result?.skinProfile?.type || result?.skinType?.type;
                                        const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                                        const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                                        const dateInfo = formatDate(session.completedAt);

                                        return (
                                            <Link
                                                href={`/result?id=${session.sessionId}`}
                                                key={session.sessionId}
                                                className="block group"
                                            >
                                                <motion.div
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.04 }}
                                                    className="bg-white rounded-xl border border-[#E8E4DC] hover:border-[#3D4430]/30 hover:shadow-md transition-all duration-200 overflow-hidden"
                                                >
                                                    <div className="p-4">
                                                        <div className="flex items-start justify-between mb-3">
                                                            {/* Date */}
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-10 h-10 rounded-lg bg-[#F0EDE1] flex flex-col items-center justify-center text-center">
                                                                    <span className="text-[10px] text-[#5E5E5E] font-medium leading-none">{dateInfo.date.split('/')[0]}月</span>
                                                                    <span className="text-sm font-bold text-[#3D4430] leading-none mt-0.5">{dateInfo.date.split('/')[1]}</span>
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs text-[#5E5E5E]">{dateInfo.year}</div>
                                                                    <div className="text-[10px] text-[#A89F91] mt-0.5">{dateInfo.full.split(' ')[1]}</div>
                                                                </div>
                                                            </div>

                                                            {/* Score */}
                                                            {score && (
                                                                <div className="text-right">
                                                                    <div className={`text-2xl font-bold tracking-tight ${getScoreColor(score)}`}>
                                                                        {score}
                                                                    </div>
                                                                    <div className="text-[10px] text-[#A89F91]">综合评分</div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Skin type & concerns */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {skinType && (
                                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${getSkinTypeColor(skinTypeRaw)}`}>
                                                                    {skinType}
                                                                </span>
                                                            )}
                                                            {skinAge && (
                                                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F0EDE1] text-[#5E5E5E]">
                                                                    肤龄 {skinAge} 岁
                                                                </span>
                                                            )}
                                                            {concerns.slice(0, 2).map((c: string, idx: number) => (
                                                                <span key={idx} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F5F0E8] text-[#8B7355]">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                            {concerns.length > 2 && (
                                                                <span className="text-[11px] text-[#A89F91]">+{concerns.length - 2}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Bottom bar */}
                                                    <div className="px-4 py-2.5 bg-[#FAF9F6] border-t border-[#E8E4DC] flex items-center justify-between">
                                                        <span className="text-[11px] text-[#A89F91]">查看完整报告</span>
                                                        <ChevronRight size={14} className="text-[#A89F91] group-hover:text-[#3D4430] group-hover:translate-x-0.5 transition-all" />
                                                    </div>
                                                </motion.div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
