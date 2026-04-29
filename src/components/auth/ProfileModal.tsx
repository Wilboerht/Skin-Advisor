"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, Clock, Loader2, ChevronRight, ArrowUpRight } from "lucide-react";

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
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

        if (isToday) return "今天";
        if (isYesterday) return "昨天";
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    const getScoreColor = (score?: number) => {
        if (!score) return "text-[#787774]";
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
                        className="absolute inset-0 bg-[#2d2a26]/40 backdrop-blur-md"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className="relative z-10 w-full max-w-[420px] max-h-[80vh] flex flex-col"
                        style={{
                            background: 'linear-gradient(180deg, #F8F6F1 0%, #F3F0E9 100%)',
                            borderRadius: 24,
                            boxShadow: '0 32px 64px -16px rgba(45, 42, 38, 0.25), inset 0 1px 1px rgba(255,255,255,0.6)',
                            border: '1px solid rgba(139, 115, 85, 0.15)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="shrink-0 px-6 pt-6 pb-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0"
                                        style={{ background: 'rgba(61, 68, 48, 0.1)', color: '#3D4430' }}>
                                        {(() => {
                                            const latestAvatar = auditHistory[0]?.analysisResult?.generatedAvatar;
                                            if (latestAvatar) {
                                                return <img src={latestAvatar} alt="" className="w-full h-full object-cover" />;
                                            }
                                            const avatarUrl = (user as any)?.avatarUrl;
                                            if (avatarUrl) {
                                                return <img src={avatarUrl} alt="" className="w-full h-full object-cover" />;
                                            }
                                            return user?.name?.[0]?.toUpperCase() || "?";
                                        })()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold" style={{ color: '#2d2a26' }}>{user?.name}</div>
                                        <div className="text-[11px]" style={{ color: '#a89582' }}>测肤记录</div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                                    style={{ background: 'rgba(139, 115, 85, 0.08)', color: '#8B7355' }}
                                >
                                    <X size={15} strokeWidth={2.5} />
                                </button>
                            </div>

                            {auditHistory.length > 0 && (
                                <div className="flex items-center gap-4 px-1">
                                    <span className="text-[11px] font-medium" style={{ color: '#a89582' }}>
                                        共 {auditHistory.length} 次测肤
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar min-h-0">
                            {loadingHistory ? (
                                <div className="h-32 flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a89582' }} />
                                    <span className="text-[11px]" style={{ color: '#a89582' }}>加载中...</span>
                                </div>
                            ) : auditHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center py-8 px-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                                        style={{ background: 'rgba(139, 115, 85, 0.08)' }}>
                                        <Clock className="w-5 h-5" style={{ color: '#c4b5a2' }} />
                                    </div>
                                    <p className="text-sm font-medium mb-1" style={{ color: '#2d2a26' }}>暂无测肤记录</p>
                                    <p className="text-[11px] mb-5" style={{ color: '#a89582' }}>
                                        开始第一次 AI 皮肤分析
                                    </p>
                                    <button
                                        onClick={() => { onClose(); router.push("/questions"); }}
                                        className="px-5 py-2 rounded-lg text-[11px] font-bold tracking-widest transition-all"
                                        style={{
                                            background: 'rgba(61, 68, 48, 0.9)',
                                            color: '#fff',
                                        }}
                                    >
                                        立即测肤
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {auditHistory.map((session, i) => {
                                        const result = session.analysisResult;
                                        const score = result?.faceAnalysis?.overallScore;
                                        const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                                        const dateLabel = formatDate(session.completedAt);

                                        return (
                                            <Link
                                                href={`/result?id=${session.sessionId}`}
                                                key={session.sessionId}
                                                className="block group"
                                            >
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                                                    style={{
                                                        background: 'transparent',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        (e.currentTarget as HTMLElement).style.background = 'rgba(139, 115, 85, 0.06)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                    }}
                                                >
                                                    {/* Date */}
                                                    <div className="w-12 text-[11px] font-medium shrink-0" style={{ color: '#a89582' }}>
                                                        {dateLabel}
                                                    </div>

                                                    {/* Skin Type */}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[13px] font-medium truncate block" style={{ color: '#2d2a26' }}>
                                                            {skinType || "皮肤分析"}
                                                        </span>
                                                    </div>

                                                    {/* Score */}
                                                    {score && (
                                                        <div className={`text-[13px] font-bold tabular-nums ${getScoreColor(score)}`}>
                                                            {score}
                                                        </div>
                                                    )}

                                                    {/* Arrow */}
                                                    <ArrowUpRight
                                                        size={14}
                                                        className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                                        style={{ color: '#c4b5a2' }}
                                                    />
                                                </motion.div>
                                            </Link>
                                        );
                                    })}

                                    {/* Logout */}
                                    <div className="pt-2 flex justify-center">
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] transition-all"
                                            style={{ color: '#a89582' }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLElement).style.color = '#c45a4a';
                                                (e.currentTarget as HTMLElement).style.background = 'rgba(196, 90, 74, 0.06)';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLElement).style.color = '#a89582';
                                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                            }}
                                        >
                                            <LogOut size={12} />
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
