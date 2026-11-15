"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Eye, EyeOff, Loader2, LockKeyhole, Phone } from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import {
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    validatePasswordStrength,
} from "@/lib/password";

const PHONE_RE = /^1[3-9]\d{9}$/;

function readError(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== "object") return fallback;
    const record = payload as Record<string, unknown>;
    const error = record.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
        return (error as { message: string }).message;
    }
    if (typeof record.message === "string") return record.message;
    return fallback;
}

export function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin?: () => void }) {
    const toast = useToast();
    const { login } = useAuth();

    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [succeeded, setSucceeded] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const sendCode = async () => {
        if (!PHONE_RE.test(phone)) {
            setError("请输入正确的 11 位手机号");
            return;
        }
        setError("");
        setSending(true);
        try {
            const res = await fetchWithCsrf("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, type: "reset" }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(readError(data, "验证码发送未成功"));
            setCodeSent(true);
            setCountdown(60);
            toast.success("验证码已发送");
        } catch (e) {
            const message = e instanceof Error ? e.message : "验证码发送未成功，请稍后再试";
            setError(message);
            toast.error(message);
        } finally {
            setSending(false);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!PHONE_RE.test(phone)) {
            setError("请输入正确的 11 位手机号");
            return;
        }
        if (!/^\d{6}$/.test(code)) {
            setError("请输入 6 位短信验证码");
            return;
        }
        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.valid) {
            setError(passwordCheck.message || "密码不符合要求");
            return;
        }
        if (password !== confirmPassword) {
            setError("两次密码输入不一致");
            return;
        }
        setError("");
        setSubmitting(true);
        try {
            const res = await fetchWithCsrf("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code, password, confirmPassword }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(readError(data, "重置失败，请稍后重试"));
            setSucceeded(true);
            toast.success("密码已重置");
        } catch (e) {
            const message = e instanceof Error ? e.message : "重置失败，请稍后重试";
            setError(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass =
        "w-full rounded-lg border border-brand-charcoal/15 bg-white/70 px-10 py-3.5 text-[15px] text-brand-charcoal placeholder:text-brand-charcoal/35 focus:outline-none focus:border-brand-charcoal/40 transition-colors";
    const buttonClass =
        "w-full h-12 rounded-full bg-[var(--color-brand-cocoa)] text-[#FDFBF7] text-[14px] font-normal tracking-[0.08em] transition-colors hover:bg-[#4a3a2c] disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2";

    if (succeeded) {
        return (
            <div className="flex flex-col items-center text-center py-8">
                <CheckCircle className="mb-5 h-14 w-14 text-[#3d7a4d]" strokeWidth={1.4} />
                <h3 className="mb-2 text-xl font-serif font-light text-brand-charcoal tracking-[0.06em]">
                    密码已重置
                </h3>
                <p className="mb-7 text-[13px] font-light leading-[1.8] text-brand-charcoal/60">
                    请使用新密码登录，您的其他设备需要重新登录。
                </p>
                <button type="button" onClick={() => login()} className={buttonClass}>
                    去登录
                </button>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-7 text-center">
                <h3 className="text-xl font-serif font-light text-brand-charcoal tracking-[0.06em]">
                    找回密码
                </h3>
                <p className="mt-2 text-[13px] font-light leading-[1.8] text-brand-charcoal/60">
                    通过注册手机号验证身份，重置后需重新登录。
                </p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" strokeWidth={1.6} />
                    <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={11}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="注册手机号"
                        aria-label="注册手机号"
                        className={inputClass}
                    />
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" strokeWidth={1.6} />
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                            placeholder="6 位短信验证码"
                            aria-label="短信验证码"
                            className={inputClass}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={sendCode}
                        disabled={sending || countdown > 0}
                        className="shrink-0 rounded-lg border border-brand-charcoal/20 px-4 text-[12px] font-light text-brand-charcoal/70 transition-colors hover:border-brand-charcoal/40 hover:text-brand-charcoal disabled:opacity-45"
                    >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : countdown > 0 ? `${countdown}s` : codeSent ? "重新发送" : "发送验证码"}
                    </button>
                </div>

                <div className="relative">
                    <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" strokeWidth={1.6} />
                    <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={PASSWORD_MIN_LENGTH}
                        maxLength={PASSWORD_MAX_LENGTH}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="新密码（8-32 位，含大小写和数字）"
                        aria-label="新密码"
                        className={`${inputClass} pr-11`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-brand-charcoal/40 hover:text-brand-charcoal"
                    >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                </div>

                <div className="relative">
                    <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" strokeWidth={1.6} />
                    <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={PASSWORD_MIN_LENGTH}
                        maxLength={PASSWORD_MAX_LENGTH}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="确认新密码"
                        aria-label="确认新密码"
                        className={`${inputClass} pr-4`}
                    />
                </div>

                {error && (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-700">
                        {error}
                    </p>
                )}

                <button type="submit" disabled={submitting} className={buttonClass}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认重置"}
                </button>
            </form>

            <div className="mt-6 text-center">
                <button
                    type="button"
                    onClick={() => {
                        onBackToLogin?.();
                        login();
                    }}
                    className="text-[12px] tracking-[0.08em] text-brand-charcoal/55 transition-colors hover:text-brand-charcoal"
                >
                    返回登录
                </button>
            </div>
        </div>
    );
}
