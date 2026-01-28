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
    FileQuestion
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

export default function AuditLogsClient() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/audit-logs?page=${page}&limit=30`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.data);
                setTotalPages(data.pagination.totalPages);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page]);

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
                    <p className="text-slate-500 text-sm mt-1">查看管理员操作记录</p>
                </div>
                <button
                    onClick={() => fetchLogs()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    刷新
                </button>
            </div>

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
