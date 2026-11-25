"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface PhoneSectionProps {
    hasRealPhone: boolean;
    onUpdated: (newPhone: string) => void;
    onSessionExpired: () => void;
    onCancel: () => void;
}

type ApiResult =
    | { success?: boolean; error?: { code?: string; message?: string } }
    | null;

export function PhoneSection({
    hasRealPhone,
    onUpdated,
    onSessionExpired,
    onCancel,
}: PhoneSectionProps) {
    const toast = useToast();
    const [newPhone, setNewPhone] = useState("");
    const [currentCode, setCurrentCode] = useState("");
    const [newCode, setNewCode] = useState("");
    const [countdowns, setCountdowns] = useState({ current: 0, new: 0 });
    const [sending, setSending] = useState<"current" | "new" | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (countdowns.current <= 0 && countdowns.new <= 0) return;
        const timer = setTimeout(() => {
            setCountdowns((current) => ({
                current: Math.max(0, current.current - 1),
                new: Math.max(0, current.new - 1),
            }));
        }, 1000);
        return () => clearTimeout(timer);
    }, [countdowns]);

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
                body: JSON.stringify(
                    target === "new" ? { target, newPhone } : { target },
                ),
            });
            if (!data) return;
            if (data.success) {
                setCountdowns((current) => ({ ...current, [target]: 60 }));
                toast.success("验证码已发送");
            } else {
                toast.error(data.error?.message || "验证码发送失败");
            }
        } catch {
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
                    hasRealPhone
                        ? { newPhone, currentCode, newCode }
                        : { newPhone, newCode },
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
            toast.error("网络异常，换绑结果未知，请稍后重新登录确认");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-md space-y-4">
            <h3 className="text-sm font-medium">换绑手机号</h3>
            <p className="text-xs text-muted-foreground">
                {hasRealPhone
                    ? "为保障账户安全，需验证当前手机号和新手机号各一次；换绑成功后需重新登录。"
                    : "当前账号未绑定手机号，验证新手机号后即可完成换绑；换绑成功后需重新登录。"}
            </p>

            <Input
                id="acct-new-phone"
                label="新手机号"
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={newPhone}
                onChange={(event) =>
                    setNewPhone(event.target.value.replace(/\D/g, ""))
                }
                placeholder="输入新手机号"
            />

            {hasRealPhone && (
                <div className="flex items-end gap-2">
                    <Input
                        id="acct-current-code"
                        label="当前手机验证码"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={currentCode}
                        onChange={(event) =>
                            setCurrentCode(
                                event.target.value.replace(/\D/g, ""),
                            )
                        }
                        placeholder="6 位验证码"
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => sendCode("current")}
                        disabled={
                            countdowns.current > 0 || sending === "current"
                        }
                        className="shrink-0"
                    >
                        {countdowns.current > 0
                            ? `${countdowns.current}s 后重发`
                            : "发送验证码"}
                    </Button>
                </div>
            )}

            <div className="flex items-end gap-2">
                <Input
                    id="acct-new-code"
                    label="新手机验证码"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={newCode}
                    onChange={(event) =>
                        setNewCode(event.target.value.replace(/\D/g, ""))
                    }
                    placeholder="6 位验证码"
                    className="flex-1"
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => sendCode("new")}
                    disabled={countdowns.new > 0 || sending === "new"}
                    className="shrink-0"
                >
                    {countdowns.new > 0
                        ? `${countdowns.new}s 后重发`
                        : "发送验证码"}
                </Button>
            </div>

            <div className="flex gap-3 pt-1">
                <Button type="button" onClick={handleSubmit} loading={saving}>
                    确认换绑
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={saving}
                >
                    取消
                </Button>
            </div>
        </div>
    );
}
