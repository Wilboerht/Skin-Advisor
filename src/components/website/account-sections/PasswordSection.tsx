"use client";

/**
 * PasswordSection — 密码管理表单（移植自主站 SecurityPanel）
 * 修改密码（旧密码验证）→ BFF `/api/user/password`；首次设置（短信验证码）→ `/api/user/password/set`
 * 纯表单组件，由「个人信息」面板以行内展开方式承载。
 */
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { validatePasswordStrength } from "@/lib/password";

interface PasswordSectionProps {
  /** 当前是否已设置密码（BFF 资料）；null/undefined = 官网未返回，按「修改」起步并靠 PASSWORD_NOT_SET 兜底切换 */
  hasPassword: boolean | null | undefined;
  /** 设置/修改成功后回调（父级刷新资料，更新「已设置/未设置」） */
  onUpdated: () => void;
  /** 会话过期（401）：交给账户弹层统一走登录引导 */
  onSessionExpired: () => void;
}

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white/60 px-4 py-3 text-base text-stone-800 outline-none transition-colors placeholder:text-stone-300 focus:border-stone-400 md:text-sm";

type ApiResult = { success?: boolean; error?: { code?: string; message?: string } } | null;

export function PasswordSection({ hasPassword, onUpdated, onSessionExpired }: PasswordSectionProps) {
  const toast = useToast();
  // 修改 = 旧密码验证；设置 = 短信验证码（未设过密码的账号）
  const [mode, setMode] = useState<"change" | "set">(hasPassword === false ? "set" : "change");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setCode, setSetCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [saving, setSaving] = useState(false);

  // 资料刷新（如设置成功后 hasPassword 变化）时同步模式
  useEffect(() => {
    setMode(hasPassword === false ? "set" : "change");
  }, [hasPassword]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const request = async (input: string, init: RequestInit): Promise<ApiResult> => {
    const res = await fetchWithCsrf(input, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    if (res.status === 401) {
      onSessionExpired();
      return null;
    }
    return (await res.json().catch(() => null)) as ApiResult;
  };

  /** 首次设置密码：发送短信验证码（BFF 从本地副本解析完整手机号，前端无需传参） */
  const handleSendSetCode = async () => {
    if (countdown > 0) return;
    const data = await request("/api/user/password/set-code", { method: "POST", body: "{}" });
    if (!data) return;
    if (data.success) {
      setCountdown(60);
      toast.success("验证码已发送");
    } else {
      toast.error(data.error?.message || "验证码发送失败");
    }
  };

  const handleSubmit = async () => {
    if (newPassword !== confirmPassword) {
      toast.warning("两次输入的密码不一致");
      return;
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      toast.warning(strength.message || "密码强度不足");
      return;
    }
    setSaving(true);
    try {
      if (mode === "change") {
        const data = await request("/api/user/password", {
          method: "PUT",
          body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
        });
        if (!data) return;
        if (data.success) {
          setOldPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success("密码修改成功");
          onUpdated();
        } else if (data.error?.code === "PASSWORD_NOT_SET") {
          // 未设过密码的账号（如短信注册）：切换到短信验证码设置流程
          setMode("set");
        } else {
          toast.error(data.error?.message || "修改失败");
        }
      } else {
        if (!/^\d{6}$/.test(setCode)) {
          toast.warning("请输入 6 位数字验证码");
          return;
        }
        const data = await request("/api/user/password/set", {
          method: "POST",
          body: JSON.stringify({ code: setCode, password: newPassword, confirmPassword }),
        });
        if (!data) return;
        if (data.success) {
          setSetCode("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success("密码设置成功");
          onUpdated();
        } else {
          toast.error(data.error?.message || "设置失败");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-4">
      <h3 className="text-sm font-medium text-stone-700">
        {mode === "change" ? "修改密码" : "设置密码（短信验证）"}
      </h3>
      {mode === "set" && (
        <p className="text-xs text-stone-400">您的账号尚未设置密码，请通过手机验证码设置。</p>
      )}

      {mode === "change" && (
        <div>
          <label htmlFor="acct-old-password" className="mb-1 block text-xs text-stone-400">
            旧密码
          </label>
          <input
            id="acct-old-password"
            type="password"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {mode === "set" && (
        <div>
          <label htmlFor="acct-set-code" className="mb-1 block text-xs text-stone-400">
            短信验证码
          </label>
          <div className="flex gap-2">
            <input
              id="acct-set-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={setCode}
              onChange={(e) => setSetCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6位验证码"
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleSendSetCode}
              disabled={countdown > 0}
              className="shrink-0 rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-white/60 disabled:opacity-50 cursor-pointer"
            >
              {countdown > 0 ? `${countdown}s 后重发` : "发送验证码"}
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="acct-new-password" className="mb-1 block text-xs text-stone-400">
          {mode === "change" ? "新密码" : "密码"}
        </label>
        <input
          id="acct-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="acct-confirm-password" className="mb-1 block text-xs text-stone-400">
          {mode === "change" ? "确认新密码" : "确认密码"}
        </label>
        <input
          id="acct-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="rounded-full bg-[#00263e] px-6 py-2.5 text-sm text-white transition-colors hover:bg-[#0d3b5c] disabled:opacity-50 cursor-pointer"
      >
        {saving ? "提交中..." : mode === "change" ? "修改密码" : "设置密码"}
      </button>
    </div>
  );
}
