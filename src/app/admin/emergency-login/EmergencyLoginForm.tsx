"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
            const data = (await response.json().catch(() => null)) as {
                success?: boolean;
                error?: string;
            } | null;
            if (!response.ok || !data?.success) {
                setError(data?.error || "登录失败");
                return;
            }
            window.location.href = "/admin";
        } catch {
            setError("网络异常，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Input
                label="应急账号"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
            />
            <Input
                label="密码"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
            />
            <Input
                label="动态验证码"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
            />

            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
                应急登录
            </Button>
        </form>
    );
}
