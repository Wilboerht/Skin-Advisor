"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Lock, LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

function ssoErrorMessage(code: string | null) {
    switch (code) {
        case "sso_forbidden":
            return "当前账号没有测肤子站访问权限，请联系主站管理员开通「测肤子站访问」。";
        case "sso_expired":
            return "主站登录已过期，请重新登录。";
        case "sso_totp_required":
            return "后台已启用二次验证强制策略，请先在 NIHPLOD 主站开启 TOTP 后再登录。";
        case "sso_denied":
            return "主站授权已取消或未通过，请重新登录。";
        case "sso_state":
            return "登录状态校验失败，请重新发起登录。";
        case "sso_unreachable":
            return "主站认证服务暂时不可用，请稍后重试。";
        case "sso_conflict":
            return "账号身份已绑定其他主站管理员，请联系主站管理员。";
        case "sso_disabled":
            return "管理员 SSO 尚未启用，请联系主站运维。";
        case "sso_not_configured":
            return "管理员 SSO 配置不完整，请联系主站运维检查环境变量。";
        case "sso_rate_limited":
            return "登录过于频繁，请稍后再试。";
        case "sso_failed":
            return "主站管理员认证失败，请重新登录。";
        default:
            return "";
    }
}

function AdminLoginForm() {
    const searchParams = useSearchParams();
    const rawRedirect = searchParams.get("redirect") || "/admin";
    const redirectTo =
        rawRedirect.startsWith("/admin") &&
        !rawRedirect.startsWith("/admin/login") &&
        !rawRedirect.startsWith("/admin/emergency-login")
            ? rawRedirect
            : "/admin";
    const error = ssoErrorMessage(searchParams.get("error"));

    return (
        <div className="flex min-h-dvh flex-col bg-white">
            <main className="flex flex-1 items-center justify-center px-4 py-8">
                <div className="flex w-full max-w-sm flex-col gap-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-charcoal/10 bg-brand-charcoal/[0.04]">
                            <Lock className="h-5 w-5 text-brand-charcoal/65" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <Image
                                src="/NIHPLOD-logo.svg"
                                alt="NIHPLOD"
                                width={120}
                                height={30}
                                className="h-6 w-auto"
                                priority
                            />
                            <h1 className="text-xl font-semibold tracking-tight text-brand-charcoal">
                                管理后台
                            </h1>
                            <p className="text-sm text-brand-charcoal/65">
                                使用主站管理员账号登录
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex flex-col gap-4 rounded-2xl border border-brand-charcoal/10 bg-white p-6">
                        <Button
                            className="w-full"
                            leftIcon={<LogIn className="h-4 w-4" />}
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (redirectTo !== "/admin")
                                    params.set("return_to", redirectTo);
                                const query = params.toString();
                                window.location.href =
                                    "/api/admin/auth/sso/start" +
                                    (query ? `?${query}` : "");
                            }}
                        >
                            使用 NIHPLOD 管理员账号登录
                        </Button>
                        <p className="text-center text-xs leading-relaxed text-brand-charcoal/65">
                            管理员账号、密码和二次验证统一由主站管理。
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-brand-charcoal/65">
                        <Link
                            href="/"
                            className="transition-colors hover:text-brand-charcoal"
                        >
                            返回官网
                        </Link>
                    </div>
                </div>
            </main>

            <footer className="flex flex-col items-center gap-1 px-6 pb-6">
                <p className="text-[11px] font-light tracking-widest text-brand-charcoal/65">
                    © {new Date().getFullYear()} NIHPLOD All Rights Reserved.
                </p>
            </footer>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-dvh items-center justify-center text-sm text-brand-charcoal/65">
                    加载中...
                </div>
            }
        >
            <AdminLoginForm />
        </Suspense>
    );
}
