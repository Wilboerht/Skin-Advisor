"use client";

import Link from "next/link";
import { useState } from "react";
import {
    Activity,
    Download,
    FileSpreadsheet,
    Lock,
    Package,
    Shield,
    Users,
} from "lucide-react";
import { PageHeader, PanelCard } from "@/components/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { downloadAdminExport } from "@/lib/admin-export-client";
import { isSuperAdmin } from "@/lib/permissions";

type ExportType = "products" | "whitepaper" | "users" | "sessions" | "audit-logs";

interface ExportDefinition {
    type: ExportType;
    title: string;
    description: string;
    limit: string;
    icon: typeof Package;
    requiresSuper: boolean;
    note?: string;
}

const EXPORTS: ExportDefinition[] = [
    {
        type: "products",
        title: "产品数据报表",
        description:
            "产品基础信息：ID、名称、分类、价格、上下架状态、精选状态、创建时间。",
        limit: "最多 5000 条",
        icon: Package,
        requiresSuper: false,
    },
    {
        type: "whitepaper",
        title: "白皮书统计数据",
        description:
            "已完成测肤的脱敏群体统计：肤质、人群、评分、维度、年龄、预算、省份等。",
        limit: "最多 20000 条",
        icon: FileSpreadsheet,
        requiresSuper: false,
    },
    {
        type: "users",
        title: "用户增长数据",
        description: "用户 ID、邮箱、姓名、角色、测试次数、注册时间。",
        limit: "最多 5000 条",
        icon: Users,
        requiresSuper: true,
    },
    {
        type: "sessions",
        title: "诊断请求记录",
        description:
            "最近 1000 条测肤会话：用户、省份、设备、开始/完成时间、是否分享。",
        limit: "最多 1000 条",
        icon: Activity,
        requiresSuper: true,
    },
    {
        type: "audit-logs",
        title: "审计日志",
        description:
            "管理员操作审计记录。按时间、管理员、操作或资源筛选后导出，请前往安全审计页。",
        limit: "最多 5000 条",
        icon: Shield,
        requiresSuper: true,
        note: "全部日志可直接下载；带筛选导出请去安全审计页。",
    },
];

export function ExportsClient({ role }: { role: string }) {
    const toast = useToast();
    const canExportPII = isSuperAdmin(role);
    const [downloading, setDownloading] = useState<ExportType | null>(null);

    const handleDownload = async (item: ExportDefinition) => {
        if (item.requiresSuper && !canExportPII) return;
        setDownloading(item.type);
        try {
            const result = await downloadAdminExport(item.type);
            if (result.truncated) {
                toast.warning(
                    `导出已达到 ${result.rowLimit || "上限"} 条上限，请缩小范围后重试`
                );
            } else {
                toast.success("导出完成");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "导出失败");
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="数据导出"
                description="产品、白皮书、用户、诊断请求与审计数据 CSV 导出"
                accessory={
                    <Badge variant={canExportPII ? "primary" : "secondary"}>
                        {canExportPII ? "超级管理员" : "管理员"}
                    </Badge>
                }
            />

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-800">
                用户、诊断请求、审计日志包含身份或联系方式等敏感信息，仅超级管理员可导出。
                所有导出操作都会写入审计日志，并受行数上限约束。
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {EXPORTS.map((item) => {
                    const locked = item.requiresSuper && !canExportPII;
                    const Icon = item.icon;
                    return (
                        <PanelCard
                            key={item.type}
                            className="flex flex-col gap-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-sm font-semibold text-foreground">
                                            {item.title}
                                        </h2>
                                        {item.requiresSuper && (
                                            <Badge
                                                variant={
                                                    canExportPII
                                                        ? "warning"
                                                        : "secondary"
                                                }
                                                size="sm"
                                            >
                                                {canExportPII
                                                    ? "含敏感字段"
                                                    : "仅超级管理员"}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                        {item.description}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-3">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">
                                        {item.limit}
                                    </span>
                                    {item.note && (
                                        <span className="text-[11px] text-muted-foreground">
                                            {item.note}
                                        </span>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant={locked ? "outline" : "primary"}
                                    disabled={locked}
                                    loading={downloading === item.type}
                                    leftIcon={
                                        locked ? (
                                            <Lock className="h-4 w-4" />
                                        ) : (
                                            <Download className="h-4 w-4" />
                                        )
                                    }
                                    onClick={() => handleDownload(item)}
                                >
                                    {locked ? "仅超级管理员" : "下载 CSV"}
                                </Button>
                            </div>
                        </PanelCard>
                    );
                })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-brand-charcoal/[0.02] px-4 py-3 text-sm text-foreground/75">
                <span>需要按筛选条件导出审计日志？</span>
                <Link
                    href="/admin/audit-logs"
                    className="font-medium text-brand-primary hover:underline"
                >
                    前往安全审计 →
                </Link>
            </div>
        </div>
    );
}
