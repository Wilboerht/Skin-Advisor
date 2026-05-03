"use client";

import { useState, useEffect } from "react";
import {
    Shield,
    RefreshCw,
    Loader2,
    User,
    LogIn,
    LogOut,
    Edit,
    Trash2,
    Package,
    Settings,
    Gift,
    FileQuestion,
    Calendar,
    Filter,
    X,
    ChevronDown,
    Download,
    Eye
} from "lucide-react";
import { LogDetailModal } from "./LogDetailModal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface AuditLog {
    id: string;
    adminId: string | null;
    admin: { username: string; name: string | null } | null;
    action: string;
    resource: string;
    resourceId: string | null;
    details: any;
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

const ACTION_ICONS: Record<string, any> = {
    login: LogIn,
    logout: LogOut,
    login_failed: LogIn,
    create: Package,
    update: Edit,
    delete: Trash2,
    batch_delete: Trash2,
    batch_activate: Package,
    batch_deactivate: Package,
};

const RESOURCE_ICONS: Record<string, any> = {
    Product: Package,
    AdminUser: User,
    Setting: Settings,
    Question: FileQuestion,
};

const ACTION_COLORS: Record<string, string> = {
    login: "bg-emerald-100 text-emerald-700",
    logout: "bg-slate-100 text-slate-700",
    login_failed: "bg-red-100 text-red-700",
    create: "bg-blue-100 text-blue-700",
    update: "bg-amber-100 text-amber-700",
    delete: "bg-red-100 text-red-700",
    batch_delete: "bg-red-100 text-red-700",
    batch_activate: "bg-emerald-100 text-emerald-700",
    batch_deactivate: "bg-slate-100 text-slate-700",
    ship: "bg-blue-100 text-blue-700",
    reward_approved: "bg-emerald-100 text-emerald-700",
    reward_rejected: "bg-red-100 text-red-700",
};

const TIME_PRESETS = [
    { label: "全部", value: "all" },
    { label: "今天", value: "today" },
    { label: "过去7天", value: "7days" },
    { label: "过去30天", value: "30days" },
    { label: "自定义", value: "custom" },
];

function getDateRangeFromPreset(preset: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toLocalDate = (d: Date) => d.toLocaleDateString('en-CA');

    switch (preset) {
        case "today":
            return { start: toLocalDate(today), end: toLocalDate(today) };
        case "7days": {
            const start = new Date(today);
            start.setDate(start.getDate() - 6);
            return { start: toLocalDate(start), end: toLocalDate(today) };
        }
        case "30days": {
            const start = new Date(today);
            start.setDate(start.getDate() - 29);
            return { start: toLocalDate(start), end: toLocalDate(today) };
        }
        default:
            return { start: "", end: "" };
    }
}

