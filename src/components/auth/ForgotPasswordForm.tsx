"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Eye, EyeOff, LockKeyhole, Phone } from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
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
    if (
        error &&
        typeof error === "object" &&
        typeof (error as { message?: unknown }).message === "string"
    ) {
        return (error as { message: string }).message;
    }
    if (typeof record.message === "string") return record.message;
    return fallback;
}

export function ForgotPasswordForm({
    onBackToLogin,
}: {
    onBackToLogin?: () => void;
}) {
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
        const timer = setTimeout(
            () => setCountdown((value) => Math.max(0, value - 1)),
            1000,
        );
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
            const message =
                e instanceof Error
                    ? e.message
                    : "验证码发送未成功，请稍后再试";
            setError(message);
            toast.error(message);
        } finally {
            setSending(false);
        }
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
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
            const message =
                e instanceof Error ? e.message : "重置失败，请稍后重试";
            setError(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (succeeded) {
        return (
            <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="mb-5 size-14 text-state-great" />
                <h3 className="mb-2 text-xl font-semibold tracking-tight">
                    密码已重置
                </h3>
                <p className="mb-7 text-sm text-muted-foreground">
                    请使用新密码登录，您的其他设备需要重新登录。
                </p>
                <Button type="button" onClick={() => login()} className="w-full">
                    去登录
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-7 text-center">
                <h3 className="text-xl font-semibold tracking-tight">
                    找回密码
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    通过注册手机号验证身份，重置后需重新登录。
                </p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
                <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    value={phone}
                    onChange={(event) =>
                        setPhone(event.target.value.replace(/\D/g, ""))
                    }
                    placeholder="注册手机号"
                    aria-label="注册手机号"
                    leftElement={<Phone className="size-4" />}
                />

                <div className="flex gap-2">
                    <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(event) =>
                            setCode(event.target.value.replace(/\D/g, ""))
                        }
                        placeholder="6 位短信验证码"
                        aria-label="短信验证码"
                        leftElement={<LockKeyhole className="size-4" />}
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={sendCode}
                        disabled={sending || countdown > 0}
                        className="shrink-0"
                    >
                        {sending
                            ? "发送中…"
                            : countdown > 0
                              ? `${countdown}s`
                              : codeSent
                                ? "重新发送"
                                : "发送验证码"}
                    </Button>
                </div>

                <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="新密码（8-32 位，含大小写和数字）"
                    aria-label="新密码"
                    leftElement={<LockKeyhole className="size-4" />}
                    rightElement={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? "隐藏密码" : "显示密码"}
                            className="size-8"
                        >
                            {showPassword ? <EyeOff /> : <Eye />}
                        </Button>
                    }
                />

                <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="确认新密码"
                    aria-label="确认新密码"
                    leftElement={<LockKeyhole className="size-4" />}
                />

                {error && (
                    <p
                        role="alert"
                        className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                        {error}
                    </p>
                )}

                <Button type="submit" loading={submitting} className="w-full">
                    确认重置
                </Button>
            </form>

            <div className="mt-6 text-center">
                <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                        onBackToLogin?.();
                        login();
                    }}
                    className="h-auto p-0 text-xs text-muted-foreground"
                >
                    返回登录
                </Button>
            </div>
        </div>
    );
}
