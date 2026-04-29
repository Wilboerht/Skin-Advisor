"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, Clock, Loader2, ChevronRight, Calendar, BarChart3 } from "lucide-react";

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

    const getScoreTag = (score?: number) => {
        if (!score) return { bg: "bg-slate-100", text: "text-slate-500" };
        if (score >= 85) return { bg: "bg-emerald-50", text: "text-emerald-600" };
        if (score >= 70) return { bg: "bg-amber-50", text: "text-amber-600" };
        return { bg: "bg-rose-50", text: "text-rose-500" };
    };

    if (!user && !isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop with Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-[460px] bg-white rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[88vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>

                        {/* Header */}
                        <div className="p-10 pt-14 pb-6 text-center shrink-0">
                            <div className="mb-6 flex justify-center">
                                <img
                                    src="/NIHPLOD-logo.svg"
                                    alt="NIHPLOD"
                                    className="h-[34px] object-contain"
                                />
                            </div>
                            <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">
                                测肤记录
                            </p>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar min-h-0">
                            {loadingHistory ? (
                                <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-xs font-medium">加载中...</span>
                                </div>
                            ) : auditHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center py-6">
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                                        <Clock className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <h4 className="text-slate-900 font-bold text-sm mb-1">暂无测肤记录</h4>
                                    <p className="text-slate-400 text-xs mb-6 max-w-[220px] leading-relaxed">
                                        开始您的第一次 AI 皮肤分析，记录您的护肤历程
                                    </p>
                                    <button
                                        onClick={() => {
                                            onClose();
                                            router.push("/questions");
                                        }}
                                        className="px-6 py-2.5 bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 rounded-xl text-xs font-bold tracking-widest hover:bg-[#8B7355]/20 transition-all"
                                    >
                                        立即测肤
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Stats Summary */}
                                    <div className="flex items-center gap-4 mb-5 px-1">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <BarChart3 size={13} className="text-slate-400" />
                                            <span>共 {auditHistory.length} 次</span>
                                        </div>
                                        {auditHistory[0]?.analysisResult?.faceAnalysis?.overallScore && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Calendar size={13} className="text-slate-400" />
                                                <span>最近 {formatDate(auditHistory[0].completedAt).date}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* History Items */}
                                    {auditHistory.map((session, i) => {
                                        const result = session.analysisResult;
                                        const score = result?.faceAnalysis?.overallScore;
                                        const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                                        const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                                        const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                                        const dateInfo = formatDate(session.completedAt);
                                        const scoreTag = getScoreTag(score);

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
                                                    className="bg-white border border-slate-100 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all duration-200 overflow-hidden"
                                                >
                                                    <div className="p-4">
                                                        <div className="flex items-start justify-between mb-3">
                                                            {/* Date */}
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                                    <Calendar size={14} className="text-slate-400" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs text-slate-700 font-medium">{dateInfo.full.split(' ')[0]}</div>
                                                                    <div className="text-[10px] text-slate-400">{dateInfo.full.split(' ')[1]}</div>
                                                                </div>
                                                            </div>

                                                            {/* Score */}
                                                            {score && (
                                                                <div className={`px-2.5 py-1 rounded-md ${scoreTag.bg} ${scoreTag.text} text-sm font-bold`}>
                                                                    {score} 分
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Tags */}
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {skinType && (
                                                                <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-600 text-[11px] font-medium">
                                                                    {skinType}
                                                                </span>
                                                            )}
                                                            {skinAge && (
                                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                                                                    肤龄 {skinAge}
                                                                </span>
                                                            )}
                                                            {concerns.slice(0, 2).map((c: string, idx: number) => (
                                                                <span key={idx} className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[11px] font-medium">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                            {concerns.length > 2 && (
                                                                <span className="text-[11px] text-slate-400">+{concerns.length - 2}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Bottom bar */}
                                                    <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-400">查看完整报告</span>
                                                        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                                                    </div>
                                                </motion.div>
                                            </Link>
                                        );
                                    })}

                                    {/* Logout */}
                                    <div className="pt-4 flex justify-center">
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <LogOut size={13} />
                                            <span>退出登录</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
