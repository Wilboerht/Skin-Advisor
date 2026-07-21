"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingDown, Zap, AlertTriangle, BarChart3, DollarSign, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface AICostData {
    period: string;
    summary: {
        totalCalls: number;
        failedCalls: number;
        successRate: string;
        totalTokens: number;
        totalCost: number;
        avgDurationMs: number;
        avgTokensPerCall: number;
        promptTokens: number;
        completionTokens: number;
    };
    byProvider: Array<{ provider: string; calls: number; totalTokens: number; cost: number }>;
    byModel: Array<{ model: string; calls: number; totalTokens: number; cost: number }>;
    byType: Array<{ type: string; calls: number; totalTokens: number; cost: number }>;
    recentFailures: Array<{
        id: string;
        provider: string;
        model: string;
        requestType: string;
        errorCode: string | null;
        estimatedCost: number;
        createdAt: string;
    }>;
    dailyCosts: Array<{ date: string; cost: number; calls: number }>;
}

interface AIHealthData {
    budget: {
        dailyTokens: number;
        dailyCost: number;
        monthlyTokens: number;
        monthlyCost: number;
    };
    usage: {
        dailyTokens: number;
        dailyCost: number;
        monthlyTokens: number;
        monthlyCost: number;
    };
    dailyUsagePercent: number;
    monthlyUsagePercent: number;
    exhausted: boolean;
    exhaustedReason: string | null;
    circuits: Array<{
        service: string;
        state: string;
        failureCount: number;
        isBlocked: boolean;
    }>;
    status: "healthy" | "warning" | "critical";
}

const PERIODS = [
    { value: "today", label: "今日" },
    { value: "week", label: "近7天" },
    { value: "month", label: "近30天" },
    { value: "all", label: "全部" },
];

