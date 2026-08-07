"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Shield, UserCog, Eye, EyeOff } from "lucide-react";
import { AdminModal } from "@/components/ui/AdminModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Admin {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    username?: string;
    email?: string;
    password?: string;
    name?: string;
    role: string;
  }) => Promise<void>;
  admin?: Admin | null;
  loading?: boolean;
}

const ROLE_OPTIONS = [
  { value: "super_admin", label: "超级管理员", description: "拥有所有权限，可管理其他管理员" },
  { value: "admin", label: "管理员", description: "可管理产品、推荐规则和查看审计日志" },
];

export function AdminFormModal({ isOpen, onClose, onSubmit, admin, loading }: AdminFormModalProps) {
  const isEditing = !!admin;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("admin");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      if (admin) {
        setUsername(admin.username);
        setEmail(admin.email || "");
        setName(admin.name || "");
        setRole(admin.role);
        setPassword("");
      } else {
        setUsername("");
        setEmail("");
        setPassword("");
        setName("");
        setRole("admin");
      }
      setErrors({});
      setShowPassword(false);
      setIsDirty(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, admin]);

  const handleClose = useCallback(() => {
    if (loading) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [loading, isDirty, onClose]);

  const markDirty = () => setIsDirty(true);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!isEditing) {
      if (!username.trim() || username.length < 3) {
        newErrors.username = "用户名至少3个字符";
      }
      if (!password || password.length < 8) {
        newErrors.password = "密码至少需要 8 个字符";
      }
    }
    if (email && !email.includes("@")) {
      newErrors.email = "请输入有效的邮箱地址";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // 防重复提交守卫
    if (!validate()) return;

    const data: Record<string, unknown> = { role };
    if (!isEditing) {
      data.username = username.trim();
      data.password = password;
    }
    if (email.trim()) data.email = email.trim();
    if (name.trim()) data.name = name.trim();
    if (isEditing && password) data.password = password;

    await onSubmit(data as { username?: string; email?: string; password?: string; name?: string; role: string });
  };

  return (
    <>
    <AdminModal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "编辑管理员" : "新建管理员"}
      titleId="admin-form-modal-title"
      subtitle={isEditing ? `修改 ${admin?.username} 的信息` : "创建一个新的管理员账号"}
      maxWidth="md"
      disabled={loading}
      headerIcon={
        <div className="w-10 h-10 rounded-xl bg-[#1A1A1A]/5 flex items-center justify-center">
          <UserCog className="w-5 h-5 text-[#1A1A1A]/60" />
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          <div>
            <label htmlFor="admin-username" className="block text-sm font-medium text-[#5E5E5E] mb-1.5">
              用户名 {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); markDirty(); }}
              disabled={isEditing || loading}
              placeholder="输入用户名"
              onBlur={() => { if (username.trim() && username.length < 3) setErrors(prev => ({ ...prev, username: "用户名至少3个字符" })); else if (errors.username) setErrors(prev => { const n = { ...prev }; delete n.username; return n; }); }}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:border-[#3D4430]/40 transition-colors disabled:opacity-60 bg-white"
            />
            {errors.username && <p className="mt-1 text-xs text-red-600" role="alert">{errors.username}</p>}
          </div>

          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-[#5E5E5E] mb-1.5">邮箱</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); markDirty(); }}
              disabled={loading}
              placeholder="输入邮箱地址"
              onBlur={() => { if (email && !email.includes("@")) setErrors(prev => ({ ...prev, email: "请输入有效的邮箱地址" })); else if (errors.email) setErrors(prev => { const n = { ...prev }; delete n.email; return n; }); }}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:border-[#3D4430]/40 transition-colors disabled:opacity-60 bg-white"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600" role="alert">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="admin-name" className="block text-sm font-medium text-[#5E5E5E] mb-1.5">姓名</label>
            <input
              id="admin-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              disabled={loading}
              placeholder="输入显示姓名"
              className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:border-[#3D4430]/40 transition-colors disabled:opacity-60 bg-white"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-[#5E5E5E] mb-1.5">
              密码 {!isEditing && <span className="text-red-500">*</span>}
              {isEditing && <span className="text-[#1A1A1A]/40 font-normal">（留空则不修改）</span>}
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); markDirty(); }}
                disabled={loading}
                placeholder={isEditing ? "输入新密码以重置" : "输入密码"}
                onBlur={() => { if (!isEditing && password && password.length < 6) setErrors(prev => ({ ...prev, password: "密码至少6个字符" })); else if (errors.password) setErrors(prev => { const n = { ...prev }; delete n.password; return n; }); }}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:border-[#3D4430]/40 transition-colors disabled:opacity-60 bg-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600" role="alert">{errors.password}</p>}
          </div>

          <div>
            <fieldset>
              <legend className="block text-sm font-medium text-[#5E5E5E] mb-2">角色</legend>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    role === option.value
                      ? "border-[#1A1A1A]/10 bg-[#1A1A1A]/5"
                      : "border-[#E9E9E7] bg-transparent hover:bg-[#1A1A1A]/[0.03]"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={(e) => { setRole(e.target.value); markDirty(); }}
                    disabled={loading}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield
                        className={`w-3.5 h-3.5 ${
                          option.value === "super_admin"
                            ? "text-amber-500"
                            : option.value === "admin"
                            ? "text-blue-500"
                            : "text-[#1A1A1A]/40"
                        }`}
                      />
                      <span className="text-sm font-medium text-[#1A1A1A]">{option.label}</span>
                    </div>
                    <p className="text-xs text-[#1A1A1A]/50 mt-0.5">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
            </fieldset>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-3 text-sm font-bold text-[#1A1A1A]/60 bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 border border-[#1A1A1A]/10 rounded-xl transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 text-sm font-bold text-white bg-[#3D4430] hover:bg-[#3D4430]/90 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? "保存修改" : "创建管理员"}
          </button>
        </div>
      </form>
    </AdminModal>

    <ConfirmModal
      isOpen={showDiscardConfirm}
      onClose={() => setShowDiscardConfirm(false)}
      onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
      title="放弃更改？"
      message="您有未保存的更改，确定要关闭吗？"
      confirmText="放弃更改"
      variant="warning"
    />
    </>
  );
}
