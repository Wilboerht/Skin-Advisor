"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/auth/UserProvider";
import { SsoRedirectScreen, SsoCookiesDisabledScreen } from "@/components/auth/SsoRedirectScreen";

export default function RegisterPage() {
    const { register } = useUser();
    // Cookie 全禁时 SSO 回调种不了会话 Cookie，跳转只会失败兜圈——直接拦截提示
    const [cookiesDisabled, setCookiesDisabled] = useState(false);

    useEffect(() => {
        if (typeof navigator !== "undefined" && !navigator.cookieEnabled) {
            setCookiesDisabled(true);
            return;
        }
        // Trigger SSO login redirect. Users can register on the central SSO page.
        register();
    }, [register]);

    if (cookiesDisabled) return <SsoCookiesDisabledScreen />;
    return <SsoRedirectScreen message="正在跳转到 NIHPLOD 注册页…" />;
}
