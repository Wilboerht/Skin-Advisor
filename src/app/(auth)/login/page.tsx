"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/auth/UserProvider";
import { SsoRedirectScreen, SsoCookiesDisabledScreen } from "@/components/auth/SsoRedirectScreen";
import { isSafeInternalPath } from "@/lib/url-utils";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export default function LoginPage() {
    const { user, loading, login } = useUser();
    const router = useRouter();
    // Cookie 全禁时 SSO 回调种不了会话 Cookie，跳转只会失败兜圈——直接拦截提示
    const [cookiesDisabled, setCookiesDisabled] = useState(false);

    useEffect(() => {
        if (loading) return;
        if (typeof navigator !== "undefined" && !navigator.cookieEnabled) {
            setCookiesDisabled(true);
            return;
        }
        // 已登录用户无需再走 SSO，直接回跳目标页（仅允许站内路径）
        if (user) {
            const redirect = new URLSearchParams(window.location.search).get("redirect");
            router.replace(isSafeInternalPath(redirect) ? redirect : "/");
            return;
        }
        // /login?redirect=...：UserProvider.login 在 /login 路径上默认回首页，
        // 先把目标存入 AUTH_REDIRECT，SSO 回跳后由 AuthUrlDetector 消费。
        const redirect = new URLSearchParams(window.location.search).get("redirect");
        if (isSafeInternalPath(redirect)) {
            try {
                sessionStorage.setItem(STORAGE_KEYS.AUTH_REDIRECT, redirect);
            } catch {
                /* ignore */
            }
        }
        // Trigger SSO login redirect. The central SSO login page handles
        // password, SMS code and registration flows.
        login();
    }, [user, loading, login, router]);

    if (cookiesDisabled) return <SsoCookiesDisabledScreen />;
    return <SsoRedirectScreen message="正在跳转到 NIHPLOD 登录页…" />;
}
