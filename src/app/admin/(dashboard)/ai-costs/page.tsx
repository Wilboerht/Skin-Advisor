"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    AlertTriangle,
    CheckCircle2,
    DollarSign,
    RefreshCw,
    TrendingDown,
    Zap,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Select } from "@/components/ui/Select";
import {
    DataTable,
    PageHeader,
    PanelCard,
    StatStrip,
    type Column,
    type StatStripItem,
} from "@/components/admin";

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
    byProvider: Array<{
        provider: string;
        calls: number;
        totalTokens: number;
        cost: number;
    }>;
    byModel: Array<{
        model: string;
        calls: number;
        totalTokens: number;
        cost: number;
    }>;
    byType: Array<{
        type: string;
        calls: number;
        totalTokens: number;
        cost: number;
    }>;
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
    { value: "week", label: "近 7 天" },
    { value: "month", label: "近 30 天" },
    { value: "all", label: "全部" },
];

function formatDate(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function BudgetBar({
    label,
    usage,
    budget,
    percent,
}: {
    label: string;
    usage: number;
    budget: number;
    percent: number;
}) {
    const configured = budget > 0;
    const width = configured ? Math.min(Math.max(percent, 0), 100) : 0;
    const color =
        percent >= 100
            ? "bg-red-500"
            : percent >= 80
              ? "bg-amber-500"
              : "bg-emerald-500";
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-brand-charcoal/65">{label}</span>
                <span className="font-mono tabular-nums text-brand-charcoal/80">
                    ¥{usage.toFixed(2)}
                    {configured
                        ? ` / ¥${budget.toFixed(2)} · ${percent}%`
                        : " · 未配置"}
                </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-charcoal/[0.06]">
                <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    );
}

