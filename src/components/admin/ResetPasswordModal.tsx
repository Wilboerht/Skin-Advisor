"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AdminModal } from "@/components/ui/AdminModal";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  adminName: string;
  loading?: boolean;
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  adminName,
  loading = false,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 模态框关闭时重置状态（包括 ESC / 点击遮罩关闭）
  useEffect(() => {
    if (!isOpen) {
      setNewPassword("");
      setShowPassword(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    await onConfirm(newPassword);
  };

  const handleClose = () => {
    setNewPassword("");
    onClose();
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={handleClose}
      title="重置密码"
      titleId="reset-password-modal-title"
      subtitle={`为 ${adminName} 设置新密码`}
      maxWidth="sm"
      disabled={loading}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="reset-password-input" className="block text-sm font-medium text-slate-700 mb-1.5">
            新密码
          </label>
          <div className="relative">
            <input
              id="reset-password-input"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码（至少6位）"
              className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 pr-10 text-sm text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400/30 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243a9.7 9.7 0 01-4.243-4.243z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-white/40 hover:bg-white/60 border border-white/60 rounded-2xl transition-all shadow-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading || newPassword.length < 6}
            className="flex-1 px-4 py-3 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            重置密码
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
