
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "next-view-transitions";
import { ArrowLeft, Clock, ChevronRight, LogOut, User as UserIcon } from "lucide-react";
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

    if (loading || !user) return null;

    return (
        <div className="min-h-screen bg-[#FAF8F5]">
            {/* Header */}
            <header className="bg-white border-b border-brand-beige/50 sticky top-0 z-10 px-4 h-16 flex items-center justify-between shadow-sm">
                <Link href="/" className="flex items-center gap-2 text-brand-charcoal hover:text-brand-gold transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">返回首页</span>
                </Link>
                <div className="font-serif text-lg tracking-wide text-brand-gold">我的档案</div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    退出
                </button>
            </header>

            <main className="max-w-2xl mx-auto p-4 py-8">
                {/* User Info Card */}
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-brand-beige/30 mb-8 flex items-center gap-4"
                >
                    <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold">
                        <UserIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-serif text-brand-charcoal">{user.name || "Skin Advisor User"}</h2>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <div className="mt-2 inline-flex px-2 py-0.5 rounded text-xs bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
                            {user.role === 'admin' ? '管理员' : '尊贵会员'}
                        </div>
                    </div>
                </m.div>

                {/* History List */}
                <h3 className="text-lg font-medium text-brand-charcoal mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-brand-gold" />
                    测评历史
                </h3>

                <div className="space-y-3">
                    {loadingHistory ? (
                        <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
                    ) : auditHistory.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-400 text-sm mb-4">暂无测评记录</p>
                            <Link href="/questions" className="text-brand-gold hover:underline text-sm">
                                立即开始新的测评
                            </Link>
                        </div>
                    ) : (
                        auditHistory.map((session, i) => (
                            <m.div
                                key={session.sessionId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Link
                                    href={`/result?id=${session.sessionId}`}
                                    className="block group"
                                >
                                    <div className="bg-white hover:bg-brand-cream/30 border border-brand-beige/30 p-4 rounded-xl transition-all hover:shadow-md hover:border-brand-gold/30 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-brand-charcoal font-medium">
                                                    {session.analysisResult?.skinProfile?.typeLabel || "未知肤质"}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    | 评分: {session.analysisResult?.faceAnalysis?.overallScore || '-'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {new Date(session.completedAt).toLocaleString('zh-CN')}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-gold transition-colors" />
                                    </div>
                                </Link>
                            </m.div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
