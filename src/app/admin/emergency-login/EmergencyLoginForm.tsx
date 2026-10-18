"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

export function EmergencyLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/auth/emergency-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, totpCode }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!response.ok || !data?.success) {
        setError(data?.error || "登录失败");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <input
        type="text"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="应急账号"
        autoComplete="username"
        required
        className="w-full rounded-xl border border-[#E8E2D9] px-4 py-3 text-sm outline-none focus:border-[#C9A86C]/60 focus:ring-4 focus:ring-[#C9A86C]/15"
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="密码"
        autoComplete="current-password"
        required
        className="w-full rounded-xl border border-[#E8E2D9] px-4 py-3 text-sm outline-none focus:border-[#C9A86C]/60 focus:ring-4 focus:ring-[#C9A86C]/15"
      />
      <input
        type="text"
        value={totpCode}
        onChange={(event) => setTotpCode(event.target.value)}
        placeholder="6 位动态验证码"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        className="w-full rounded-xl border border-[#E8E2D9] px-4 py-3 text-sm outline-none focus:border-[#C9A86C]/60 focus:ring-4 focus:ring-[#C9A86C]/15"
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B7355] py-3 text-sm font-bold text-white transition-colors hover:bg-[#6D5A3F] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        应急登录
      </button>
    </form>
  );
}