function StatCard({ title, value, sub, icon: Icon, color }: {
    title: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    color: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white p-5 border border-[#E8E2D9]"
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#1B3A5C]/50 font-medium uppercase tracking-wider">{title}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <p className="text-2xl font-bold text-[#1B3A5C]">{value}</p>
            {sub && <p className="text-xs text-[#1B3A5C]/40 mt-1">{sub}</p>}
        </motion.div>
    );
}

export default function AdminAICostsPage() {
    const [period, setPeriod] = useState("week");
    const [data, setData] = useState<AICostData | null>(null);
    const [health, setHealth] = useState<AIHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/ai-costs?period=${period}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "未知错误");
        } finally {
            setLoading(false);
        }
    }, [period]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/ai-costs?period=${period}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "未知错误");
        } finally {
            setIsRefreshing(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetch("/api/admin/ai-health")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((json) => {
                // 类型安全保护：确保响应包含必要字段
                if (json && json.status && json.circuits && Array.isArray(json.circuits)) {
                    setHealth(json as AIHealthData);
                }
            })
            .catch(() => {});
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-[#1B3A5C]/30" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertTriangle className="w-10 h-10 text-[#A0784C]/40" />
                <p className="text-[#1B3A5C]/50">加载失败: {error}</p>
                <button onClick={fetchData} className="px-4 py-2 text-sm rounded-lg border border-[#E8E2D9] text-[#1B3A5C] hover:bg-[#F8F7F3]">
                    重试
                </button>
            </div>
        );
    }

    const s = data.summary;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#1B3A5C]">AI 成本分析</h1>
                    <p className="text-sm text-[#1B3A5C]/50 mt-1">Token 消耗 · 费用追踪 · 成功率监控</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-[#F8F7F3] rounded-lg p-1 border border-[#E8E2D9]">
                        {PERIODS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                                    period === p.value
                                        ? "bg-white text-[#1B3A5C] font-medium shadow-sm"
                                        : "text-[#1B3A5C]/50 hover:text-[#1B3A5C]"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 rounded-lg border border-[#E8E2D9] text-[#1B3A5C]/60 hover:text-[#1B3A5C] hover:bg-[#F8F7F3] transition-colors"
                        title="刷新数据"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* AI 服务健康状态横幅 */}
            {health && health.status && health.circuits && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-4 border ${
                        health.status === "healthy"
                            ? "bg-emerald-50/60 border-emerald-200"
                            : health.status === "warning"
                            ? "bg-amber-50/60 border-amber-200"
                            : "bg-red-50/60 border-red-200"
                    }`}
                >
                    <div className="flex items-center gap-3 mb-3">
                        {health.status === "healthy" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : health.status === "warning" ? (
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className={`text-sm font-semibold ${
                            health.status === "healthy" ? "text-emerald-700" :
                            health.status === "warning" ? "text-amber-700" : "text-red-700"
                        }`}>
                            {health.status === "healthy" ? "服务正常" :
                             health.status === "warning" ? "需关注" : "服务异常"}
                        </span>
                        {health.exhausted && health.exhaustedReason && (
                            <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full font-medium">
                                {health.exhaustedReason}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 预算使用率 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-[#1B3A5C]/60">日预算</span>
                                <span className={`font-medium ${health.dailyUsagePercent >= 100 ? "text-red-600" : health.dailyUsagePercent >= 80 ? "text-amber-600" : "text-[#1B3A5C]"}`}>
                                    ¥{health.usage.dailyCost.toFixed(2)}
                                    {health.budget.dailyCost > 0 ? ` / ¥${health.budget.dailyCost}` : ""}
                                    <span className="ml-1">({health.dailyUsagePercent}%)</span>
                                </span>
                            </div>
                            <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        health.dailyUsagePercent >= 100 ? "bg-red-500" :
                                        health.dailyUsagePercent >= 80 ? "bg-amber-500" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${health.budget.dailyCost > 0 ? Math.min(health.dailyUsagePercent, 100) : 0}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-[#1B3A5C]/60">月预算</span>
                                <span className={`font-medium ${health.monthlyUsagePercent >= 100 ? "text-red-600" : health.monthlyUsagePercent >= 80 ? "text-amber-600" : "text-[#1B3A5C]"}`}>
                                    ¥{health.usage.monthlyCost.toFixed(2)}
                                    {health.budget.monthlyCost > 0 ? ` / ¥${health.budget.monthlyCost}` : ""}
                                    <span className="ml-1">({health.monthlyUsagePercent}%)</span>
                                </span>
                            </div>
                            <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        health.monthlyUsagePercent >= 100 ? "bg-red-500" :
                                        health.monthlyUsagePercent >= 80 ? "bg-amber-500" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${health.budget.monthlyCost > 0 ? Math.min(health.monthlyUsagePercent, 100) : 0}%` }}
                                />
                            </div>
                        </div>

                        {/* 熔断器状态 */}
                        <div className="space-y-1.5">
                            <span className="text-xs text-[#1B3A5C]/60">服务熔断状态</span>
                            {health.circuits.filter(c => c.failureCount > 0 || c.state !== "closed").length === 0 ? (
                                <p className="text-xs text-[#1B3A5C]/40">所有服务正常</p>
                            ) : (
                                health.circuits
                                    .filter(c => c.failureCount > 0 || c.state !== "closed")
                                    .map((c) => (
                                        <div key={c.service} className="flex items-center justify-between text-xs">
                                            <span className="text-[#1B3A5C] font-mono">{c.service}</span>
                                            <span className={`font-medium ${
                                                c.isBlocked ? "text-red-600" : c.state === "half-open" ? "text-amber-600" : "text-[#1B3A5C]/60"
                                            }`}>
                                                {c.state === "open" ? "已熔断" :
                                                 c.state === "half-open" ? `半开 (探测中)` :
                                                 c.failureCount > 0 ? `失败 ${c.failureCount} 次` : "正常"}
                                            </span>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="总调用次数"
                    value={s.totalCalls.toLocaleString()}
                    sub={s.totalCalls > 0 ? `成功率 ${s.successRate}` : "暂无调用记录"}
                    icon={Zap}
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="累计费用"
                    value={`¥${s.totalCost.toFixed(3)}`}
                    sub={`${s.totalTokens.toLocaleString()} tokens`}
                    icon={DollarSign}
                    color="bg-amber-50 text-amber-600"
                />
                <StatCard
                    title="平均延迟"
                    value={s.totalCalls > 0 ? `${(s.avgDurationMs / 1000).toFixed(1)}s` : "-"}
                    sub={s.totalCalls > 0 ? `${s.avgTokensPerCall.toLocaleString()} tokens/次` : ""}
                    icon={TrendingDown}
                    color="bg-green-50 text-green-600"
                />
                <StatCard
                    title="失败次数"
                    value={s.failedCalls.toLocaleString()}
                    sub={s.failedCalls > 0 ? `失败率 ${(s.failedCalls / s.totalCalls * 100).toFixed(1)}%` : "无失败"}
                    icon={AlertTriangle}
                    color={s.failedCalls > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Provider */}
                <div className="rounded-2xl bg-white border border-[#E8E2D9] p-5">
                    <h3 className="text-sm font-semibold text-[#1B3A5C] mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#A0784C]" />
                        按提供者
                    </h3>
                    <div className="space-y-3">
                        {data.byProvider.map(p => (
                            <div key={p.provider} className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium text-[#1B3A5C]">{p.provider}</span>
                                    <span className="text-xs text-[#1B3A5C]/40 ml-2">{p.calls} 次</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-medium text-[#1B3A5C]">¥{p.cost.toFixed(3)}</span>
                                    <span className="text-xs text-[#1B3A5C]/40 ml-2">{p.totalTokens.toLocaleString()} tokens</span>
                                </div>
                            </div>
                        ))}
                        {data.byProvider.length === 0 && (
                            <p className="text-sm text-[#1B3A5C]/30">暂无数据</p>
                        )}
                    </div>
                </div>

                {/* By Type */}
                <div className="rounded-2xl bg-white border border-[#E8E2D9] p-5">
                    <h3 className="text-sm font-semibold text-[#1B3A5C] mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#A0784C]" />
                        按请求类型
                    </h3>
                    <div className="space-y-3">
                        {data.byType.map(t => (
                            <div key={t.type} className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium text-[#1B3A5C]">
                                        {t.type === "vision" ? "视觉分析" : t.type === "text" ? "文本生成" : t.type}
                                    </span>
                                    <span className="text-xs text-[#1B3A5C]/40 ml-2">{t.calls} 次</span>
                                </div>
                                <span className="text-sm font-medium text-[#1B3A5C]">¥{t.cost.toFixed(3)}</span>
                            </div>
                        ))}
                        {data.byType.length === 0 && (
                            <p className="text-sm text-[#1B3A5C]/30">暂无数据</p>
                        )}
                    </div>
                </div>

                {/* By Model */}
                <div className="rounded-2xl bg-white border border-[#E8E2D9] p-5">
                    <h3 className="text-sm font-semibold text-[#1B3A5C] mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#A0784C]" />
                        按模型
                    </h3>
                    <div className="space-y-3">
                        {data.byModel.map(m => (
                            <div key={m.model} className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium text-[#1B3A5C]">{m.model}</span>
                                    <span className="text-xs text-[#1B3A5C]/40 ml-2">{m.calls} 次</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-medium text-[#1B3A5C]">¥{m.cost.toFixed(3)}</span>
                                    <span className="text-xs text-[#1B3A5C]/40 ml-2">{m.totalTokens.toLocaleString()} tokens</span>
                                </div>
                            </div>
                        ))}
                        {data.byModel.length === 0 && (
                            <p className="text-sm text-[#1B3A5C]/30">暂无数据</p>
                        )}
                    </div>
                </div>

                {/* Daily Cost Trend */}
                <div className="rounded-2xl bg-white border border-[#E8E2D9] p-5">
                    <h3 className="text-sm font-semibold text-[#1B3A5C] mb-4 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-[#A0784C]" />
                         每日费用趋势 (近30天){data.dailyCosts.length === 0 && <span className="text-[#1B3A5C]/30 font-normal ml-2">暂无数据</span>}
                    </h3>
                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                        {data.dailyCosts.map(d => (
                            <div key={d.date} className="flex items-center justify-between text-xs">
                                <span className="text-[#1B3A5C]/60">{d.date}</span>
                                <span className="font-medium text-[#1B3A5C]">¥{d.cost.toFixed(3)}</span>
                                <span className="text-[#1B3A5C]/30">{d.calls}次</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Failures */}
            {data.recentFailures.length > 0 && (
                <div className="rounded-2xl bg-white border border-[#E8E2D9] p-5">
                    <h3 className="text-sm font-semibold text-[#1B3A5C] mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        最近失败记录 ({data.recentFailures.length})
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[#1B3A5C]/40 border-b border-[#E8E2D9]">
                                    <th className="text-left pb-2 font-medium">时间</th>
                                    <th className="text-left pb-2 font-medium">提供者</th>
                                    <th className="text-left pb-2 font-medium">模型</th>
                                    <th className="text-left pb-2 font-medium">类型</th>
                                    <th className="text-left pb-2 font-medium">错误</th>
                                    <th className="text-right pb-2 font-medium">费用</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentFailures.map(f => (
                                    <tr key={f.id} className="border-b border-[#E8E2D9]/50">
                                        <td className="py-2 text-[#1B3A5C]/60">
                                            {new Date(f.createdAt).toLocaleString("zh-CN")}
                                        </td>
                                        <td className="py-2 text-[#1B3A5C]">{f.provider}</td>
                                        <td className="py-2 text-[#1B3A5C] font-mono">{f.model}</td>
                                        <td className="py-2 text-[#1B3A5C]/60">{f.requestType}</td>
                                        <td className="py-2 text-red-500 font-mono text-[10px] max-w-[200px] truncate">
                                            {f.errorCode || "-"}
                                        </td>
                                        <td className="py-2 text-right text-[#1B3A5C]/60">
                                            ¥{f.estimatedCost.toFixed(4)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
