"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuthModal } from "./AuthModalContext";
import { useToast } from "@/components/ui/Toast";
import { Eye, EyeOff } from "lucide-react";
import { validatePasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { isSafeInternalPath } from "@/lib/url-utils";
import { LoginGuide } from "@/components/website/LoginGuide";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { useLegalDocModal } from "@/components/website/LegalDocModalContext";
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function AuthModal() {
    const { isOpen, view, closeAuthModal } = useAuthModal();
    const { openLegalDoc } = useLegalDocModal();
    const toast = useToast();

    const [loading, setLoading] = useState(false);
    const [regPhone, setRegPhone] = useState("");
    const [regCode, setRegCode] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regCodeSending, setRegCodeSending] = useState(false);
    const [regCountdown, setRegCountdown] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [mobileAgreed, setMobileAgreed] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setRegPhone("");
            setRegCode("");
            setRegPassword("");
            setRegCodeSending(false);
            setRegCountdown(0);
            setShowPassword(false);
            setMobileAgreed(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (view === "wechat_bind") {
            setRegPhone("");
            setRegCode("");
            setRegPassword("");
            setMobileAgreed(false);
        }
    }, [view]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (regCountdown > 0) {
            timer = setTimeout(
                () => setRegCountdown((previous) => previous - 1),
                1000,
            );
        }
        return () => clearTimeout(timer);
    }, [regCountdown]);

    const handleCancelWechatBind = () => {
        toast.info("已退出微信登录，您可以使用手机号登录。");
        closeAuthModal();
    };

    const handleWechatBind = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!mobileAgreed) return;
        if (!regPassword) {
            toast.error("请设置登录密码");
            return;
        }
        const passwordCheck = validatePasswordStrength(regPassword);
        if (!passwordCheck.valid) {
            toast.error(passwordCheck.message || "密码不符合要求");
            return;
        }
        setLoading(true);
        try {
            const res = await fetchWithCsrf("/api/auth/wechat/bind", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: regPhone,
                    code: regCode,
                    password: regPassword,
                    allowAutoPassword: false,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const message =
                    typeof data.error?.message === "string"
                        ? data.error.message
                        : typeof data.error === "string"
                          ? data.error
                          : typeof data.message === "string"
                            ? data.message
                            : "绑定未成功";
                throw new Error(message);
            }
            toast.success("绑定成功！");
            const redirectUrl = sessionStorage.getItem(
                STORAGE_KEYS.AUTH_REDIRECT,
            );
            sessionStorage.removeItem(STORAGE_KEYS.AUTH_REDIRECT);
            window.location.href = isSafeInternalPath(redirectUrl)
                ? redirectUrl
                : "/";
        } catch (error) {
            console.error(
                "[WechatBind]",
                error instanceof Error ? error.message : error,
            );
            toast.error(
                error instanceof Error
                    ? error.message
                    : "绑定未成功，请稍后重试",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSendRegCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(regPhone)) {
            toast.error("请输入有效的 11 位手机号。");
            return;
        }
        setRegCodeSending(true);
        try {
            const res = await fetch("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: regPhone, type: "register" }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(
                    data.error?.message || data.error || "验证码发送未成功",
                );
            toast.success("验证码已发送");
            setRegCountdown(60);
        } catch (error) {
            console.error(
                "[SendRegCode]",
                error instanceof Error ? error.message : error,
            );
            toast.error(
                error instanceof Error
                    ? error.message
                    : "验证码发送未成功，请稍后再试。",
            );
        } finally {
            setRegCodeSending(false);
        }
    };

    const isSsoView = view === "login" || view === "register";

    return (
        <Sheet
            open={isOpen}
            onOpenChange={(open) => {
                if (open) return;
                if (view === "wechat_bind") {
                    handleCancelWechatBind();
                } else {
                    closeAuthModal();
                }
            }}
        >
            <SheetContent
                side="right"
                className="w-full sm:max-w-md"
                showCloseButton
            >
                <SheetHeader className="items-center">
                    <Image
                        src="/NIHPLOD-logo.svg"
                        alt="NIHPLOD"
                        width={160}
                        height={52}
                        className="h-[52px] w-auto object-contain"
                        priority
                    />
                    <SheetTitle className="sr-only">
                        {view === "wechat_bind"
                            ? "绑定手机号"
                            : view === "forgot_password"
                              ? "找回密码"
                              : "登录或注册"}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        NIHPLOD 账号
                    </SheetDescription>
                </SheetHeader>

                <SheetBody className="flex flex-col justify-center px-6 py-8">
                    {view === "forgot_password" && (
                        <ForgotPasswordForm onBackToLogin={closeAuthModal} />
                    )}

                    {isSsoView && (
                        <LoginGuide onNavigateLogin={closeAuthModal} />
                    )}

                    {view === "wechat_bind" && (
                        <div className="space-y-6">
                            <div className="space-y-2 text-center">
                                <h2 className="text-xl font-semibold tracking-tight">
                                    绑定手机号
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    微信授权成功，请绑定手机号以完成登录。
                                </p>
                            </div>

                            <form
                                onSubmit={handleWechatBind}
                                className="space-y-4"
                            >
                                <Input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoComplete="tel"
                                    required
                                    value={regPhone}
                                    onChange={(event) =>
                                        setRegPhone(
                                            event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 11),
                                        )
                                    }
                                    placeholder="手机号"
                                    aria-label="手机号"
                                />

                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        required
                                        maxLength={6}
                                        autoComplete="one-time-code"
                                        value={regCode}
                                        onChange={(event) =>
                                            setRegCode(event.target.value)
                                        }
                                        placeholder="验证码"
                                        aria-label="验证码"
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleSendRegCode}
                                        disabled={
                                            regCodeSending ||
                                            regCountdown > 0 ||
                                            !regPhone
                                        }
                                        className="shrink-0"
                                    >
                                        {regCountdown > 0
                                            ? `${regCountdown}s`
                                            : "获取"}
                                    </Button>
                                </div>

                                <Input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    minLength={PASSWORD_MIN_LENGTH}
                                    maxLength={32}
                                    autoComplete="new-password"
                                    value={regPassword}
                                    onChange={(event) =>
                                        setRegPassword(event.target.value)
                                    }
                                    placeholder="密码（8位且含大写/小写/数字）"
                                    aria-label="密码"
                                    rightElement={
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setShowPassword(
                                                    (previous) => !previous,
                                                )
                                            }
                                            aria-label={
                                                showPassword
                                                    ? "隐藏密码"
                                                    : "显示密码"
                                            }
                                            className="size-8"
                                        >
                                            {showPassword ? (
                                                <EyeOff />
                                            ) : (
                                                <Eye />
                                            )}
                                        </Button>
                                    }
                                />

                                <div className="flex items-start gap-2.5">
                                    <Checkbox
                                        id="wechat-bind-agreement"
                                        checked={mobileAgreed}
                                        onCheckedChange={(checked) =>
                                            setMobileAgreed(checked === true)
                                        }
                                        className="mt-0.5"
                                    />
                                    <Label
                                        htmlFor="wechat-bind-agreement"
                                        className="text-xs leading-relaxed font-normal text-muted-foreground"
                                    >
                                        我已阅读并同意
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                openLegalDoc("terms");
                                            }}
                                            className="mx-0.5 underline underline-offset-4"
                                        >
                                            《用户协议》
                                        </button>
                                        和
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                openLegalDoc("privacy");
                                            }}
                                            className="mx-0.5 underline underline-offset-4"
                                        >
                                            《隐私政策》
                                        </button>
                                    </Label>
                                </div>

                                <Button
                                    type="submit"
                                    loading={loading}
                                    disabled={!mobileAgreed}
                                    className="w-full"
                                >
                                    绑定手机号
                                </Button>
                            </form>
                        </div>
                    )}
                </SheetBody>
            </SheetContent>
        </Sheet>
    );
}
