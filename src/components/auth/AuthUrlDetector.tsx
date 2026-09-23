"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { isSafeInternalPath } from "@/lib/url-utils";

/**
 * session-init / SSO 回调失败重定向（/?error=...&return_to=...）的错误码文案。
 * 只消费这些由本站认证链路产出的枚举值，其他来源的 error 参数原样保留。
 * 与 src/app/api/auth/session-init/route.ts 的 fail() 错误码、
 * src/app/api/auth/callback/route.ts 的 cookies_disabled 保持一致。
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
    no_session: "登录状态创建失败，请重试",
    rate_limited: "操作过于频繁，请稍后再试",
    db_error: "登录状态创建失败，请重试",
    session_sign_failed: "登录状态创建失败，请重试",
    session_init_failed: "登录状态创建失败，请重试",
    cookies_disabled: "请开启浏览器 Cookie 后再登录",
};

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

    // 检测 ?login=wechat_bind（/wechat-bind 服务端重定向而来）：
    // AuthModal 改为懒挂载后无法自行感知 URL 参数，本检测上移至常驻组件；
    // exchange token 走 httpOnly Cookie，这里只负责保存回跳目标、打开绑定视图并清理 URL
    useEffect(() => {
        if (searchParams.get("login") !== "wechat_bind") return;
        const redirectUrl = searchParams.get("redirect");
        if (redirectUrl && isSafeInternalPath(redirectUrl)) {
            sessionStorage.setItem(STORAGE_KEYS.AUTH_REDIRECT, redirectUrl);
        }
        openAuthModalRef.current("wechat_bind");
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("login");
            url.searchParams.delete("wechat_exchange_token");
            url.searchParams.delete("redirect");
            window.history.replaceState({}, "", url.toString());
        }
    }, [searchParams]);

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

    // 消费认证链路的失败重定向错误码（session-init 302 到 /?error=...），
    // toast 提示后清掉 URL 参数（error 与随之附带的 return_to 一并清理）
    useEffect(() => {
        const error = searchParams.get("error");
        if (!error || !(error in AUTH_ERROR_MESSAGES)) return;
        toast.error(AUTH_ERROR_MESSAGES[error]);
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("error");
            url.searchParams.delete("return_to");
            window.history.replaceState({}, "", url.toString());
        }
    }, [searchParams, toast]);

    return null;
}
