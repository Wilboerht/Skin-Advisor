"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/auth/UserProvider";
import { SsoRedirectScreen, SsoCookiesDisabledScreen } from "@/components/auth/SsoRedirectScreen";
import { isSafeInternalPath } from "@/lib/url-utils";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export default function RegisterPage() {
    const { register } = useUser();
    // Cookie 全禁时 SSO 回调种不了会话 Cookie，跳转只会失败兜圈——直接拦截提示
    const [cookiesDisabled, setCookiesDisabled] = useState(false);

    useEffect(() => {
        if (typeof navigator !== "undefined" && !navigator.cookieEnabled) {
            setCookiesDisabled(true);
            return;
        }
        // /register?redirect=...：与登录页同口径，先保存 SSO 回跳目标。
        const redirect = new URLSearchParams(window.location.search).get("redirect");
        if (isSafeInternalPath(redirect)) {
            try {
                sessionStorage.setItem(STORAGE_KEYS.AUTH_REDIRECT, redirect);
            } catch {
                /* ignore */
            }
        }
        // Trigger SSO login redirect. Users can register on the central SSO page.
        register();
    }, [register]);

    if (cookiesDisabled) return <SsoCookiesDisabledScreen />;
    return <SsoRedirectScreen message="正在跳转到 NIHPLOD 注册页…" />;
}
