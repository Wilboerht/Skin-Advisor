"use client";

/**
 * PhoneSection — 手机号换绑表单（对齐主站 ProfilePanel 换绑流程）
 * 双向短信验证：当前手机验证码（验证身份）+ 新手机验证码（验证新号归属），
 * 经 BFF `/api/account/phone(/send-code)` 转发官网 OAuth 资源端点。
 * 换绑成功后官网撤销全部 OAuth 会话（本站需重新登录），由父级承接提示与收尾。
 */
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf } from "@/lib/fetch-client";

interface PhoneSectionProps {
  /** 当前是否绑定真实手机号（微信占位号/未绑定 = false：隐藏当前手机验证码，仅验证新号） */
  hasRealPhone: boolean;
  /** 换绑成功回调（父级展示新号并提示重新登录；入参为完整新手机号） */
  onUpdated: (newPhone: string) => void;
  /** 会话过期（401）：交给账户弹层统一走登录引导 */
  onSessionExpired: () => void;
  /** 收起表单（取消） */
  onCancel: () => void;
}

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white/60 px-4 py-3 text-base text-stone-800 outline-none transition-colors placeholder:text-stone-300 focus:border-stone-400 md:text-sm";

type ApiResult = { success?: boolean; error?: { code?: string; message?: string } } | null;

export function PhoneSection({ hasRealPhone, onUpdated, onSessionExpired, onCancel }: PhoneSectionProps) {
  const toast = useToast();
  const [newPhone, setNewPhone] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  // 当前/新手机两个发码按钮各自独立倒计时（互不阻塞）
  const [countdowns, setCountdowns] = useState({ current: 0, new: 0 });
  const [sending, setSending] = useState<"current" | "new" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (countdowns.current <= 0 && countdowns.new <= 0) return;
    const t = setTimeout(() => {
      setCountdowns((c) => ({ current: Math.max(0, c.current - 1), new: Math.max(0, c.new - 1) }));
    }, 1000);
    return () => clearTimeout(t);
  }, [countdowns]);

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

  /** 发送验证码：current 发到当前手机（验证身份，仅真实绑定号可用）；new 发到新手机（验证归属） */
  const sendCode = async (target: "current" | "new") => {
    if (sending || countdowns[target] > 0) return;
    if (target === "current" && !hasRealPhone) return;
    if (target === "new" && !/^1[3-9]\d{9}$/.test(newPhone)) {
      toast.warning("请输入正确的新手机号");
      return;
    }
    setSending(target);
    try {
      const data = await request("/api/account/phone/send-code", {
        method: "POST",
        body: JSON.stringify(target === "new" ? { target, newPhone } : { target }),
      });
      if (!data) return;
      if (data.success) {
        setCountdowns((c) => ({ ...c, [target]: 60 }));
        toast.success("验证码已发送");
      } else {
        toast.error(data.error?.message || "验证码发送失败");
      }
    } catch {
      // fetchWithCsrf 网络异常会抛出（无响应），必须兜底提示，否则发送态静默结束
      toast.error("网络异常，验证码发送失败，请稍后再试");
    } finally {
      setSending(null);
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      toast.warning("请输入正确的新手机号");
      return;
    }
    if (hasRealPhone && !/^\d{6}$/.test(currentCode)) {
      toast.warning("请输入 6 位当前手机验证码");
      return;
    }
    if (!/^\d{6}$/.test(newCode)) {
      toast.warning("请输入 6 位新手机验证码");
      return;
    }
    setSaving(true);
    try {
      const data = await request("/api/account/phone", {
        method: "PUT",
        body: JSON.stringify(
          hasRealPhone ? { newPhone, currentCode, newCode } : { newPhone, newCode }
        ),
      });
      if (!data) return;
      if (data.success) {
        setNewPhone("");
        setCurrentCode("");
        setNewCode("");
        onUpdated(newPhone);
      } else {
        toast.error(data.error?.message || "换绑失败");
      }
    } catch {
      // 网络异常时换绑结果未知（可能已成功）：提示到官网/稍后重查，避免误报成功
      toast.error("网络异常，换绑结果未知，请稍后重新登录确认");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-4">
      <h3 className="text-sm font-medium text-stone-700">换绑手机号</h3>
      <p className="text-xs text-stone-400">
        {hasRealPhone
          ? "为保障账户安全，需验证当前手机号和新手机号各一次；换绑成功后需重新登录。"
          : "当前账号未绑定手机号，验证新手机号后即可完成换绑；换绑成功后需重新登录。"}
      </p>

      <div>
        <label htmlFor="acct-new-phone" className="mb-1 block text-xs text-stone-400">
          新手机号
        </label>
        <input
          id="acct-new-phone"
          type="text"
          inputMode="numeric"
          maxLength={11}
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="输入新手机号"
          className={inputClass}
        />
      </div>

      {hasRealPhone && (
        <div>
          <label htmlFor="acct-current-code" className="mb-1 block text-xs text-stone-400">
            当前手机验证码
          </label>
          <div className="flex gap-2">
            <input
              id="acct-current-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6位验证码"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => sendCode("current")}
              disabled={countdowns.current > 0 || sending === "current"}
              className="shrink-0 rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-white/60 disabled:opacity-50 cursor-pointer"
            >
              {countdowns.current > 0 ? `${countdowns.current}s 后重发` : "发送验证码"}
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="acct-new-code" className="mb-1 block text-xs text-stone-400">
          新手机验证码
        </label>
        <div className="flex gap-2">
          <input
            id="acct-new-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6位验证码"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => sendCode("new")}
            disabled={countdowns.new > 0 || sending === "new"}
            className="shrink-0 rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-white/60 disabled:opacity-50 cursor-pointer"
          >
            {countdowns.new > 0 ? `${countdowns.new}s 后重发` : "发送验证码"}
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-full bg-brand-charcoal px-6 py-2.5 text-sm text-white transition-colors hover:bg-[#0d3b5c] disabled:opacity-50 cursor-pointer"
        >
          {saving ? "换绑中..." : "确认换绑"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-stone-200 px-6 py-2.5 text-sm text-stone-600 transition-colors hover:bg-white/60 disabled:opacity-50 cursor-pointer"
        >
          取消
        </button>
      </div>
    </div>
  );
}
