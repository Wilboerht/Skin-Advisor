"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { useAuth } from "@/hooks/useAuth";

export function AuthUrlDetector() {
    const searchParams = useSearchParams();
    const { openAuthModal } = useAuthModal();
    const { user } = useAuth();
    const router = useRouter();
    const openAuthModalRef = useRef(openAuthModal);
    openAuthModalRef.current = openAuthModal;

    // 检测 URL 参数：打开弹窗或直接跳转（已登录时）
    useEffect(() => {
        const authView = searchParams.get("auth");
        const redirectUrl = searchParams.get("redirect");

        if (authView === "login" || authView === "register" || authView === "forgot_password") {
            if (redirectUrl) {
                sessionStorage.setItem("auth_redirect", redirectUrl);
            }

            // 已登录用户直接跳转，无需打开弹窗
            if (user) {
                const target = redirectUrl || sessionStorage.getItem("auth_redirect");
                if (target) {
                    sessionStorage.removeItem("auth_redirect");
                    router.push(target);
                }
                if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("auth");
                    url.searchParams.delete("redirect");
                    window.history.replaceState({}, "", url.toString());
                }
                return;
            }

            openAuthModalRef.current(authView);
            const url = new URL(window.location.href);
            url.searchParams.delete("auth");
            url.searchParams.delete("redirect");
            window.history.replaceState({}, "", url.toString());
        }
    }, [searchParams, user, router]);

    // 登录后自动消费 pending redirect（覆盖微信OAuth回调等场景）
    useEffect(() => {
        if (user) {
            const pendingRedirect = sessionStorage.getItem("auth_redirect");
            if (pendingRedirect) {
                sessionStorage.removeItem("auth_redirect");
                router.push(pendingRedirect);
            }
        }
    }, [user, router]);

    return null;
}
