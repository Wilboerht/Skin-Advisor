"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/auth/UserProvider";
import { SsoRedirectScreen } from "@/components/auth/SsoRedirectScreen";
import { isSafeInternalPath } from "@/lib/url-utils";

export default function LoginPage() {
    const { user, loading, login } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        // 已登录用户无需再走 SSO，直接回跳目标页（仅允许站内路径）
        if (user) {
            const redirect = new URLSearchParams(window.location.search).get("redirect");
            router.replace(isSafeInternalPath(redirect) ? redirect : "/");
            return;
        }
        // Trigger SSO login redirect. The central SSO login page handles
        // password, SMS code and registration flows.
        login();
    }, [user, loading, login, router]);

    return <SsoRedirectScreen message="正在跳转到 NIHPLOD 登录页…" />;
}
