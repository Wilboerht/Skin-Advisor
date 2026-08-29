"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { isSafeInternalPath } from "@/lib/url-utils";

export function AuthUrlDetector() {
    const searchParams = useSearchParams();
    const { openAuthModal } = useAuthModal();
    const { user } = useAuth();
    const router = useRouter();
    const toast = useToast();
    const openAuthModalRef = useRef(openAuthModal);
    useEffect(() => {
        openAuthModalRef.current = openAuthModal;
    }, [openAuthModal]);

    // 检测 URL 参数：打开弹窗或直接跳转（已登录时）
    useEffect(() => {
        const authView = searchParams.get("auth");
        const redirectUrl = searchParams.get("redirect");

        if (authView === "login" || authView === "register" || authView === "forgot_password") {
            // 仅保留站内路径，防止开放重定向
            if (redirectUrl && isSafeInternalPath(redirectUrl)) {
                sessionStorage.setItem(STORAGE_KEYS.AUTH_REDIRECT, redirectUrl);
            }

            // 已登录用户直接跳转，无需打开弹窗
            if (user) {
                const pending = sessionStorage.getItem(STORAGE_KEYS.AUTH_REDIRECT);
                const target = isSafeInternalPath(redirectUrl)
                    ? redirectUrl
                    : isSafeInternalPath(pending)
                    ? pending
                    : null;
                if (target) {
                    sessionStorage.removeItem(STORAGE_KEYS.AUTH_REDIRECT);
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
            const pendingRedirect = sessionStorage.getItem(STORAGE_KEYS.AUTH_REDIRECT);
            if (pendingRedirect) {
                sessionStorage.removeItem(STORAGE_KEYS.AUTH_REDIRECT);
                router.push(isSafeInternalPath(pendingRedirect) ? pendingRedirect : "/");
            }
        }
    }, [user, router]);

    // 展示微信授权错误信息并清理 URL
    useEffect(() => {
        const wechatAuth = searchParams.get("wechat_auth");
        if (wechatAuth === "error") {
            const message = searchParams.get("message");
            const code = searchParams.get("code");
            const displayMessage = message
                ? decodeURIComponent(message)
                : code === "WECHAT_DENIED"
                ? "您取消了微信授权"
                : "微信授权未成功，请稍后重试";
            toast.error(displayMessage);

            if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.delete("wechat_auth");
                url.searchParams.delete("code");
                url.searchParams.delete("message");
                window.history.replaceState({}, "", url.toString());
            }
        }
    }, [searchParams, toast]);

    return null;
}