function HealthPanel({ health }: { health: AIHealthData | null }) {
    if (!health) {
        return (
            <PanelCard
                title="AI 健康"
                action={<Badge variant="secondary">未知</Badge>}
            >
                <p className="text-sm text-brand-charcoal/65">
                    AI 健康数据暂不可用。
                </p>
            </PanelCard>
        );
    }
    const status =
        health.status === "healthy"
            ? { label: "正常", variant: "success" as const }
            : health.status === "warning"
              ? { label: "注意", variant: "warning" as const }
              : { label: "异常", variant: "danger" as const };
    const activeCircuits = health.circuits.filter(
        (item) => item.failureCount > 0 || item.state !== "closed",
    );

    return (
        <PanelCard
            title="AI 健康"
            action={<Badge variant={status.variant}>{status.label}</Badge>}
        >
            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-4">
                    <BudgetBar
                        label="今日预算"
                        usage={health.usage.dailyCost}
                        budget={health.budget.dailyCost}
                        percent={health.dailyUsagePercent}
                    />
                    <BudgetBar
                        label="本月预算"
                        usage={health.usage.monthlyCost}
                        budget={health.budget.monthlyCost}
                        percent={health.monthlyUsagePercent}
                    />
                    {health.exhausted && (
                        <p className="text-xs text-red-600">
                            预算已耗尽
                            {health.exhaustedReason
                                ? `：${health.exhaustedReason}`
                                : ""}
                        </p>
                    )}
                </div>
                <div>
                    <p className="mb-2 text-xs text-brand-charcoal/65">
                        熔断器
                    </p>
                    {activeCircuits.length === 0 ? (
                        <p className="text-sm text-emerald-700">全部正常</p>
                    ) : (
                        <div className="space-y-2">
                            {activeCircuits.map((circuit) => {
                                const blocked =
                                    circuit.isBlocked ||
                                    circuit.state === "open";
                                return (
                                    <div
                                        key={circuit.service}
                                        className="flex items-center justify-between gap-2 text-sm"
                                    >
                                        <span className="font-mono text-brand-charcoal">
                                            {circuit.service}
                                        </span>
                                        <span
                                            className={
                                                blocked
                                                    ? "text-red-600"
                                                    : "text-amber-700"
                                            }
                                        >
                                            {blocked
                                                ? "已熔断"
                                                : circuit.failureCount > 0
                                                  ? `失败 ${circuit.failureCount} 次`
                                                  : "半开"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </PanelCard>
    );
}

export default function AdminAICostsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const periodParam = searchParams.get("period");
    const period = PERIODS.some((item) => item.value === periodParam)
        ? periodParam!
        : "week";

    const [data, setData] = useState<AICostData | null>(null);
    const [health, setHealth] = useState<AIHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchHealth = useCallback(async () => {
        try {
            const res = await adminFetch("/api/admin/ai-health");
            if (!res.ok) return;
            const json = await res.json();
            if (json?.status && Array.isArray(json.circuits)) setHealth(json);
        } catch {
            // 健康信息失败不阻断成本数据
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await adminFetch(
                `/api/admin/ai-costs?period=${period}`,
            );
            if (!res.ok) throw new Error("成本数据加载失败");
            setData(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "成本数据加载失败");
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    const refresh = () => {
        fetchData();
        fetchHealth();
    };

    const summary = data?.summary;
    const overviewItems: StatStripItem[] = [
        {
            label: "总调用次数",
            value: (summary?.totalCalls ?? 0).toLocaleString("zh-CN"),
            icon: <Zap className="h-3.5 w-3.5" />,
            description: summary?.totalCalls
                ? `成功率 ${summary.successRate}`
                : "暂无调用记录",
        },
        {
            label: "累计费用",
            value: `¥${(summary?.totalCost ?? 0).toFixed(3)}`,
            icon: <DollarSign className="h-3.5 w-3.5" />,
            description: `${(summary?.totalTokens ?? 0).toLocaleString("zh-CN")} tokens`,
        },
        {
            label: "平均延迟",
            value: summary?.totalCalls
                ? `${(summary.avgDurationMs / 1000).toFixed(1)}s`
                : "—",
            icon: <TrendingDown className="h-3.5 w-3.5" />,
            description: summary?.totalCalls
                ? `${summary.avgTokensPerCall.toLocaleString("zh-CN")} tokens/次`
                : "暂无调用记录",
        },
        {
            label: "失败次数",
            value: (summary?.failedCalls ?? 0).toLocaleString("zh-CN"),
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            description:
                summary && summary.totalCalls > 0 && summary.failedCalls > 0
                    ? `失败率 ${((summary.failedCalls / summary.totalCalls) * 100).toFixed(1)}%`
                    : "暂无失败",
            muted: !summary?.failedCalls,
        },
    ];

    const failureColumns: Column<AICostData["recentFailures"][number]>[] = [
        {
            key: "createdAt",
            title: "时间",
            width: "120px",
            render: (_, item) => (
                <span className="whitespace-nowrap text-xs tabular-nums text-brand-charcoal/65">
                    {formatDate(item.createdAt)}
                </span>
            ),
        },
        {
            key: "provider",
            title: "提供商",
            width: "100px",
            render: (_, item) => (
                <span className="text-sm text-brand-charcoal">
                    {item.provider}
                </span>
            ),
        },
        {
            key: "model",
            title: "模型",
            render: (_, item) => (
                <span className="font-mono text-xs text-brand-charcoal/75">
                    {item.model}
                </span>
            ),
        },
        {
            key: "requestType",
            title: "类型",
            width: "90px",
            render: (_, item) => (
                <span className="text-sm text-brand-charcoal/65">
                    {item.requestType}
                </span>
            ),
        },
        {
            key: "errorCode",
            title: "错误",
            render: (_, item) => (
                <span
                    className="block max-w-[240px] truncate font-mono text-xs text-red-600"
                    title={item.errorCode || ""}
                >
                    {item.errorCode || "—"}
                </span>
            ),
        },
        {
            key: "estimatedCost",
            title: "费用",
            width: "90px",
            align: "right",
            render: (_, item) => (
                <span className="font-mono text-xs tabular-nums text-brand-charcoal/65">
                    ¥{item.estimatedCost.toFixed(4)}
                </span>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="AI 成本"
                description="Token 消耗、费用追踪与成功率分析"
                actions={
                    <>
                        <div className="w-32">
                            <Select
                                aria-label="选择统计周期"
                                options={PERIODS}
                                value={period}
                                onChange={(event) => {
                                    const params = new URLSearchParams(
                                        searchParams.toString(),
                                    );
                                    params.set("period", event.target.value);
                                    router.replace(`${pathname}?${params}`);
                                }}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<RefreshCw className="h-4 w-4" />}
                            onClick={refresh}
                            loading={loading}
                        >
                            刷新
                        </Button>
                    </>
                }
            />

            {error ? (
                <PanelCard>
                    <Empty
                        icon={
                            <AlertTriangle className="h-8 w-8 text-amber-500" />
                        }
                        title="成本数据加载失败"
                        description={error}
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchData}
                            >
                                重试
                            </Button>
                        }
                    />
                </PanelCard>
            ) : (
                <>
                    <HealthPanel health={health} />

                    <PanelCard>
                        {loading ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="space-y-2">
                                        <div className="h-3 w-20 animate-pulse rounded bg-brand-charcoal/10" />
                                        <div className="h-6 w-16 animate-pulse rounded bg-brand-charcoal/10" />
                                        <div className="h-2.5 w-24 animate-pulse rounded bg-brand-charcoal/10" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <StatStrip items={overviewItems} />
                        )}
                    </PanelCard>

                    <div className="grid gap-5 lg:grid-cols-2">
                        <PanelCard title="按提供商">
                            {!data || data.byProvider.length === 0 ? (
                                <Empty title="暂无数据" className="py-6" />
                            ) : (
                                <div className="space-y-3">
                                    {data.byProvider.map((item) => (
                                        <div
                                            key={item.provider}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-brand-charcoal">
                                                    {item.provider}
                                                </p>
                                                <p className="text-xs text-brand-charcoal/65">
                                                    {item.calls} 次
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-brand-charcoal">
                                                    ¥{item.cost.toFixed(3)}
                                                </p>
                                                <p className="text-xs text-brand-charcoal/65">
                                                    {item.totalTokens.toLocaleString(
                                                        "zh-CN",
                                                    )}{" "}
                                                    tokens
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </PanelCard>

                        <PanelCard title="按请求类型">
                            {!data || data.byType.length === 0 ? (
                                <Empty title="暂无数据" className="py-6" />
                            ) : (
                                <div className="space-y-3">
                                    {data.byType.map((item) => (
                                        <div
                                            key={item.type}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-brand-charcoal">
                                                    {item.type === "vision"
                                                        ? "视觉分析"
                                                        : item.type === "text"
                                                          ? "文本分析"
                                                          : item.type}
                                                </p>
                                                <p className="text-xs text-brand-charcoal/65">
                                                    {item.calls} 次
                                                </p>
                                            </div>
                                            <span className="text-sm font-medium text-brand-charcoal">
                                                ¥{item.cost.toFixed(3)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </PanelCard>

                        <PanelCard title="按模型">
                            {!data || data.byModel.length === 0 ? (
                                <Empty title="暂无数据" className="py-6" />
                            ) : (
                                <div className="space-y-3">
                                    {data.byModel.map((item) => (
                                        <div
                                            key={item.model}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-mono text-sm text-brand-charcoal">
                                                    {item.model}
                                                </p>
                                                <p className="text-xs text-brand-charcoal/65">
                                                    {item.calls} 次
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-brand-charcoal">
                                                    ¥{item.cost.toFixed(3)}
                                                </p>
                                                <p className="text-xs text-brand-charcoal/65">
                                                    {item.totalTokens.toLocaleString(
                                                        "zh-CN",
                                                    )}{" "}
                                                    tokens
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </PanelCard>

                        <PanelCard title="每日费用（近 30 天）">
                            {!data || data.dailyCosts.length === 0 ? (
                                <Empty title="暂无数据" className="py-6" />
                            ) : (
                                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                    {data.dailyCosts.map((item) => (
                                        <div
                                            key={item.date}
                                            className="flex items-center justify-between gap-3 text-sm"
                                        >
                                            <span className="text-brand-charcoal/65">
                                                {item.date}
                                            </span>
                                            <span className="font-mono tabular-nums text-brand-charcoal">
                                                ¥{item.cost.toFixed(3)}
                                            </span>
                                            <span className="text-xs text-brand-charcoal/55">
                                                {item.calls} 次
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </PanelCard>
                    </div>

                    <PanelCard
                        title="最近失败记录"
                        action={
                            data && data.recentFailures.length > 0 ? (
                                <span className="text-xs text-brand-charcoal/65">
                                    共 {data.recentFailures.length} 条
                                </span>
                            ) : undefined
                        }
                    >
                        {!data || data.recentFailures.length === 0 ? (
                            <Empty
                                icon={
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                }
                                title="暂无失败记录"
                                className="py-6"
                            />
                        ) : (
                            <DataTable
                                columns={failureColumns}
                                tableLayout="fixed"
                                minWidth="760px"
                                className="rounded-none border-0"
                                data={data.recentFailures}
                                rowKey="id"
                                emptyText="暂无失败记录"
                                mobileCard={(item) => (
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-sm font-medium text-brand-charcoal">
                                                {item.provider}
                                            </span>
                                            <span className="font-mono text-xs text-red-600">
                                                {item.errorCode || "—"}
                                            </span>
                                        </div>
                                        <p className="truncate font-mono text-xs text-brand-charcoal/65">
                                            {item.model}
                                        </p>
                                        <div className="flex items-center justify-between gap-2 text-xs text-brand-charcoal/65">
                                            <span>
                                                {formatDate(item.createdAt)}
                                            </span>
                                            <span>
                                                ¥{item.estimatedCost.toFixed(4)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            />
                        )}
                    </PanelCard>
                </>
            )}
        </div>
    );
}
