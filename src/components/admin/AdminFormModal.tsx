"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Shield, UserCog, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    { value: "admin", label: "管理员", description: "可管理产品、用户和查看审计日志" },
    { value: "editor", label: "编辑", description: "可管理产品内容" },
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
        });
        return () => cancelAnimationFrame(raf);
    }, [isOpen, admin]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!isEditing) {
            if (!username.trim() || username.length < 3) {
                newErrors.username = "用户名至少3个字符";
            }
            if (!password || password.length < 6) {
                newErrors.password = "密码至少6个字符";
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

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-lg mx-4 bg-white/60 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/70 shadow-[0_40px_100px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 pt-8 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-900/5 flex items-center justify-center">
                                    <UserCog className="w-5 h-5 text-slate-700" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                        {isEditing ? "编辑管理员" : "新建管理员"}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {isEditing ? `修改 ${admin?.username} 的信息` : "创建一个新的管理员账号"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-white/50 transition-all disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="px-8 pb-8 overflow-y-auto">
                            <div className="space-y-5">
                                {/* Username */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        用户名 {!isEditing && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={isEditing || loading}
                                        placeholder="输入用户名"
                                        className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all disabled:opacity-60"
                                    />
                                    {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">邮箱</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                        placeholder="输入邮箱地址"
                                        className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all disabled:opacity-60"
                                    />
                                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">姓名</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={loading}
                                        placeholder="输入显示姓名"
                                        className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all disabled:opacity-60"
                                    />
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        密码 {!isEditing && <span className="text-red-500">*</span>}
                                        {isEditing && <span className="text-slate-400 font-normal">（留空则不修改）</span>}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={loading}
                                            placeholder={isEditing ? "输入新密码以重置" : "输入密码"}
                                            className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all disabled:opacity-60"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                                </div>

                                {/* Role */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">角色</label>
                                    <div className="space-y-2">
                                        {ROLE_OPTIONS.map((option) => (
                                            <label
                                                key={option.value}
                                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                    role === option.value
                                                        ? "border-slate-900/20 bg-slate-900/5"
                                                        : "border-slate-200 bg-white/30 hover:bg-white/50"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    value={option.value}
                                                    checked={role === option.value}
                                                    onChange={(e) => setRole(e.target.value)}
                                                    disabled={loading}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Shield className={`w-3.5 h-3.5 ${
                                                            option.value === "super_admin"
                                                                ? "text-amber-500"
                                                                : option.value === "admin"
                                                                ? "text-blue-500"
                                                                : "text-slate-400"
                                                        }`} />
                                                        <span className="text-sm font-medium text-slate-900">{option.label}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-white/40 hover:bg-white/60 border border-white/60 rounded-2xl transition-all shadow-sm disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70"
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isEditing ? "保存修改" : "创建管理员"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
