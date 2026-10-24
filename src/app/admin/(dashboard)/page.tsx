"use client";

import {
    Activity,
    CheckCircle2,
    Package,
    RefreshCw,
    Users,
    AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import {
    PageHeader,
    PanelCard,
    StatStrip,
    type StatStripItem,
} from "@/components/admin";
import {
    DashboardCharts,
    useDashboardStats,
} from "@/components/admin/charts/DashboardCharts";

export default function AdminDashboardPage() {
    const { stats, loading, error, refresh } = useDashboardStats();
    const overview = stats?.overview;

    const overviewItems: StatStripItem[] = [
        {
            label: "注册用户",
            value: (overview?.totalUsers ?? 0).toLocaleString("zh-CN"),
            icon: <Users className="h-3.5 w-3.5" />,
            description: "子站累计注册用户",
        },
        {
            label: "产品总数",
            value: (overview?.totalProducts ?? 0).toLocaleString("zh-CN"),
            icon: <Package className="h-3.5 w-3.5" />,
            description: "产品库中的产品",
        },
        {
            label: "诊断会话",
            value: (overview?.totalSessions ?? 0).toLocaleString("zh-CN"),
            icon: <Activity className="h-3.5 w-3.5" />,
            description: `已完成 ${(overview?.completedSessions ?? 0).toLocaleString("zh-CN")}`,
        },
        {
            label: "完成率",
            value: `${overview?.completionRate ?? 0}%`,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            description: "累计完成占比",
        },
    ];

    const todayItems: StatStripItem[] = [
        {
            label: "今日开始测试",
            value: (overview?.todaySessions ?? 0).toLocaleString("zh-CN"),
            icon: <Activity className="h-3.5 w-3.5" />,
            description: "今日 0 点至今",
        },
        {
            label: "今日完成测试",
            value: (overview?.todayCompletions ?? 0).toLocaleString("zh-CN"),
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            description: "今日 0 点至今",
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="仪表盘"
                description="护肤顾问系统数据概览"
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        loading={loading}
                        leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                        刷新
                    </Button>
                }
            />

            {error ? (
                <PanelCard>
                    <Empty
                        icon={
                            <AlertTriangle className="h-8 w-8 text-amber-500" />
                        }
                        title="统计数据加载失败"
                        description={error}
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={refresh}
                            >
                                重试
                            </Button>
                        }
                        className="py-10"
                    />
                </PanelCard>
            ) : (
                <>
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

                    <DashboardCharts stats={stats} loading={loading} />

                    <PanelCard title="今日活动">
                        {loading ? (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                {Array.from({ length: 2 }).map((_, index) => (
                                    <div key={index} className="space-y-2">
                                        <div className="h-3 w-20 animate-pulse rounded bg-brand-charcoal/10" />
                                        <div className="h-6 w-16 animate-pulse rounded bg-brand-charcoal/10" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <StatStrip
                                items={todayItems}
                                layout="grid"
                                className="sm:grid-cols-2"
                            />
                        )}
                    </PanelCard>
                </>
            )}
        </div>
    );
}
