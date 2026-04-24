"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, User as UserIcon, Clock, ChevronRight, Loader2, Smartphone, Sparkles, User, LayoutGrid } from "lucide-react";

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
    const { user, refresh, logout } = useAuth();
    const router = useRouter();
    const toast = useToast();

    // UI State
    const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');

    // History State
    const [auditHistory, setAuditHistory] = useState<HistorySession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Profile Edit State
    const [editName, setEditName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Initialize data
    useEffect(() => {
        if (isOpen && user) {
            setEditName(user.name || "");

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

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            toast.error("昵称不能为空");
            return;
        }
        if (editName === user?.name) return;

        setIsSaving(true);
        try {
            const res = await fetch("/api/auth/me", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName })
            });

            if (res.ok) {
                toast.success("保存成功");
                await refresh();
            } else {
                const data = await res.json();
                toast.error(data.error || "保存失败");
            }
        } catch (e) {
            toast.error("请求失败");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            toast.success("已安全退出");
            onClose();
        } catch (e) {
            toast.error("退出失败");
        }
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
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Main Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="relative z-10 w-full max-w-[840px] h-[600px] bg-white rounded-2xl overflow-hidden flex shadow-2xl shadow-black/10 flex-col md:flex-row border border-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* --- LEFT SIDEBAR (Notion Style) --- */}
                        <div className="w-full md:w-[240px] bg-zinc-50/80 backdrop-blur-sm p-6 flex flex-col flex-shrink-0 border-r border-zinc-200/50">

                            {/* User Profile Summary */}
                            <div className="flex items-center gap-4 px-2 mb-8 mt-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 font-bold text-lg border border-zinc-300/50 overflow-hidden">
                                    {user?.name?.[0]?.toUpperCase() || <UserIcon size={20} />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-base font-bold text-zinc-900 truncate">
                                        {user?.name}
                                    </span>
                                    <span className="text-[11px] font-bold text-zinc-400 tracking-widest">
                                        {user?.role === 'admin' ? '管理员' : '正式会员'}
                                    </span>
                                </div>
                            </div>

                            {/* Navigation Menu */}
                            <div className="w-full space-y-1 flex-1">
                                <p className="px-3 mb-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">个人设置</p>
                                <button
                                    onClick={() => setActiveTab('profile')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'profile'
                                        ? "bg-zinc-200/60 text-zinc-900 font-medium"
                                        : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-900"
                                        }`}
                                >
                                    <User size={16} />
                                    <span>账户资料</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'history'
                                        ? "bg-zinc-200/60 text-zinc-900 font-medium"
                                        : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-900"
                                        }`}
                                >
                                    <LayoutGrid size={16} />
                                    <span>测评记录</span>
                                </button>
                            </div>

                            {/* Bottom Actions */}
                            <div className="pt-4 border-t border-zinc-200/50 mt-auto">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-zinc-500 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all text-sm"
                                >
                                    <LogOut size={16} />
                                    <span>退出登录</span>
                                </button>
                            </div>
                        </div>

                        {/* --- RIGHT CONTENT AREA --- */}
                        <div className="flex-1 bg-white flex flex-col min-h-0 relative">
                            {/* Header Bar */}
                            <div className="h-14 flex items-center justify-between px-8 border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-20">
                                <h3 className="text-base font-bold text-zinc-900">
                                    {activeTab === 'profile' ? '账户资料' : '测评记录'}
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">

                                {/* PROFILE CONTENT (Apple Style Grouped List) */}
                                {activeTab === 'profile' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="max-w-lg mx-auto space-y-5 h-full flex flex-col justify-center"
                                    >
                                        {/* Avatar Section (Compacted) */}
                                        <div className="flex flex-col items-center py-1">
                                            <div className="w-18 h-18 rounded-full bg-zinc-100 border-4 border-white shadow-sm flex items-center justify-center text-3xl mb-2">
                                                {user?.name?.[0]?.toUpperCase() || "👤"}
                                            </div>
                                            <h4 className="text-lg font-bold text-zinc-900">{user?.name}</h4>
                                            <p className="text-[10px] text-zinc-400 mt-0.5 tracking-widest font-bold">正式会员</p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Group 1: Identity */}
                                            <div>
                                                <h5 className="px-4 mb-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">个人信息</h5>
                                                <div className="bg-zinc-50/50 rounded-xl border border-zinc-200/60 overflow-hidden">
                                                    {/* Row: Name */}
                                                    <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-zinc-100">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight mb-0.5">昵称</span>
                                                            <input
                                                                type="text"
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                onBlur={handleSaveProfile}
                                                                className="text-sm font-medium text-zinc-900 bg-transparent outline-none focus:text-blue-600 transition-colors w-full"
                                                                placeholder="设置您的昵称"
                                                            />
                                                        </div>
                                                        {isSaving ? (
                                                            <Loader2 size={14} className="animate-spin text-zinc-400" />
                                                        ) : (
                                                            <ChevronRight size={14} className="text-zinc-300" />
                                                        )}
                                                    </div>

                                                    {/* Row: Phone */}
                                                    <div className="px-4 py-3 flex items-center justify-between bg-white">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight mb-0.5">绑定手机</span>
                                                            <span className="text-sm font-medium text-zinc-900">{user?.phone || "未绑定手机"}</span>
                                                        </div>
                                                        <Smartphone size={16} className="text-zinc-300" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Group 2: Account Level */}
                                            <div>
                                                <h5 className="px-4 mb-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">账户权限</h5>
                                                <div className="bg-zinc-50/50 rounded-xl border border-zinc-200/60 overflow-hidden">
                                                    <div className="px-4 py-3 flex items-center justify-between bg-white">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                                                                <Sparkles size={14} fill="currentColor" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-zinc-900">会员等级</span>
                                                                <span className="text-[10px] text-zinc-400 font-medium italic">您已获得正式会员权限</span>
                                                            </div>
                                                        </div>
                                                        <span className="px-2 py-0.5 bg-zinc-100 rounded text-[10px] font-bold text-zinc-600 border border-zinc-200">正式</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* HISTORY CONTENT (Notion Gallery Style) */}
                                {activeTab === 'history' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="h-full"
                                    >
                                        {loadingHistory ? (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-3">
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span className="text-[10px] font-bold tracking-widest">加载中...</span>
                                            </div>
                                        ) : auditHistory.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-100">
                                                    <Clock className="w-6 h-6 text-zinc-300" />
                                                </div>
                                                <h4 className="text-zinc-900 font-bold mb-1">暂无测评记录</h4>
                                                <p className="text-zinc-400 text-xs mb-6 max-w-[200px]">
                                                    开始您的第一次 AI 皮肤分析，记录您的护肤历程。
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        router.push("/questions");
                                                    }}
                                                    className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors"
                                                >
                                                    立即测速
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4 pb-4">
                                                {auditHistory.map((session, i) => (
                                                    <Link
                                                        href={`/result?id=${session.sessionId}`}
                                                        key={session.sessionId}
                                                        className="group"
                                                    >
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            className="bg-white p-5 rounded-2xl border border-zinc-200 hover:border-zinc-400 hover:shadow-sm transition-all duration-200 h-full flex flex-col gap-3 relative"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-0.5 bg-zinc-50 rounded">
                                                                    {new Date(session.completedAt).toLocaleDateString()}
                                                                </span>
                                                                <div className="text-2xl font-bold tracking-tighter text-zinc-900">
                                                                    {session.analysisResult?.faceAnalysis?.overallScore || '--'}
                                                                    <span className="text-[10px] text-zinc-300 ml-0.5 font-normal">pts</span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-auto">
                                                                <h4 className="text-sm font-bold text-zinc-900">
                                                                    {session.analysisResult?.skinProfile?.typeLabel || "皮肤深度分析"}
                                                                </h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                    <span className="text-[10px] text-zinc-400">已生成详细报告</span>
                                                                </div>
                                                            </div>


                                                        </motion.div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
