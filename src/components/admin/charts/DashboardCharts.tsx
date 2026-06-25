"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { m } from "framer-motion";
import { Loader2 } from "lucide-react";

interface StatsData {
    overview: {
        totalUsers: number;
        totalProducts: number;
        totalSessions: number;
        completedSessions: number;

        todaySessions: number;
        todayCompletions: number;
        completionRate: number;
    };
    skinTypeDistribution: Array<{ name: string; value: number; fill: string }>;
    weeklyGrowth: Array<{ day: string; started: number; completed: number }>;
}

export function useDashboardStats() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/admin/stats', { signal: controller.signal })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    setStats(data.data);
                } else {
                }
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, []);

    return { stats, loading };
}

export function SkinTypeDistribution({ data }: { data?: StatsData['skinTypeDistribution'] }) {
    const mounted = useMounted();
    const chartData = data && data.length > 0 ? data : [
        { name: 'No Data', value: 1, fill: '#E5E5E5' }
    ];

    const hasData = data && data.some(d => d.value > 0);

    if (!mounted) {
        return (
            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 h-[340px] flex flex-col"
            >
                <h3 className="text-lg font-serif text-[#1A1A1A] mb-1">肤质分布</h3>
                <p className="text-xs text-[#1A1A1A]/40 mb-6 uppercase tracking-wider">User Skin Type Analysis</p>
                <div className="flex-1 w-full min-h-0" />
            </m.div>
        );
    }

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 h-[340px] flex flex-col"
        >
            <h3 className="text-lg font-serif text-[#1A1A1A] mb-1">肤质分布</h3>
            <p className="text-xs text-[#1A1A1A]/40 mb-6 uppercase tracking-wider">User Skin Type Analysis</p>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={hasData ? 5 : 0}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                            ))}
                        </Pie>
                        {hasData && (
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid rgba(26,26,26,0.1)',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    fontSize: '12px',
                                }}
                                formatter={(value: any, name: any) => [`${value} 人`, name]}
                            />
                        )}
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {hasData ? (
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                    {chartData.filter(d => d.value > 0).map((d) => (
                        <div key={d.name} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }}></span>
                            <span className="text-xs text-[#1A1A1A]/60 font-medium">{d.name} ({d.value})</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-xs text-[#1A1A1A]/30 mt-4">暂无数据</p>
            )}
        </m.div>
    );
}

export function WeeklyGrowth({ data }: { data?: StatsData['weeklyGrowth'] }) {
    const mounted = useMounted();
    const chartData = data || [];
    const hasData = chartData.some(d => d.started > 0 || d.completed > 0);

    if (!mounted) {
        return (
            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 h-[340px] flex flex-col"
            >
                <h3 className="text-lg font-serif text-[#1A1A1A] mb-1">周测肤趋势</h3>
                <p className="text-xs text-[#1A1A1A]/40 mb-6 uppercase tracking-wider">Latest 7 Days</p>
                <div className="flex-1 w-full min-h-0" />
            </m.div>
        );
    }

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 h-[340px] flex flex-col"
        >
            <h3 className="text-lg font-serif text-[#1A1A1A] mb-1">周测肤趋势</h3>
            <p className="text-xs text-[#1A1A1A]/40 mb-6 uppercase tracking-wider">Latest 7 Days</p>

            <div className="flex-1 w-full min-h-0 text-xs">
                {hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                            <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(26, 26, 26, 0.02)' }}
                                contentStyle={{
                                    backgroundColor: '#1A1A1A',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: '#fff'
                                }}
                            />
                            <Legend
                                wrapperStyle={{ fontSize: '10px' }}
                                formatter={(value) => value === 'started' ? '开始测试' : '完成测试'}
                            />
                            <Bar
                                dataKey="started"
                                name="started"
                                fill="#C19F70"
                                radius={[4, 4, 0, 0]}
                                barSize={16}
                            />
                            <Bar
                                dataKey="completed"
                                name="completed"
                                fill="#3D4430"
                                radius={[4, 4, 0, 0]}
                                barSize={16}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-[#1A1A1A]/30">
                        暂无数据
                    </div>
                )}
            </div>
        </m.div>
    );
}

// Wrapper that fetches data
export function DashboardCharts() {
    const { stats, loading } = useDashboardStats();

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 h-[340px] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#1A1A1A]/30" />
                </div>
                <div className="rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 h-[340px] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#1A1A1A]/30" />
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkinTypeDistribution data={stats?.skinTypeDistribution} />
            <WeeklyGrowth data={stats?.weeklyGrowth} />
        </div>
    );
}