export default function AuditLogsClient() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const toast = useToast();

    // Filters
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({ admins: [], actions: [], resources: [] });
    const [selectedAdmin, setSelectedAdmin] = useState<string>("all");
    const [selectedAction, setSelectedAction] = useState<string>("all");
    const [selectedResource, setSelectedResource] = useState<string>("all");
    const [timePreset, setTimePreset] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "30",
            });

            if (selectedAdmin !== "all") params.append("adminId", selectedAdmin);
            if (selectedAction !== "all") params.append("action", selectedAction);
            if (selectedResource !== "all") params.append("resource", selectedResource);

            // Handle date range
            if (timePreset === "custom") {
                if (startDate) params.append("startDate", startDate);
                if (endDate) params.append("endDate", endDate);
            } else if (timePreset !== "all") {
                const dateRange = getDateRangeFromPreset(timePreset);
                if (dateRange.start) params.append("startDate", dateRange.start);
                if (dateRange.end) params.append("endDate", dateRange.end);
            }

            const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.data);
                setTotalPages(data.pagination.totalPages);
                setTotal(data.pagination.total);
                if (data.filters) {
                    setFilterOptions(data.filters);
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("加载日志失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, selectedAdmin, selectedAction, selectedResource, timePreset, startDate, endDate]);

    const clearFilters = () => {
        setSelectedAdmin("all");
        setSelectedAction("all");
        setSelectedResource("all");
        setTimePreset("all");
        setStartDate("");
        setEndDate("");
        setPage(1);
    };

    const hasActiveFilters = selectedAdmin !== "all" || selectedAction !== "all" || selectedResource !== "all" || timePreset !== "all";

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            login: '登录',
            logout: '登出',
            login_failed: '登录失败',
            create: '创建',
            update: '更新',
            delete: '删除',
            batch_delete: '批量删除',
            batch_activate: '批量上架',
            batch_deactivate: '批量下架',
            batch_feature: '批量推荐',
            ship: '发货',
            reward_approved: '审核通过',
            reward_rejected: '审核拒绝',
        };
        return labels[action] || action;
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            let exportStartDate = startDate;
            let exportEndDate = endDate;
            if (timePreset !== "custom" && timePreset !== "all") {
                const range = getDateRangeFromPreset(timePreset);
                exportStartDate = range.start;
                exportEndDate = range.end;
            }

            const params = new URLSearchParams({
                adminId: selectedAdmin,
                action: selectedAction,
                resource: selectedResource,
                startDate: exportStartDate,
                endDate: exportEndDate,
                limit: "1000", // Export up to 1000 logs
            });

            const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
            const data = await res.json();

            if (data.success && data.data) {
                const logsToExport = data.data;
                const headers = ["ID", "管理员", "操作行为", "资源模块", "动作时间", "IP地址", "详细参数"];
                const csvRows = [
                    "\uFEFF" + headers.join(","), // UTF-8 BOM for Excel
                    ...logsToExport.map((log: any) => [
                        log.id,
                        log.admin?.name || log.admin?.username || "系统",
                        getActionLabel(log.action),
                        log.resource,
                        new Date(log.createdAt).toLocaleString(),
                        log.ip || "unknown",
                        `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
                    ].join(","))
                ];

                const csvString = csvRows.join("\n");
                const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", `审计日志报告_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success("报告已生成并开始下载");
            }
        } catch (error) {
            console.error(error);
            toast.error("导出失败，请重试");
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">审计日志</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        查看管理员操作记录
                        {total > 0 && <span className="ml-2 text-slate-400">· 共 {total} 条记录</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting || logs.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        导出记录
                    </button>
                    <button
                        onClick={() => fetchLogs()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </button>
                </div>
            </div>

            {/* Filter Bar - Users Management Style */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 p-4 bg-white/40 backdrop-blur-3xl rounded-2xl border-[1.5px] border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.03),inset_0_1px_5px_rgba(255,255,255,0.4)] transition-all">
                    <div className="flex items-center gap-3 px-2 text-slate-400">
                        <Filter className="w-4 h-4" />
                    </div>

                    <div className="flex-1 flex flex-wrap items-center gap-4">
                        {/* Time Range */}
                        <div className="relative min-w-[150px]">
                            <select
                                value={timePreset}
                                onChange={(e) => {
                                    setTimePreset(e.target.value);
                                    if (e.target.value !== "custom") {
                                        setStartDate("");
                                        setEndDate("");
                                    }
                                    setPage(1);
                                }}
                                className="w-full pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/30 hover:bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all cursor-pointer appearance-none"
                            >
                                {TIME_PRESETS.map((preset) => (
                                    <option key={preset.value} value={preset.value}>
                                        {preset.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="h-4 w-px bg-slate-200 mx-2 hidden sm:block"></div>

                        {/* Admin Filter */}
                        <div className="relative min-w-[150px]">
                            <select
                                value={selectedAdmin}
                                onChange={(e) => { setSelectedAdmin(e.target.value); setPage(1); }}
                                className="w-full pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/30 hover:bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all cursor-pointer appearance-none"
                            >
                                <option value="all">所有操作人员</option>
                                {filterOptions.admins.map((admin) => (
                                    <option key={admin.id} value={admin.id}>
                                        {admin.name || admin.username}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Action Filter */}
                        <div className="relative min-w-[150px]">
                            <select
                                value={selectedAction}
                                onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
                                className="w-full pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/30 hover:bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all cursor-pointer appearance-none"
                            >
                                <option value="all">所有操作行为</option>
                                {filterOptions.actions.map((action) => (
                                    <option key={action} value={action}>
                                        {getActionLabel(action)}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Resource Filter */}
                        <div className="relative min-w-[150px]">
                            <select
                                value={selectedResource}
                                onChange={(e) => { setSelectedResource(e.target.value); setPage(1); }}
                                className="w-full pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/30 hover:bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all cursor-pointer appearance-none"
                            >
                                <option value="all">所有资源模块</option>
                                {filterOptions.resources.map((resource) => (
                                    <option key={resource} value={resource}>
                                        {resource}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <>
                            <div className="h-4 w-px bg-slate-200 mx-1 hidden lg:block"></div>
                            <button
                                onClick={clearFilters}
                                className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all uppercase tracking-widest border border-transparent hover:border-rose-100"
                            >
                                清除所有
                            </button>
                        </>
                    )}

                    <span className="ml-auto text-xs text-slate-400 hidden xl:block">
                        找到 {total} 条记录
                    </span>
                </div>

                {/* Custom Date Range Row */}
                {timePreset === "custom" && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-200 border-dashed animate-in slide-in-from-top-1 duration-200">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-2 whitespace-nowrap">自定义时段:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="rounded-lg border-slate-200 text-sm bg-white px-3 py-1 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all"
                        />
                        <span className="text-slate-300">至</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="rounded-lg border-slate-200 text-sm bg-white px-3 py-1 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all"
                        />
                    </div>
                )}
            </div>

            <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                {loading && logs.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Shield className="w-12 h-12 mb-4 opacity-50" />
                        <p>暂无审计日志</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/20">
                        {logs.map((log) => {
                            const ActionIcon = ACTION_ICONS[log.action] || Edit;
                            const ResourceIcon = RESOURCE_ICONS[log.resource] || Package;
                            const colorClass = ACTION_COLORS[log.action] || "bg-slate-100 text-slate-700";

                            return (
                                <div
                                    key={log.id}
                                    onClick={() => log.details && setSelectedLog(log)}
                                    onKeyDown={(e) => {
                                        if (log.details && (e.key === "Enter" || e.key === " ")) {
                                            e.preventDefault();
                                            setSelectedLog(log);
                                        }
                                    }}
                                    role={log.details ? "button" : undefined}
                                    tabIndex={log.details ? 0 : undefined}
                                    className={cn(
                                        "px-6 py-3 transition-colors group",
                                        log.details ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${colorClass}`}>
                                            <ActionIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap text-sm">
                                                <span className="font-semibold text-slate-900">
                                                    {log.admin?.name || log.admin?.username || '系统'}
                                                </span>
                                                <span className="text-slate-400 text-xs">执行了</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                                                    {getActionLabel(log.action)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <ResourceIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="font-medium">{log.resource}</span>
                                                </div>
                                                {log.resourceId && (
                                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 border border-slate-200/50">
                                                        ID: {log.resourceId.slice(0, 8)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right shrink-0 min-w-[100px]">
                                                <div className="text-[11px] font-medium text-slate-500">
                                                    {formatTime(log.createdAt)}
                                                </div>
                                                {log.ip && (
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        {log.ip}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <div className="text-sm text-slate-500">
                            共 {total} 条记录
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronDown className="w-4 h-4 rotate-90" />
                            </button>
                            <span className="text-sm font-medium text-slate-600 px-3">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronDown className="w-4 h-4 -rotate-90" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* Log Detail Modal */}
            <LogDetailModal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                log={selectedLog}
            />
        </div>
    );
}
