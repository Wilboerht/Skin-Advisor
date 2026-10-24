"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, RefreshCw } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { isSuperAdmin } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DatePicker } from "@/components/ui/DatePicker";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import {
    DataTable,
    IconButton,
    PageHeader,
    PanelCard,
    type Column,
} from "@/components/admin";
import { LogDetailModal } from "./LogDetailModal";

interface AuditLog {
    id: string;
    adminId: string | null;
    admin: { username: string; name: string | null } | null;
    action: string;
    resource: string;
    resourceId: string | null;
    details: Record<string, unknown> | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: string;
}

interface AdminOption {
    id: string;
    username: string;
    name: string | null;
}

interface FilterOptions {
    admins: AdminOption[];
    actions: string[];
    resources: string[];
}

const ACTION_LABELS: Record<string, string> = {
    login: "登录",
    logout: "登出",
    login_failed: "登录失败",
    login_sso: "子站 SSO 登录",
    login_sso_blocked_totp: "SSO 登录被 TOTP 拦截",
    login_break_glass: "应急账号登录",
    login_break_glass_failed: "应急登录失败",
    admin_sso_sync_revoke: "同步主站会话",
    admin_sso_sync_update: "同步主站账号",
    create: "创建",
    update: "更新",
    delete: "删除",
    batch_delete: "批量删除",
    batch_activate: "批量上架",
    batch_deactivate: "批量下架",
    batch_feature: "批量推荐",
    ship: "发货",
    reward_approved: "奖励通过",
    reward_rejected: "奖励拒绝",
};

const TIME_PRESETS = [
    { value: "all", label: "全部时间" },
    { value: "today", label: "今天" },
    { value: "7days", label: "最近 7 天" },
    { value: "30days", label: "最近 30 天" },
    { value: "custom", label: "自定义" },
];

function getDateRange(preset: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDate = (date: Date) => date.toLocaleDateString("en-CA");
    if (preset === "today") return { start: toDate(today), end: toDate(today) };
    if (preset === "7days") {
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        return { start: toDate(start), end: toDate(today) };
    }
    if (preset === "30days") {
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        return { start: toDate(start), end: toDate(today) };
    }
    return { start: "", end: "" };
}

function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

function actionVariant(
    action: string,
): "default" | "success" | "warning" | "danger" | "primary" {
    if (
        action.includes("failed") ||
        action === "delete" ||
        action === "batch_delete"
    )
        return "danger";
    if (action === "login" || action === "create" || action === "ship")
        return "success";
    if (action === "update" || action === "batch_activate") return "primary";
    if (action === "login_sso_blocked_totp" || action === "reward_rejected")
        return "warning";
    return "default";
}

