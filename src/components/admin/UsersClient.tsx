"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, MoreHorizontal, User as UserIcon, Shield, ShieldOff, Trash2, Eye, Loader2, ChevronLeft, ChevronRight, Download, ChevronDown } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { UserDetailModal } from "./UserDetailModal";
import { useToast } from "@/components/ui/Toast";
import { isDisabledUser, UserRole } from "@/lib/permissions";

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    previousRole?: string | null;
    createdAt: string;
    _count: {
        advisorSessions: number;
    };
    advisorSessions: {
        createdAt: string;
        completedAt: string | null;
    }[];
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export function UsersClient() {
    const toast = useToast();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const [users, setUsers] = useState<User[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (!target.closest('[data-dropdown-menu]') && !target.closest('[data-dropdown-trigger]')) {
                setShowDropdown(null);
                setDropdownPos(null);
            }
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setShowDropdown(null);
                setDropdownPos(null);
            }
        }
        if (showDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [showDropdown]);

    // Add state for detail modal
    const [detailUser, setDetailUser] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "20",
                search,
                status,
            });
            const res = await fetch(`/api/admin/users?${params}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
                setPagination(data.pagination);
            } else {
                toast.error("加载用户列表失败");
            }
        } catch (error) {
            toast.error("网络异常，请稍后重试");
        } finally {
            setLoading(false);
        }
    }, [page, search, status]);

    const fetchUsersRef = useRef(fetchUsers);
    const pageRef = useRef(page);
    useEffect(() => { fetchUsersRef.current = fetchUsers; }, [fetchUsers]);
    useEffect(() => { pageRef.current = page; }, [page]);

    useEffect(() => {
        fetchUsersRef.current();
    }, [page, status]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (pageRef.current !== 1) {
                setPage(1);
            } else {
                fetchUsersRef.current();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleToggleStatus = async (user: User) => {
        const isDisabling = user.role !== "disabled";

        if (!isDisabling && user.previousRole) {
            // Enabling user: confirm the role that will be restored
            const confirmed = window.confirm(
                `确定要启用用户 "${user.name || user.email}" 吗？\n\n` +
                `该用户将被恢复为之前的角色：${user.previousRole.toUpperCase()}`
            );
            if (!confirmed) {
                setShowDropdown(null);
                return;
            }
        }

        setActionLoading(true);
        try {
            const body = isDisabling
                ? { role: "disabled" }
                : { role: "user" };
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const data = await res.json();
                fetchUsers();
            } else {
                const errData = await res.json().catch(() => null);
                toast.error((errData as { message?: string })?.message || "操作失败");
            }
        } catch (error) {
            toast.error("网络异常，请稍后重试");
        } finally {
            setActionLoading(false);
            setShowDropdown(null);
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setShowDeleteModal(false);
                setSelectedUser(null);
                fetchUsers();
            } else {
                toast.error("删除失败");
            }
        } catch (error) {
            toast.error("网络异常，请稍后重试");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">用户管理</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        管理注册用户 · 共 {pagination?.total || 0} 人
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                        onClick={() => window.open('/api/admin/export?type=users', '_blank')}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        导出用户
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white/40 backdrop-blur-3xl rounded-2xl border-[1.5px] border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.03),inset_0_1px_5px_rgba(255,255,255,0.4)] transition-all">
                <Search className="w-4 h-4 text-slate-400" />
                <div className="relative flex-1 sm:flex-none">
                    <input
                        type="text"
                        placeholder="搜索用户姓名或邮箱..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="block w-full sm:w-64 rounded-lg border-slate-200 bg-slate-50/50 py-1.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all"
                    />
                </div>
                
                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                <div className="relative min-w-[140px]">
                    <select
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                        className="w-full pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all cursor-pointer appearance-none"
                    >
                        <option value="all">所有用户状态</option>
                        <option value="active">活跃用户</option>
                        <option value="inactive">已禁用</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                <span className="ml-auto text-xs text-slate-400">
                    显示 {users.length} 条数据
                </span>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-[32px] border-[1.5px] border-white/60 bg-white/40 backdrop-blur-3xl shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)]">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/20">
                        <thead className="bg-white/30 border-b border-white/20">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">用户</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">状态</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">注册日期</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">最后活跃</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">测试次数</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1A1A1A]/40" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-[#1A1A1A]/40">
                                        未找到符合条件的用户。
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="group hover:bg-white/20 transition-colors">
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-slate-900 truncate">{user.name || "匿名用户"}</div>
                                                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDisabledUser(user.role)
                                                ? "bg-red-50 text-red-600"
                                                : "bg-emerald-50 text-emerald-700"
                                                }`}>
                                                {isDisabledUser(user.role) ? "已禁用" : "处于活跃状态"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 align-middle">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 align-middle">
                                            {user.advisorSessions[0]
                                                ? new Date(user.advisorSessions[0].createdAt).toLocaleDateString()
                                                : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums text-slate-900 align-middle">
                                            {user._count.advisorSessions}
                                        </td>
                                        <td className="px-6 py-4 text-right relative align-middle">
                                            <div className="flex justify-end items-center h-full">
                                                <button
                                                    data-dropdown-trigger
                                                    onClick={(e) => {
                                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                        if (showDropdown === user.id) {
                                                            setShowDropdown(null);
                                                            setDropdownPos(null);
                                                        } else {
                                                            setShowDropdown(user.id);
                                                            setDropdownPos({
                                                                top: rect.bottom + 4,
                                                                right: window.innerWidth - rect.right,
                                                            });
                                                        }
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <div className="text-sm text-slate-500">
                            显示第 {((page - 1) * pagination.limit) + 1} 到 {Math.min(page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-slate-600 px-3">
                                {page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Dropdown Menu — rendered to body via Portal to escape overflow clipping */}
            {showDropdown && dropdownPos && mounted && createPortal(
                <div
                    data-dropdown-menu
                    className="fixed z-[90] bg-white border border-[#1A1A1A]/10 rounded-lg shadow-lg py-1 w-40"
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                >
                    {users.find(u => u.id === showDropdown) && (
                        <>
                            <button
                                onClick={() => {
                                    const user = users.find(u => u.id === showDropdown);
                                    if (user) {
                                        setDetailUser(user.id);
                                        setShowDropdown(null);
                                        setDropdownPos(null);
                                    }
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5 flex items-center gap-2"
                            >
                                <Eye className="w-4 h-4 text-slate-500" />
                                <span>查看详情</span>
                            </button>
                            <button
                                onClick={() => {
                                    const user = users.find(u => u.id === showDropdown);
                                    if (user) {
                                        handleToggleStatus(user);
                                    }
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5 flex items-center gap-2"
                            >
                                {users.find(u => u.id === showDropdown)?.role === UserRole.DISABLED ? (
                                    <>
                                        <Shield className="w-4 h-4 text-green-600" />
                                        <span>启用用户</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldOff className="w-4 h-4 text-amber-600" />
                                        <span>禁用用户</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    const user = users.find(u => u.id === showDropdown);
                                    if (user) {
                                        setSelectedUser(user);
                                        setShowDeleteModal(true);
                                        setShowDropdown(null);
                                        setDropdownPos(null);
                                    }
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>删除用户</span>
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setSelectedUser(null); }}
                onConfirm={handleDelete}
                title="删除用户"
                message={`确定要删除用户 "${selectedUser?.email}" 吗？这将同时删除该用户的所有测试历史记录，且操作不可撤销。`}
                confirmText="删除"
                variant="danger"
                loading={actionLoading}
            />

            <UserDetailModal
                isOpen={!!detailUser}
                onClose={() => setDetailUser(null)}
                userId={detailUser}
            />
        </div>
    );
}
