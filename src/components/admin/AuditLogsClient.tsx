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
    ChevronDown
} from "lucide-react";

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
    ship: Gift,
    reward_approved: Gift,
    reward_rejected: Gift,
};

const RESOURCE_ICONS: Record<string, any> = {
    Product: Package,
    AdminUser: User,
    ShareReward: Gift,
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

export default function AuditLogsClient() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Filters
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({ admins: [], actions: [], resources: [] });
    const [selectedAdmin, setSelectedAdmin] = useState<string>("all");
    const [selectedAction, setSelectedAction] = useState<string>("all");
    const [selectedResource, setSelectedResource] = useState<string>("all");
    const [timePreset, setTimePreset] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [showFilters, setShowFilters] = useState(false);

    const getDateRangeFromPreset = (preset: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (preset) {
            case "today":
                return { start: today.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
            case "7days": {
                const start = new Date(today);
                start.setDate(start.getDate() - 6);
                return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
            }
            case "30days": {
                const start = new Date(today);
                start.setDate(start.getDate() - 29);
                return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
            }
            default:
                return { start: "", end: "" };
        }
    };

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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Shield className="w-6 h-6" />
                        审计日志
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        查看管理员操作记录
                        {total > 0 && <span className="ml-2 text-slate-400">· 共 {total} 条记录</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${hasActiveFilters || showFilters
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        筛选器
                        {hasActiveFilters && (
                            <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                                {[selectedAdmin !== "all", selectedAction !== "all", selectedResource !== "all", timePreset !== "all"].filter(Boolean).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => fetchLogs()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            筛选条件
                        </h3>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                            >
                                <X className="w-3 h-3" />
                                清除筛选
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Time Range */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                时间范围
                            </label>
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
                                className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/50 focus:ring-slate-500/20 focus:border-slate-500 py-2"
                            >
                                {TIME_PRESETS.map((preset) => (
                                    <option key={preset.value} value={preset.value}>
                                        {preset.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Admin Filter */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                <User className="w-3 h-3 inline mr-1" />
                                管理员
                            </label>
                            <select
                                value={selectedAdmin}
                                onChange={(e) => { setSelectedAdmin(e.target.value); setPage(1); }}
                                className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/50 focus:ring-slate-500/20 focus:border-slate-500 py-2"
                            >
                                <option value="all">全部管理员</option>
                                {filterOptions.admins.map((admin) => (
                                    <option key={admin.id} value={admin.id}>
                                        {admin.name || admin.username}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Action Filter */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                操作类型
                            </label>
                            <select
                                value={selectedAction}
                                onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
                                className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/50 focus:ring-slate-500/20 focus:border-slate-500 py-2"
                            >
                                <option value="all">全部操作</option>
                                {filterOptions.actions.map((action) => (
                                    <option key={action} value={action}>
                                        {getActionLabel(action)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Resource Filter */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                资源类型
                            </label>
                            <select
                                value={selectedResource}
                                onChange={(e) => { setSelectedResource(e.target.value); setPage(1); }}
                                className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/50 focus:ring-slate-500/20 focus:border-slate-500 py-2"
                            >
                                <option value="all">全部资源</option>
                                {filterOptions.resources.map((resource) => (
                                    <option key={resource} value={resource}>
                                        {resource}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Custom Date Range */}
                    {timePreset === "custom" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                    开始日期
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                    className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/50 focus:ring-slate-500/20 focus:border-slate-500 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                    结束日期
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                    className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/50 focus:ring-slate-500/20 focus:border-slate-500 py-2"
                                />
                            </div>
                        </div>
                    )}

                    {/* Active Filters Summary */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                            {timePreset !== "all" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                                    <Calendar className="w-3 h-3" />
                                    {TIME_PRESETS.find(p => p.value === timePreset)?.label}
                                    {timePreset === "custom" && startDate && `: ${startDate}`}
                                    {timePreset === "custom" && endDate && ` ~ ${endDate}`}
                                    <button onClick={() => { setTimePreset("all"); setStartDate(""); setEndDate(""); }} className="ml-1 hover:text-slate-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {selectedAdmin !== "all" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                                    <User className="w-3 h-3" />
                                    {filterOptions.admins.find(a => a.id === selectedAdmin)?.name || filterOptions.admins.find(a => a.id === selectedAdmin)?.username}
                                    <button onClick={() => setSelectedAdmin("all")} className="ml-1 hover:text-slate-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {selectedAction !== "all" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                                    {getActionLabel(selectedAction)}
                                    <button onClick={() => setSelectedAction("all")} className="ml-1 hover:text-slate-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {selectedResource !== "all" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                                    {selectedResource}
                                    <button onClick={() => setSelectedResource("all")} className="ml-1 hover:text-slate-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                    <div className="divide-y divide-slate-100">
                        {logs.map((log) => {
                            const ActionIcon = ACTION_ICONS[log.action] || Edit;
                            const ResourceIcon = RESOURCE_ICONS[log.resource] || Package;
                            const colorClass = ACTION_COLORS[log.action] || "bg-slate-100 text-slate-700";

                            return (
                                <div key={log.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                                            <ActionIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-slate-900">
                                                    {log.admin?.name || log.admin?.username || '系统'}
                                                </span>
                                                <span className="text-slate-500">执行了</span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                                                    {getActionLabel(log.action)}
                                                </span>
                                                <span className="text-slate-500">操作</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                                <ResourceIcon className="w-4 h-4" />
                                                <span>{log.resource}</span>
                                                {log.resourceId && (
                                                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {log.resourceId.slice(0, 8)}...
                                                    </span>
                                                )}
                                            </div>
                                            {log.details && (
                                                <div className="mt-2 text-xs text-slate-400 font-mono bg-slate-50 p-2 rounded max-w-xl overflow-x-auto">
                                                    {JSON.stringify(log.details, null, 2).slice(0, 200)}
                                                    {JSON.stringify(log.details).length > 200 && '...'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs text-slate-500">
                                                {formatTime(log.createdAt)}
                                            </div>
                                            {log.ip && (
                                                <div className="text-[10px] text-slate-400 font-mono mt-1">
                                                    {log.ip}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <span className="text-sm text-slate-500">
                            第 {page} / {totalPages} 页
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
