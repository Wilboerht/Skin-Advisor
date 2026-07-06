import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 成本分析",
  description: "NIHPLOD 管理后台 — AI 调用成本与用量统计。",
};

"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingDown, Zap, AlertTriangle, BarChart3, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

interface AICostData {
    period: string;
    summary: {
        totalCalls: number;
        failedCalls: number;
        successRate: string;
        totalTokens: number;
        totalCost: string;
        avgDurationMs: number;
        avgTokensPerCall: number;
        promptTokens: number;
        completionTokens: number;
    };
    byProvider: Array<{ provider: string; calls: number; totalTokens: number; cost: string }>;
    byModel: Array<{ model: string; calls: number; totalTokens: number; cost: string }>;
    byType: Array<{ type: string; calls: number; totalTokens: number; cost: string }>;
    recentFailures: Array<{
        id: string;
        provider: string;
        model: string;
        requestType: string;
        errorCode: string | null;
        estimatedCost: number;
        createdAt: string;
    }>;
    dailyCosts: Array<{ date: string; cost: string; calls: number }>;
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/ai-costs?period=${period}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="总调用次数"
                    value={s.totalCalls.toLocaleString()}
                    sub={`成功率 ${s.successRate}`}
                    icon={Zap}
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="累计费用"
                    value={`¥${Number(s.totalCost).toFixed(2)}`}
                    sub={`${s.totalTokens.toLocaleString()} tokens`}
                    icon={DollarSign}
                    color="bg-amber-50 text-amber-600"
                />
                <StatCard
                    title="平均延迟"
                    value={`${(s.avgDurationMs / 1000).toFixed(1)}s`}
                    sub={`${s.avgTokensPerCall.toLocaleString()} tokens/次`}
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
                                    <span className="text-sm font-medium text-[#1B3A5C]">¥{Number(p.cost).toFixed(3)}</span>
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
                                <span className="text-sm font-medium text-[#1B3A5C]">¥{Number(t.cost).toFixed(3)}</span>
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
                                    <span className="text-sm font-medium text-[#1B3A5C]">¥{Number(m.cost).toFixed(3)}</span>
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
                        每日费用趋势 (近30天)
                    </h3>
                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                        {data.dailyCosts.map(d => (
                            <div key={d.date} className="flex items-center justify-between text-xs">
                                <span className="text-[#1B3A5C]/60">{d.date}</span>
                                <span className="font-medium text-[#1B3A5C]">¥{Number(d.cost).toFixed(2)}</span>
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
                                            {f.errorCode || "Unknown"}
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
