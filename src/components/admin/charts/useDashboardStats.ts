"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

export interface DashboardStatsData {
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
    const [stats, setStats] = useState<DashboardStatsData | null>(null);
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
