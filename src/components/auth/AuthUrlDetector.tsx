"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";

export function AuthUrlDetector() {
    const searchParams = useSearchParams();
    const { openAuthModal } = useAuthModal();

    useEffect(() => {
        const authView = searchParams.get("auth");
        const redirectUrl = searchParams.get("redirect");
        if (authView === "login" || authView === "register" || authView === "forgot_password") {
            if (redirectUrl) {
                sessionStorage.setItem("auth_redirect", redirectUrl);
            }
            openAuthModal(authView);
            // 清除 URL 参数
            const url = new URL(window.location.href);
            url.searchParams.delete("auth");
            url.searchParams.delete("redirect");
            window.history.replaceState({}, "", url.toString());
        }
    }, [searchParams, openAuthModal]);

    return null;
}
