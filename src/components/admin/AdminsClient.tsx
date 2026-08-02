"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  MoreHorizontal,
  Shield,
  ShieldCheck,
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
import { ResetPasswordModal } from "./ResetPasswordModal";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";

interface Admin {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  super_admin: { label: "超级管理员", color: "text-amber-700", bg: "bg-amber-50", icon: ShieldCheck },
  admin: { label: "管理员", color: "text-blue-700", bg: "bg-blue-50", icon: Shield },
};

export function AdminsClient() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);

  const [confirmToggle, setConfirmToggle] = useState<{ id: string; active: boolean; name: string } | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);

  const [dropdownId, setDropdownId] = useState<string | null>(null);
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  const handleResetPassword = async (password: string) => {
    if (!resetTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/admins/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success("密码重置成功");
        setShowResetModal(false);
        setResetTarget(null);
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
    setShowResetModal(true);
    setDropdownId(null);
  };

  const toggleActive = (id: string, current: boolean, name: string) => {
    setDropdownId(null);
    setConfirmToggle({ id, active: current, name });
  };

  const performToggleActive = async () => {
    if (!confirmToggle) return;
    const { id, active: current } = confirmToggle;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !current }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(current ? "账户已禁用" : "账户已启用");
        fetchAdmins();
      } else {
        toast.error(result.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setActionLoading(false);
      setConfirmToggle(null);
    }
  };

  const roleConfig = (role: string) => ROLE_LABELS[role] || ROLE_LABELS.admin;

  const anchorEl = dropdownId ? dropdownTriggerRefs.current.get(dropdownId) ?? null : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">管理员管理</h1>
          <p className="text-[#1A1A1A]/50 text-sm mt-1">
            管理系统管理员账号 &middot; 共 {admins.length} 人
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAdmin(null);
            setShowFormModal(true);
          }}
          className="flex items-center rounded-xl bg-[#3D4430] px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-[#3D4430]/90 hover:shadow-xl active:scale-95 transition-all"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建管理员
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-[#1A1A1A]/10 shadow-sm">
        <Search className="w-4 h-4 text-[#1A1A1A]/40" />
        <div className="relative flex-1 sm:flex-none">
          <input
            type="text"
            placeholder="搜索用户名、邮箱或姓名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full sm:w-72 rounded-lg border-[#E9E9E7] bg-[#1A1A1A]/[0.03] py-1.5 px-3 text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:bg-white focus:border-[#3D4430]/40 focus:ring-0 transition-all"
          />
        </div>
        <span className="ml-auto text-xs text-[#1A1A1A]/40">
          显示 {admins.length} 条数据
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#1A1A1A]/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E9E9E7]">
            <thead className="bg-[#1A1A1A]/[0.02] border-b border-[#1A1A1A]/5">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">管理员</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">角色</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E9E7]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1A1A1A]/40" />
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#1A1A1A]/40">
                    未找到符合条件的管理员。
                  </td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const role = roleConfig(admin.role);
                  const RoleIcon = role.icon;
                  return (
                    <tr key={admin.id} className="group hover:bg-white transition-colors">
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 flex items-center justify-center text-[#1A1A1A]/50 shrink-0">
                            <UserCog className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#1A1A1A] truncate">
                              {admin.name || admin.username}
                            </div>
                            <div className="text-xs text-[#1A1A1A]/50 truncate">
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
                      <td className="px-6 py-4 align-middle">
                        <button
                          onClick={() => toggleActive(admin.id, admin.active, admin.name || admin.username)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            admin.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${admin.active ? "bg-emerald-500" : "bg-red-500"}`} />
                          {admin.active ? "已启用" : "已禁用"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-[#1A1A1A]/60 align-middle">
                        {new Date(admin.createdAt).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="px-6 py-4 text-right relative align-middle">
                        <div className="flex justify-end items-center h-full">
                          <button
                            data-dropdown-trigger
                            ref={(el) => {
                              if (el) dropdownTriggerRefs.current.set(admin.id, el);
                            }}
                            onClick={() => {
                              setDropdownId(dropdownId === admin.id ? null : admin.id);
                            }}
                            className="p-2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60 transition-colors rounded-full hover:bg-[#1A1A1A]/5"
                            aria-label={`操作菜单 - ${admin.name || admin.username}`}
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

      <DropdownMenu isOpen={!!dropdownId} onClose={() => setDropdownId(null)} anchorEl={anchorEl}>
        {admins.find((a) => a.id === dropdownId) && (
          <>
            <DropdownMenuItem
              onClick={() => {
                const a = admins.find((x) => x.id === dropdownId);
                if (a) openEdit(a);
              }}
              icon={<Pencil className="w-4 h-4 text-[#1A1A1A]/50" />}
            >
              编辑信息
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const a = admins.find((x) => x.id === dropdownId);
                if (a) toggleActive(a.id, a.active, a.name || a.username);
              }}
              icon={<Shield className="w-4 h-4" />}
              danger={admins.find((a) => a.id === dropdownId)?.active}
            >
              {admins.find((a) => a.id === dropdownId)?.active ? "禁用账户" : "启用账户"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const a = admins.find((x) => x.id === dropdownId);
                if (a) openReset(a);
              }}
              icon={<KeyRound className="w-4 h-4 text-amber-600" />}
            >
              重置密码
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const a = admins.find((x) => x.id === dropdownId);
                if (a) openDelete(a);
              }}
              icon={<Trash2 className="w-4 h-4" />}
              danger
            >
              删除
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenu>

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

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        title="删除管理员"
        message={`确定要删除管理员 "${deleteTarget?.name || deleteTarget?.username}" 吗？此操作不可撤销。`}
        confirmText="删除"
        variant="danger"
        loading={actionLoading}
      />

      <ResetPasswordModal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetTarget(null);
        }}
        onConfirm={handleResetPassword}
        adminName={resetTarget?.name || resetTarget?.username || ""}
        loading={actionLoading}
      />

      <ConfirmModal
        isOpen={!!confirmToggle}
        title="确认操作"
        message={
          confirmToggle?.active
            ? `确定要禁用管理员 "${confirmToggle?.name}" 吗？禁用后该管理员将无法登录后台。`
            : `确定要启用管理员 "${confirmToggle?.name}" 吗？`
        }
        confirmText={confirmToggle?.active ? "禁用" : "启用"}
        variant={confirmToggle?.active ? "danger" : "default"}
        loading={actionLoading}
        onConfirm={() => performToggleActive()}
        onClose={() => setConfirmToggle(null)}
      />
    </div>
  );
}
