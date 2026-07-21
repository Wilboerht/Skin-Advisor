"use client";

import { useState, useEffect } from "react";
import { DashboardCharts } from "@/components/admin/charts/DashboardCharts";
import { useDashboardStats } from "@/components/admin/charts/DashboardCharts";
import { Loader2, Users, Package, Activity, CheckCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

function StatCard({ title, value, icon: Icon, delay, suffix }: { title: string; value: number; icon: React.ElementType; delay: number; suffix?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-[#1A1A1A]/40 uppercase tracking-wider">{title}</p>
                    <p className="text-3xl font-bold text-[#1A1A1A] mt-2">{value.toLocaleString()}{suffix}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#1A1A1A]/5 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#1A1A1A]/60" />
                </div>
            </div>
        </motion.div>
    );
}

export default function AdminDashboardPage() {
    const { stats, loading, error, refresh } = useDashboardStats();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        refresh();
    };

    useEffect(() => {
        if (!loading && isRefreshing) setIsRefreshing(false);
    }, [loading, isRefreshing]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A1A1A]/30" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <p className="text-sm text-red-500">统计数据加载失败</p>
                <button onClick={() => window.location.reload()} className="text-sm text-[#3D4430] underline">
                    点击重试
                </button>
            </div>
        );
    }

    const overview = stats?.overview;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">仪表板</h1>
                    <p className="text-sm text-[#5E5E5E] mt-1">护肤顾问系统数据概览</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-lg border border-[#1A1A1A]/10 text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:bg-[#F8F7F4] transition-colors"
                    title="刷新数据"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="数据统计">
                <StatCard
                    title="注册用户"
                    value={overview?.totalUsers || 0}
                    icon={Users}
                    delay={0}
                />
                <StatCard
                    title="产品总数"
                    value={overview?.totalProducts || 0}
                    icon={Package}
                    delay={0.05}
                />
                <StatCard
                    title="诊断会话"
                    value={overview?.totalSessions || 0}
                    icon={Activity}
                    delay={0.1}
                />
                <StatCard
                    title="完成率"
                    value={overview?.completionRate || 0}
                    icon={CheckCircle}
                    delay={0.15}
                    suffix="%"
                />
            </div>

            {/* Charts */}
            <DashboardCharts />

            {/* Today's Activity */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5"
            >
                <h3 className="text-lg font-serif text-[#1A1A1A] mb-1">今日活动</h3>
                <p className="text-xs text-[#1A1A1A]/40 mb-4 uppercase tracking-wider">Today&apos;s Activity</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F8F7F4]">
                        <div className="w-10 h-10 rounded-full bg-[#C19F70]/20 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-[#C19F70]" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#1A1A1A]">{overview?.todaySessions || 0}</p>
                            <p className="text-xs text-[#5E5E5E]">今日开始测试</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F8F7F4]">
                        <div className="w-10 h-10 rounded-full bg-[#3D4430]/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-[#3D4430]" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#1A1A1A]">{overview?.todayCompletions || 0}</p>
                            <p className="text-xs text-[#5E5E5E]">今日完成测试</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
