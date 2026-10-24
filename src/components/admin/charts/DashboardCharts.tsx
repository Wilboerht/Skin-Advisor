"use client";

import { useEffect, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useMounted } from "@/hooks/use-mounted";
import { PanelCard } from "@/components/admin/PanelCard";
import { adminFetch } from "@/lib/admin-fetch";

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

const CHART_COLORS = [
    "#00263E",
    "#4A6272",
    "#B8A47B",
    "#3D8055",
    "#D9730D",
    "#7A9A5B",
];

export function useDashboardStats() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = () => setRefreshKey((value) => value + 1);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        adminFetch("/api/admin/stats", { signal: controller.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (data.success) {
                    setStats(data.data);
                } else {
                    setError(data.error || "统计数据加载失败");
                }
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError(err.message || "统计数据加载失败");
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [refreshKey]);

    return { stats, loading, error, refresh };
}

function ChartSkeleton() {
    return (
        <div className="flex h-72 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-charcoal/20 border-t-brand-primary" />
        </div>
    );
}

export function DashboardCharts({
    stats,
    loading,
}: {
    stats: StatsData | null;
    loading?: boolean;
}) {
    const mounted = useMounted();
    const distribution = stats?.skinTypeDistribution ?? [];
    const growth = stats?.weeklyGrowth ?? [];
    const distributionTotal = distribution.reduce(
        (sum, item) => sum + item.value,
        0,
    );
    const hasDistribution = distribution.some((item) => item.value > 0);
    const hasGrowth = growth.some(
        (item) => item.started > 0 || item.completed > 0,
    );

    return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <PanelCard
                title="肤质分布"
                action={
                    <span className="text-xs tabular-nums text-brand-charcoal/65">
                        共 {distributionTotal} 条
                    </span>
                }
            >
                {loading ? (
                    <ChartSkeleton />
                ) : !mounted ? (
                    <ChartSkeleton />
                ) : !hasDistribution ? (
                    <p className="py-10 text-center text-sm text-brand-charcoal/65">
                        暂无肤质数据
                    </p>
                ) : (
                    <div className="flex h-72 flex-col">
                        <div className="min-h-0 flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={78}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {distribution.map((entry, index) => (
                                            <Cell
                                                key={entry.name}
                                                fill={
                                                    CHART_COLORS[
                                                        index %
                                                            CHART_COLORS.length
                                                    ] ??
                                                    entry.fill ??
                                                    CHART_COLORS[0]
                                                }
                                                stroke="none"
                                            />
                                        ))}
                                    </Pie>
                                    <ChartTooltip
                                        contentStyle={{
                                            backgroundColor: "#fff",
                                            border: "1px solid rgba(0,38,62,0.1)",
                                            borderRadius: 8,
                                            boxShadow:
                                                "0 4px 12px rgba(0,0,0,0.06)",
                                            fontSize: 12,
                                        }}
                                        formatter={(value, name) => [
                                            `${value} 条`,
                                            name,
                                        ]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                            {distribution.map((entry, index) => (
                                <span
                                    key={entry.name}
                                    className="inline-flex items-center gap-1.5 text-xs text-brand-charcoal/70"
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{
                                            backgroundColor:
                                                CHART_COLORS[
                                                    index % CHART_COLORS.length
                                                ] ??
                                                entry.fill ??
                                                CHART_COLORS[0],
                                        }}
                                    />
                                    {entry.name}（{entry.value}）
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </PanelCard>

            <PanelCard
                title="近 7 日趋势"
                action={
                    <span className="text-xs text-brand-charcoal/65">
                        开始 / 完成
                    </span>
                }
            >
                {loading ? (
                    <ChartSkeleton />
                ) : !mounted ? (
                    <ChartSkeleton />
                ) : !hasGrowth ? (
                    <p className="py-10 text-center text-sm text-brand-charcoal/65">
                        暂无趋势数据
                    </p>
                ) : (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={growth}
                                margin={{
                                    top: 8,
                                    right: 8,
                                    left: -20,
                                    bottom: 0,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#E5E5E5"
                                />
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#6b7280", fontSize: 11 }}
                                    dy={8}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#6b7280", fontSize: 11 }}
                                />
                                <ChartTooltip
                                    cursor={{ fill: "rgba(0,38,62,0.04)" }}
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid rgba(0,38,62,0.1)",
                                        borderRadius: 8,
                                        boxShadow:
                                            "0 4px 12px rgba(0,0,0,0.06)",
                                        fontSize: 12,
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 11 }}
                                    formatter={(value) =>
                                        value === "started" ? "开始" : "完成"
                                    }
                                />
                                <Bar
                                    dataKey="started"
                                    name="started"
                                    fill={CHART_COLORS[0]}
                                    radius={[4, 4, 0, 0]}
                                    barSize={16}
                                />
                                <Bar
                                    dataKey="completed"
                                    name="completed"
                                    fill={CHART_COLORS[3]}
                                    radius={[4, 4, 0, 0]}
                                    barSize={16}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </PanelCard>
        </div>
    );
}
