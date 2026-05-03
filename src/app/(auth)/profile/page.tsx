
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "next-view-transitions";
import { ArrowLeft, Clock, Loader2, ChevronRight, ChevronLeft, Calendar, BarChart3, ScanFace, LogOut } from "lucide-react";
import { m } from "framer-motion";

interface HistorySession {
    sessionId: string;
    completedAt: string;
    analysisResult: any;
}

// Notion pastel tag colors
const TAG_COLORS = {
    gray: { bg: '#F1F1EF', text: '#787774' },
    green: { bg: '#EDF3EC', text: '#448361' },
    yellow: { bg: '#FBF3DB', text: '#CB912F' },
    red: { bg: '#FDEDE8', text: '#D44C47' },
    blue: { bg: '#E6F3F7', text: '#337EA9' },
    purple: { bg: '#F6F3F9', text: '#9065B0' },
    orange: { bg: '#FAEBDD', text: '#D9730D' },
    pink: { bg: '#F9F2F5', text: '#C14C8A' },
    brown: { bg: '#F4EEEE', text: '#9F6B53' },
};

export default function ProfilePage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [auditHistory, setAuditHistory] = useState<HistorySession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            setLoadingHistory(true);
            try {
                const res = await fetch(`/api/advisor/history?page=${page}&limit=${limit}`);
                if (res.ok) {
                    const data = await res.json();
                    setAuditHistory(data.history);
                    setTotalPages(data.pagination?.totalPages || 0);
                    setTotal(data.pagination?.total || 0);
                }
            } catch (e) {
                console.error("History fetch error:", e);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [user, page, limit]);

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

    const getScoreColors = (score?: number) => {
        if (!score) return TAG_COLORS.gray;
        if (score >= 85) return TAG_COLORS.green;
        if (score >= 70) return TAG_COLORS.yellow;
        return TAG_COLORS.red;
    };

    const getConcernColors = (idx: number) => {
        const palette = [TAG_COLORS.orange, TAG_COLORS.purple, TAG_COLORS.blue, TAG_COLORS.pink, TAG_COLORS.brown];
        return palette[idx % palette.length];
    };

    if (loading || !user) return null;

    const latestScore = auditHistory[0]?.analysisResult?.faceAnalysis?.overallScore;
    const avgScore = auditHistory.length > 0
        ? Math.round(auditHistory.reduce((sum, s) => sum + (s.analysisResult?.faceAnalysis?.overallScore || 0), 0) / auditHistory.length)
        : null;

    return (
        <div
            className="min-h-screen"
            style={{
                backgroundColor: '#FFFFFF',
                backgroundImage: "url('/images/result-bg.svg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
                color: '#37352F',
                fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
                lineHeight: 1.5,
            }}
        >
            {/* Header */}
            <header
                className="sticky top-0 z-10 w-full"
                style={{
                    height: 48,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    borderBottom: '1px solid #E9E9E7',
                }}
            >
                <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F1F1EF] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" style={{ color: '#37352F' }} />
                        </Link>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: '#37352F' }}>NIHPLOD</span>
                            <span style={{ color: '#787774' }}>/</span>
                            <span className="text-sm" style={{ color: '#37352F' }}>测肤记录</span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 text-sm hover:bg-[#F1F1EF] px-2 py-1 rounded transition-colors"
                        style={{ color: '#787774' }}
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>退出</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[900px] mx-auto" style={{ padding: '40px 24px' }}>
                {/* Greeting */}
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1
                        style={{
                            fontSize: '2.5rem',
                            fontWeight: 700,
                            color: '#37352F',
                            margin: '0 0 8px 0',
                            lineHeight: 1.2,
                        }}
                    >
                        你好，{user.name || "朋友"}
                    </h1>
                    <p style={{ fontSize: '0.9rem', color: '#787774' }}>
                        以下是您的测肤历史记录
                    </p>
                </m.div>

                {/* Stats */}
                {auditHistory.length > 0 && (
                    <m.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{
                            marginTop: 24,
                            paddingTop: 16,
                            borderTop: '1px solid #E9E9E7',
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr',
                            alignItems: 'center',
                            gap: '8px 12px',
                        }}
                    >
                        <span
                            style={{
                                gridColumn: 1,
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                color: '#37352F',
                                background: '#F1F1EF',
                                padding: '2px 8px',
                                borderRadius: 4,
                                width: 'fit-content',
                            }}
                        >
                            {auditHistory.length} 次
                        </span>
                        <span style={{ gridColumn: 2, fontSize: '0.875rem', color: '#787774' }}>
                            累计测肤
                        </span>

                        {latestScore && (
                            <>
                                <span
                                    style={{
                                        gridColumn: 1,
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        color: TAG_COLORS.green.text,
                                        background: TAG_COLORS.green.bg,
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        width: 'fit-content',
                                    }}
                                >
                                    {latestScore} 分
                                </span>
                                <span style={{ gridColumn: 2, fontSize: '0.875rem', color: '#787774' }}>
                                    最近评分
                                </span>
                            </>
                        )}

                        {avgScore && (
                            <>
                                <span
                                    style={{
                                        gridColumn: 1,
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        color: '#37352F',
                                        background: '#F1F1EF',
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        width: 'fit-content',
                                    }}
                                >
                                    {avgScore} 分
                                </span>
                                <span style={{ gridColumn: 2, fontSize: '0.875rem', color: '#787774' }}>
                                    平均评分
                                </span>
                            </>
                        )}
                    </m.div>
                )}

                {/* Section Title */}
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        color: '#37352F',
                        margin: '32px 0 16px 0',
                        paddingBottom: 8,
                        borderBottom: '1px solid #E9E9E7',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        letterSpacing: '-0.01em',
                    }}
                >
                    <Calendar className="w-6 h-6" style={{ color: '#37352F' }} />
                    测肤记录
                </m.div>

                {/* History List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {loadingHistory ? (
                        <div className="h-40 flex flex-col items-center justify-center" style={{ gap: 12 }}>
                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#787774' }} />
                            <span style={{ fontSize: '0.875rem', color: '#787774' }}>加载中...</span>
                        </div>
                    ) : auditHistory.length === 0 ? (
                        <m.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-16"
                            style={{
                                background: '#F1F1EF',
                                borderRadius: 4,
                                padding: '40px 24px',
                            }}
                        >
                            <div className="mb-4 flex justify-center">
                                <Clock className="w-8 h-8" style={{ color: '#787774' }} />
                            </div>
                            <h3 className="font-semibold mb-2" style={{ fontSize: '0.95rem', color: '#37352F' }}>
                                暂无测肤记录
                            </h3>
                            <p className="mb-6" style={{ fontSize: '0.875rem', color: '#787774' }}>
                                开始您的第一次 AI 皮肤分析，记录护肤历程
                            </p>
                            <Link
                                href="/questions"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                style={{
                                    background: '#37352F',
                                    color: '#FFFFFF',
                                }}
                            >
                                <ScanFace className="w-4 h-4" />
                                立即测肤
                            </Link>
                        </m.div>
                    ) : (
                        auditHistory.map((session, i) => {
                            const result = session.analysisResult;
                            const score = result?.faceAnalysis?.overallScore;
                            const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                            const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                            const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                            const dateInfo = formatDate(session.completedAt);
                            const scoreColors = getScoreColors(score);

                            return (
                                <m.div
                                    key={session.sessionId}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <Link
                                        href={`/result?id=${session.sessionId}`}
                                        className="block group"
                                    >
                                        <div
                                            className="bg-white hover:bg-[#F1F1EF] transition-colors"
                                            style={{
                                                border: '1px solid #E9E9E7',
                                                borderRadius: 8,
                                                overflow: 'hidden',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                                            }}
                                        >
                                            <div style={{ padding: '16px 20px' }}>
                                                <div className="flex items-start gap-4">
                                                    {/* Date block */}
                                                    <div
                                                        className="flex-shrink-0 flex flex-col items-center justify-center text-center"
                                                        style={{
                                                            width: 48,
                                                            height: 48,
                                                            borderRadius: 4,
                                                            background: '#F1F1EF',
                                                            border: '1px solid #E9E9E7',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '0.7rem', color: '#787774', fontWeight: 500, lineHeight: 1 }}>
                                                            {dateInfo.date.split('/')[0]}月
                                                        </span>
                                                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#37352F', lineHeight: 1, marginTop: 2 }}>
                                                            {dateInfo.date.split('/')[1]}
                                                        </span>
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                {skinType && (
                                                                    <h3 className="font-semibold truncate" style={{ fontSize: '0.95rem', color: '#37352F' }}>
                                                                        {skinType}
                                                                    </h3>
                                                                )}
                                                                <p style={{ fontSize: '0.8rem', color: '#787774', marginTop: 2 }}>
                                                                    {dateInfo.full}
                                                                </p>
                                                            </div>

                                                            {score && (
                                                                <div
                                                                    className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded"
                                                                    style={{
                                                                        background: scoreColors.bg,
                                                                    }}
                                                                >
                                                                    <BarChart3 className="w-3.5 h-3.5" style={{ color: scoreColors.text }} />
                                                                    <span className="font-semibold text-sm" style={{ color: scoreColors.text }}>
                                                                        {score}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Tags */}
                                                        <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 10 }}>
                                                            {skinType && (
                                                                <span
                                                                    className="px-2 py-0.5 rounded font-medium"
                                                                    style={{
                                                                        fontSize: '0.75rem',
                                                                        background: TAG_COLORS.blue.bg,
                                                                        color: TAG_COLORS.blue.text,
                                                                    }}
                                                                >
                                                                    {skinType}
                                                                </span>
                                                            )}
                                                            {skinAge && (
                                                                <span
                                                                    className="px-2 py-0.5 rounded font-medium"
                                                                    style={{
                                                                        fontSize: '0.75rem',
                                                                        background: TAG_COLORS.gray.bg,
                                                                        color: TAG_COLORS.gray.text,
                                                                    }}
                                                                >
                                                                    肤龄 {skinAge}
                                                                </span>
                                                            )}
                                                            {concerns.slice(0, 3).map((c: string, idx: number) => {
                                                                const colors = getConcernColors(idx);
                                                                return (
                                                                    <span
                                                                        key={idx}
                                                                        className="px-2 py-0.5 rounded font-medium"
                                                                        style={{
                                                                            fontSize: '0.75rem',
                                                                            background: colors.bg,
                                                                            color: colors.text,
                                                                        }}
                                                                    >
                                                                        {c}
                                                                    </span>
                                                                );
                                                            })}
                                                            {concerns.length > 3 && (
                                                                <span style={{ fontSize: '0.75rem', color: '#787774' }}>
                                                                    +{concerns.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="flex-shrink-0 self-center">
                                                        <ChevronRight
                                                            className="w-5 h-5 transition-all group-hover:translate-x-0.5"
                                                            style={{ color: '#E9E9E7' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </m.div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-between mt-8"
                        style={{ padding: '12px 0', borderTop: '1px solid #E9E9E7' }}
                    >
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loadingHistory}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F1F1EF]"
                            style={{ color: '#37352F' }}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            上一页
                        </button>

                        <span className="text-sm" style={{ color: '#787774' }}>
                            第 {page} / {totalPages} 页（共 {total} 条）
                        </span>

                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loadingHistory}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F1F1EF]"
                            style={{ color: '#37352F' }}
                        >
                            下一页
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </m.div>
                )}

                {/* Footer */}
                <div
                    style={{
                        borderTop: '1px solid #E9E9E7',
                        marginTop: 32,
                        paddingTop: 32,
                    }}
                >
                    <p style={{ fontSize: 12, color: '#787774', lineHeight: 1.5 }}>
                        测肤记录分页展示，每页 {limit} 条。点击记录可查看完整的护肤报告。
                    </p>
                </div>
            </main>
        </div>
    );
}
