"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MoreHorizontal, User as UserIcon, Shield, ShieldOff, Trash2, Eye, Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { UserDetailModal } from "./UserDetailModal";

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    _count: {
        advisorSessions: number;
        shareRewards: number;
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

    // Add state for detail modal
    const [detailUser, setDetailUser] = useState<string | null>(null);

    const toast = useToast();

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
            }
        } catch (error) {
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    }, [page, search, status, toast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchUsers();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleToggleStatus = async (user: User) => {
        setActionLoading(true);
        try {
            const newRole = user.role === "disabled" ? "user" : "disabled";
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            if (res.ok) {
                toast.success(newRole === "disabled" ? "User disabled" : "User enabled");
                fetchUsers();
            } else {
                toast.error("Failed to update user");
            }
        } catch (error) {
            toast.error("Network error");
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
                toast.success("User deleted");
                setShowDeleteModal(false);
                setSelectedUser(null);
                fetchUsers();
            } else {
                toast.error("Failed to delete user");
            }
        } catch (error) {
            toast.error("Network error");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-[#1A1A1A]">Users</h1>
                    <p className="text-[#1A1A1A]/60 text-sm mt-1">
                        Manage registered users · {pagination?.total || 0} total
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Status Filter */}
                    <select
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-white border border-[#1A1A1A]/10 rounded-lg text-sm text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]/20"
                    >
                        <option value="all">All Users</option>
                        <option value="active">Active</option>
                        <option value="inactive">Disabled</option>
                    </select>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-full text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]/20 w-full sm:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-[#1A1A1A]/5 text-[#1A1A1A]/40 text-xs font-medium uppercase tracking-wider">
                                <th className="px-6 py-4 font-normal">User</th>
                                <th className="px-6 py-4 font-normal">Status</th>
                                <th className="px-6 py-4 font-normal">Created</th>
                                <th className="px-6 py-4 font-normal">Last Active</th>
                                <th className="px-6 py-4 font-normal text-right">Tests</th>
                                <th className="px-6 py-4 font-normal text-right">Rewards</th>
                                <th className="px-6 py-4 font-normal text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A1A1A]/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1A1A1A]/40" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-[#1A1A1A]/40">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="group hover:bg-[#FDFBF7] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 flex items-center justify-center text-[#1A1A1A]/60">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-[#1A1A1A]">{user.name || "Anonymous"}</div>
                                                    <div className="text-xs text-[#1A1A1A]/40">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.role === "disabled"
                                                ? "bg-red-50 text-red-600"
                                                : "bg-green-50 text-green-600"
                                                }`}>
                                                {user.role === "disabled" ? "Disabled" : "Active"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[#1A1A1A]/60">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-[#1A1A1A]/60">
                                            {user.advisorSessions[0]
                                                ? new Date(user.advisorSessions[0].createdAt).toLocaleDateString()
                                                : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums text-[#1A1A1A]">
                                            {user._count.advisorSessions}
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums text-[#1A1A1A]">
                                            {user._count.shareRewards}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => setShowDropdown(showDropdown === user.id ? null : user.id)}
                                                className="p-2 text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors rounded-full hover:bg-[#1A1A1A]/5"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {showDropdown === user.id && (
                                                <div className="absolute right-6 top-full mt-1 z-10 bg-white border border-[#1A1A1A]/10 rounded-lg shadow-lg py-1 w-40">
                                                    <button
                                                        onClick={() => {
                                                            setDetailUser(user.id);
                                                            setShowDropdown(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5 flex items-center gap-2"
                                                    >
                                                        <Eye className="w-4 h-4 text-slate-500" />
                                                        <span>View Details</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(user)}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5 flex items-center gap-2"
                                                    >
                                                        {user.role === "disabled" ? (
                                                            <>
                                                                <Shield className="w-4 h-4 text-green-600" />
                                                                <span>Enable</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ShieldOff className="w-4 h-4 text-amber-600" />
                                                                <span>Disable</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setShowDeleteModal(true);
                                                            setShowDropdown(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-[#1A1A1A]/5 flex items-center justify-between">
                        <div className="text-sm text-[#1A1A1A]/40">
                            Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-[#1A1A1A]/10 hover:bg-[#1A1A1A]/5 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-[#1A1A1A]/60 px-3">
                                {page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="p-2 rounded-lg border border-[#1A1A1A]/10 hover:bg-[#1A1A1A]/5 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setSelectedUser(null); }}
                onConfirm={handleDelete}
                title="Delete User"
                message={`Are you sure you want to delete "${selectedUser?.email}"? This will also delete all their analysis history and cannot be undone.`}
                confirmText="Delete"
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
