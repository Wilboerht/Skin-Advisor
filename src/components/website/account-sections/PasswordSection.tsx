"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { validatePasswordStrength } from "@/lib/password";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface PasswordSectionProps {
    hasPassword: boolean | null | undefined;
    onUpdated: () => void;
    onSessionExpired: () => void;
}

type ApiResult =
    | { success?: boolean; error?: { code?: string; message?: string } }
    | null;

export function PasswordSection({
    hasPassword,
    onUpdated,
    onSessionExpired,
}: PasswordSectionProps) {
    const toast = useToast();
    const [mode, setMode] = useState<"change" | "set">(
        hasPassword === false ? "set" : "change",
    );
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [setCode, setSetCode] = useState("");
    const [countdown, setCountdown] = useState(0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setMode(hasPassword === false ? "set" : "change");
    }, [hasPassword]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(
                () => setCountdown((value) => value - 1),
                1000,
            );
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const request = async (
        input: string,
        init: RequestInit,
    ): Promise<ApiResult> => {
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

    const handleSendSetCode = async () => {
        if (countdown > 0) return;
        try {
            const data = await request("/api/user/password/set-code", {
                method: "POST",
                body: "{}",
            });
            if (!data) return;
            if (data.success) {
                setCountdown(60);
                toast.success("验证码已发送");
            } else {
                toast.error(data.error?.message || "验证码发送失败");
            }
        } catch {
            toast.error("网络异常，验证码发送失败，请稍后再试");
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
                    body: JSON.stringify({
                        oldPassword,
                        newPassword,
                        confirmPassword,
                    }),
                });
                if (!data) return;
                if (data.success) {
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    onUpdated();
                } else if (data.error?.code === "PASSWORD_NOT_SET") {
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
                    body: JSON.stringify({
                        code: setCode,
                        password: newPassword,
                        confirmPassword,
                    }),
                });
                if (!data) return;
                if (data.success) {
                    setSetCode("");
                    setNewPassword("");
                    setConfirmPassword("");
                    onUpdated();
                } else {
                    toast.error(data.error?.message || "设置失败");
                }
            }
        } catch {
            toast.error("网络异常，操作结果未知，请稍后重新登录确认");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-md space-y-4">
            <h3 className="text-sm font-medium">
                {mode === "change" ? "修改密码" : "设置密码（短信验证）"}
            </h3>
            {mode === "set" && (
                <p className="text-xs text-muted-foreground">
                    您的账号尚未设置密码，请通过手机验证码设置。
                </p>
            )}

            {mode === "change" && (
                <Input
                    id="acct-old-password"
                    label="旧密码"
                    type="password"
                    autoComplete="current-password"
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                />
            )}

            {mode === "set" && (
                <div className="flex items-end gap-2">
                    <Input
                        id="acct-set-code"
                        label="短信验证码"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={setCode}
                        onChange={(event) =>
                            setSetCode(event.target.value.replace(/\D/g, ""))
                        }
                        placeholder="6 位验证码"
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendSetCode}
                        disabled={countdown > 0}
                        className="shrink-0"
                    >
                        {countdown > 0
                            ? `${countdown}s 后重发`
                            : "发送验证码"}
                    </Button>
                </div>
            )}

            <Input
                id="acct-new-password"
                label={mode === "change" ? "新密码" : "密码"}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
            />

            <Input
                id="acct-confirm-password"
                label={mode === "change" ? "确认新密码" : "确认密码"}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
            />

            <Button
                type="button"
                onClick={handleSubmit}
                loading={saving}
                className="w-full sm:w-auto"
            >
                {mode === "change" ? "修改密码" : "设置密码"}
            </Button>
        </div>
    );
}