export default function AuditLogsClient({ role }: { role: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const toast = useToast();

    const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
    const selectedAdmin = searchParams.get("adminId") || "all";
    const selectedAction = searchParams.get("action") || "all";
    const selectedResource = searchParams.get("resource") || "all";
    const timePreset = searchParams.get("timePreset") || "all";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 30,
        total: 0,
        totalPages: 1,
    });
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        admins: [],
        actions: [],
        resources: [],
    });

    const updateParams = useCallback(
        (updates: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            Object.entries(updates).forEach(([key, value]) => {
                if (value === null || value === "" || value === "all")
                    params.delete(key);
                else params.set(key, value);
            });
            if (!("page" in updates)) params.delete("page");
            router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
        },
        [pathname, router, searchParams],
    );

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "30",
            });
            if (selectedAdmin !== "all") params.set("adminId", selectedAdmin);
            if (selectedAction !== "all") params.set("action", selectedAction);
            if (selectedResource !== "all")
                params.set("resource", selectedResource);
            if (timePreset === "custom") {
                if (startDate) params.set("startDate", startDate);
                if (endDate) params.set("endDate", endDate);
            } else if (timePreset !== "all") {
                const range = getDateRange(timePreset);
                if (range.start) params.set("startDate", range.start);
                if (range.end) params.set("endDate", range.end);
            }

            const response = await adminFetch(
                `/api/admin/audit-logs?${params}`,
            );
            const data = await response.json();
            if (!response.ok || !data.success)
                throw new Error(data.error || "加载审计日志失败");
            setLogs(data.data);
            setPagination(data.pagination);
            if (data.filters) setFilterOptions(data.filters);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "加载审计日志失败",
            );
        } finally {
            setLoading(false);
        }
    }, [
        page,
        selectedAdmin,
        selectedAction,
        selectedResource,
        timePreset,
        startDate,
        endDate,
        toast,
    ]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams({ type: "audit-logs" });
            if (selectedAdmin !== "all") params.set("adminId", selectedAdmin);
            if (selectedAction !== "all") params.set("action", selectedAction);
            if (selectedResource !== "all")
                params.set("resource", selectedResource);
            if (timePreset === "custom") {
                if (startDate) params.set("startDate", startDate);
                if (endDate) params.set("endDate", endDate);
            } else if (timePreset !== "all") {
                const range = getDateRange(timePreset);
                if (range.start) params.set("startDate", range.start);
                if (range.end) params.set("endDate", range.end);
            }
            const response = await adminFetch(`/api/admin/export?${params}`);
            if (!response.ok) throw new Error("导出失败");
            const truncated =
                response.headers.get("X-Export-Truncated") === "true";
            const exportLimit =
                response.headers.get("X-Export-Row-Limit") || "上限";
            const blob = await response.blob();
            const disposition =
                response.headers.get("Content-Disposition") || "";
            const filename =
                disposition.match(/filename="([^"]+)"/i)?.[1] ||
                `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            if (truncated) {
                toast.error(
                    `导出已达到 ${exportLimit} 条上限，请缩小筛选范围后重试`,
                );
            } else {
                toast.success("导出完成");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "导出失败");
        } finally {
            setExporting(false);
        }
    };

    const hasFilters =
        selectedAdmin !== "all" ||
        selectedAction !== "all" ||
        selectedResource !== "all" ||
        timePreset !== "all";

    const columns: Column<AuditLog>[] = [
        {
            key: "createdAt",
            title: "时间",
            width: "136px",
            render: (_, log) => (
                <span className="whitespace-nowrap text-sm tabular-nums text-brand-charcoal/70">
                    {formatTime(log.createdAt)}
                </span>
            ),
        },
        {
            key: "admin",
            title: "操作人",
            width: "140px",
            render: (_, log) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-charcoal">
                        {log.admin?.name || log.admin?.username || "系统"}
                    </p>
                    {log.ip && (
                        <p className="truncate font-mono text-xs text-brand-charcoal/55">
                            {log.ip}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: "action",
            title: "操作",
            width: "150px",
            render: (_, log) => (
                <Badge variant={actionVariant(log.action)}>
                    {ACTION_LABELS[log.action] || log.action}
                </Badge>
            ),
        },
        {
            key: "resource",
            title: "资源",
            render: (_, log) => (
                <div className="min-w-0">
                    <p className="truncate text-sm text-brand-charcoal">
                        {log.resource}
                    </p>
                    {log.resourceId && (
                        <p className="truncate font-mono text-xs text-brand-charcoal/55">
                            {log.resourceId.slice(0, 12)}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: "actions",
            title: "详情",
            width: "72px",
            align: "right",
            render: (_, log) =>
                log.details ? (
                    <IconButton
                        label="查看日志详情"
                        onClick={() => setSelectedLog(log)}
                    >
                        <Eye className="h-4 w-4" />
                    </IconButton>
                ) : null,
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="安全审计"
                description={`查看管理员操作记录${pagination.total > 0 ? ` · 共 ${pagination.total} 条` : ""}`}
                actions={
                    <>
                        {isSuperAdmin(role) && (
                            <Button
                                variant="outline"
                                size="sm"
                                leftIcon={<Download className="h-4 w-4" />}
                                onClick={handleExport}
                                loading={exporting}
                                disabled={logs.length === 0}
                            >
                                导出记录
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<RefreshCw className="h-4 w-4" />}
                            onClick={fetchLogs}
                            loading={loading}
                        >
                            刷新
                        </Button>
                    </>
                }
            />

            <PanelCard>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Select
                            aria-label="按时间范围筛选"
                            options={TIME_PRESETS}
                            value={timePreset}
                            onChange={(event) => {
                                const value = event.target.value;
                                updateParams({
                                    timePreset: value === "all" ? null : value,
                                    startDate: null,
                                    endDate: null,
                                });
                            }}
                        />
                        <Select
                            aria-label="按管理员筛选"
                            options={[
                                { value: "all", label: "全部管理员" },
                                ...filterOptions.admins.map((admin) => ({
                                    value: admin.id,
                                    label: admin.name || admin.username,
                                })),
                            ]}
                            value={selectedAdmin}
                            onChange={(event) =>
                                updateParams({ adminId: event.target.value })
                            }
                        />
                        <Select
                            aria-label="按操作类型筛选"
                            options={[
                                { value: "all", label: "全部操作" },
                                ...filterOptions.actions.map((action) => ({
                                    value: action,
                                    label: ACTION_LABELS[action] || action,
                                })),
                            ]}
                            value={selectedAction}
                            onChange={(event) =>
                                updateParams({ action: event.target.value })
                            }
                        />
                        <Select
                            aria-label="按资源类型筛选"
                            options={[
                                { value: "all", label: "全部资源" },
                                ...filterOptions.resources.map((resource) => ({
                                    value: resource,
                                    label: resource,
                                })),
                            ]}
                            value={selectedResource}
                            onChange={(event) =>
                                updateParams({ resource: event.target.value })
                            }
                        />
                    </div>
                    {hasFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                updateParams({
                                    timePreset: null,
                                    startDate: null,
                                    endDate: null,
                                    adminId: null,
                                    action: null,
                                    resource: null,
                                })
                            }
                        >
                            清除筛选
                        </Button>
                    )}
                </div>

                {timePreset === "custom" && (
                    <div className="mt-3 grid gap-3 border-t border-brand-charcoal/10 pt-3 sm:grid-cols-2">
                        <DatePicker
                            label="开始日期"
                            value={startDate}
                            onChange={(value) =>
                                updateParams({ startDate: value || null })
                            }
                        />
                        <DatePicker
                            label="结束日期"
                            value={endDate}
                            onChange={(value) =>
                                updateParams({ endDate: value || null })
                            }
                        />
                    </div>
                )}
            </PanelCard>

            <DataTable
                columns={columns}
                tableLayout="fixed"
                minWidth="900px"
                data={logs}
                loading={loading}
                rowKey="id"
                emptyText="暂无审计日志"
                mobileCard={(log) => (
                    <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => log.details && setSelectedLog(log)}
                        disabled={!log.details}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-brand-charcoal">
                                    {log.admin?.name ||
                                        log.admin?.username ||
                                        "系统"}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-brand-charcoal/65">
                                    {log.resource}
                                    {log.resourceId
                                        ? ` · ${log.resourceId.slice(0, 8)}`
                                        : ""}
                                </p>
                            </div>
                            <Badge variant={actionVariant(log.action)}>
                                {ACTION_LABELS[log.action] || log.action}
                            </Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-brand-charcoal/65">
                            <span>{formatTime(log.createdAt)}</span>
                            {log.ip && (
                                <span className="font-mono">{log.ip}</span>
                            )}
                        </div>
                    </button>
                )}
            />

            {pagination.totalPages > 1 && (
                <Pagination
                    page={pagination.page}
                    pageSize={pagination.limit}
                    total={pagination.total}
                    onChange={(nextPage) =>
                        updateParams({ page: String(nextPage) })
                    }
                />
            )}

            <LogDetailModal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                log={selectedLog}
            />
        </div>
    );
}
