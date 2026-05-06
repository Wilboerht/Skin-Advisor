"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Search,
    MoreHorizontal,
    Shield,
    ShieldCheck,
    ShieldAlert,
    Trash2,
    Loader2,
    Plus,
    KeyRound,
    Pencil,
    UserCog,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AdminFormModal } from "./AdminFormModal";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface Admin {
    id: string;
    username: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; icon: typeof Shield }> = {
    super_admin: { label: "超级管理员", color: "text-amber-700", bg: "bg-amber-50", icon: ShieldCheck },
    admin: { label: "管理员", color: "text-blue-700", bg: "bg-blue-50", icon: Shield },
    editor: { label: "编辑", color: "text-slate-600", bg: "bg-slate-100", icon: ShieldAlert },
};

export function AdminsClient() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    // Modals
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);

    const [showResetModal, setShowResetModal] = useState(false);
    const [resetTarget, setResetTarget] = useState<Admin | null>(null);
    const [newPassword, setNewPassword] = useState("");

    // Dropdown
    const [dropdownId, setDropdownId] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

    // Close dropdown on outside click or Escape key
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (!target.closest('[data-dropdown-menu]') && !target.closest('[data-dropdown-trigger]')) {
                setDropdownId(null);
                setDropdownPos(null);
            }
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setDropdownId(null);
                setDropdownPos(null);
            }
        }
        if (dropdownId) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [dropdownId]);

    const toast = useToast();

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            const res = await fetch(`/api/admin/admins?${params}`);
            if (res.ok) {
                const data = await res.json();
                setAdmins(data.admins || []);
            } else {
                toast.error("加载管理员列表失败");
            }
        } catch {
            toast.error("加载管理员列表失败");
        } finally {
            setLoading(false);
        }
    }, [search, toast]);

    useEffect(() => {
        fetchAdmins();
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAdmins();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, fetchAdmins]);

    const handleCreate = async (data: {
        username?: string;
        email?: string;
        password?: string;
        name?: string;
        role: string;
    }) => {
        setActionLoading(true);
        try {
            const res = await fetch("/api/admin/admins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                toast.success("管理员创建成功");
                setShowFormModal(false);
                fetchAdmins();
            } else {
                toast.error(result.error || "创建失败");
            }
        } catch {
            toast.error("网络错误");
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdate = async (data: {
        username?: string;
        email?: string;
        password?: string;
        name?: string;
        role: string;
    }) => {
        if (!editingAdmin) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/admins/${editingAdmin.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                toast.success("管理员信息更新成功");
                setShowFormModal(false);
                setEditingAdmin(null);
                fetchAdmins();
            } else {
                toast.error(result.error || "更新失败");
            }
        } catch {
            toast.error("网络错误");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/admins/${deleteTarget.id}`, {
                method: "DELETE",
            });
            const result = await res.json();
            if (res.ok && result.success) {
                toast.success("管理员已删除");
                setShowDeleteModal(false);
                setDeleteTarget(null);
                fetchAdmins();
            } else {
                toast.error(result.error || "删除失败");
            }
        } catch {
            toast.error("网络错误");
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetTarget || !newPassword || newPassword.length < 6) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/admins/${resetTarget.id}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: newPassword }),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                toast.success("密码重置成功");
                setShowResetModal(false);
                setResetTarget(null);
                setNewPassword("");
            } else {
                toast.error(result.error || "重置失败");
            }
        } catch {
            toast.error("网络错误");
        } finally {
            setActionLoading(false);
        }
    };

    const openEdit = (admin: Admin) => {
        setEditingAdmin(admin);
        setShowFormModal(true);
        setDropdownId(null);
    };

    const openDelete = (admin: Admin) => {
        setDeleteTarget(admin);
        setShowDeleteModal(true);
        setDropdownId(null);
    };

    const openReset = (admin: Admin) => {
        setResetTarget(admin);
        setNewPassword("");
        setShowResetModal(true);
        setDropdownId(null);
    };

    const roleConfig = (role: string) => ROLE_LABELS[role] || ROLE_LABELS.editor;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">管理员管理</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        管理系统管理员账号 · 共 {admins.length} 人
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingAdmin(null);
                        setShowFormModal(true);
                    }}
                    className="flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 hover:shadow-xl active:scale-95 transition-all"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    新建管理员
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white/40 backdrop-blur-3xl rounded-2xl border-[1.5px] border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.03),inset_0_1px_5px_rgba(255,255,255,0.4)] transition-all">
                <Search className="w-4 h-4 text-slate-400" />
                <div className="relative flex-1 sm:flex-none">
                    <input
                        type="text"
                        placeholder="搜索用户名、邮箱或姓名..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="block w-full sm:w-72 rounded-lg border-slate-200 bg-slate-50/50 py-1.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all"
                    />
                </div>
                <span className="ml-auto text-xs text-slate-400">
                    显示 {admins.length} 条数据
                </span>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-[32px] border-[1.5px] border-white/60 bg-white/40 backdrop-blur-3xl shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)]">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/20">
                        <thead className="bg-white/30 border-b border-white/20">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">管理员</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">角色</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">创建时间</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1A1A1A]/40" />
                                    </td>
                                </tr>
                            ) : admins.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-[#1A1A1A]/40">
                                        未找到符合条件的管理员。
                                    </td>
                                </tr>
                            ) : (
                                admins.map((admin) => {
                                    const role = roleConfig(admin.role);
                                    const RoleIcon = role.icon;
                                    return (
                                        <tr key={admin.id} className="group hover:bg-white/20 transition-colors">
                                            <td className="px-6 py-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                        <UserCog className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-slate-900 truncate">
                                                            {admin.name || admin.username}
                                                        </div>
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {admin.email || admin.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-middle">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${role.bg} ${role.color}`}>
                                                    <RoleIcon className="w-3 h-3" />
                                                    {role.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 align-middle">
                                                {new Date(admin.createdAt).toLocaleDateString("zh-CN")}
                                            </td>
                                            <td className="px-6 py-4 text-right relative align-middle">
                                                <div className="flex justify-end items-center h-full">
                                                    <button
                                                        data-dropdown-trigger
                                                        onClick={(e) => {
                                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                            if (dropdownId === admin.id) {
                                                                setDropdownId(null);
                                                                setDropdownPos(null);
                                                            } else {
                                                                setDropdownId(admin.id);
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
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dropdown Menu — rendered to body via Portal to escape overflow clipping */}
            {dropdownId && dropdownPos && mounted && createPortal(
                <div
                    data-dropdown-menu
                    className="fixed z-[90] bg-white border border-[#1A1A1A]/10 rounded-lg shadow-lg py-1 w-40"
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                >
                    {admins.find(a => a.id === dropdownId) && (
                        <>
                            <button
                                onClick={() => {
                                    const admin = admins.find(a => a.id === dropdownId);
                                    if (admin) openEdit(admin);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5 flex items-center gap-2"
                            >
                                <Pencil className="w-4 h-4 text-slate-500" />
                                <span>编辑信息</span>
                            </button>
                            <button
                                onClick={() => {
                                    const admin = admins.find(a => a.id === dropdownId);
                                    if (admin) openReset(admin);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5 flex items-center gap-2"
                            >
                                <KeyRound className="w-4 h-4 text-amber-600" />
                                <span>重置密码</span>
                            </button>
                            <button
                                onClick={() => {
                                    const admin = admins.find(a => a.id === dropdownId);
                                    if (admin) openDelete(admin);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>删除</span>
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* Form Modal --
            <AdminFormModal
                isOpen={showFormModal}
                onClose={() => {
                    setShowFormModal(false);
                    setEditingAdmin(null);
                }}
                onSubmit={editingAdmin ? handleUpdate : handleCreate}
                admin={editingAdmin}
                loading={actionLoading}
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                onConfirm={handleDelete}
                title="删除管理员"
                message={`确定要删除管理员 "${deleteTarget?.name || deleteTarget?.username}" 吗？此操作不可撤销。`}
                confirmText="删除"
                variant="danger"
                loading={actionLoading}
            />

            {/* Reset Password Modal */}
            {showResetModal && mounted && createPortal(
                <AnimatePresence>
                    {showResetModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => { setShowResetModal(false); setResetTarget(null); }}
                                className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="relative z-10 w-full max-w-sm mx-4 bg-white/60 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/70 shadow-[0_40px_100px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden p-8"
                            >
                                <h3 className="text-xl font-bold text-slate-900 text-center mb-2 tracking-tight">
                                    重置密码
                                </h3>
                                <p className="text-sm text-slate-500 text-center mb-6">
                                    为 <strong>{resetTarget?.name || resetTarget?.username}</strong> 设置新密码
                                </p>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="输入新密码（至少6位）"
                                    className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all mb-6"
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowResetModal(false); setResetTarget(null); setNewPassword(""); }}
                                        disabled={actionLoading}
                                        className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-white/40 hover:bg-white/60 border border-white/60 rounded-2xl transition-all shadow-sm disabled:opacity-50"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleResetPassword}
                                        disabled={actionLoading || newPassword.length < 6}
                                        className="flex-1 px-4 py-3 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70"
                                    >
                                        {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        重置密码
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
