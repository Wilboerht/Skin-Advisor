/**
 * 带 CSRF token 的客户端 fetch 封装
 *
 * 自动从 document.cookie 读取 csrf_token 并加入 X-CSRF-Token header。
 * 用于所有会触发 C 端状态变更的请求（POST/PUT/PATCH/DELETE）。
 * 默认 30 秒超时，防止网络挂起导致 UI 永久等待。
 *
 * SSO 迁移说明：
 * - access_token 的刷新由 @nihplod/sso-sdk/react 的 SsoProvider 自动处理。
 * - 本封装不再调用 /api/auth/refresh；收到 401 时由业务层决定跳转登录或降级处理。
 */

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf-client";

const DEFAULT_TIMEOUT_MS = 30_000;

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfToken(): string | null {
    return getCookie(CSRF_COOKIE_NAME);
}

export async function fetchWithCsrf(
    input: RequestInfo | URL,
    init: RequestInit = {}
): Promise<Response> {
    const method = (init.method || "GET").toUpperCase();
    const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];

    const headers = new Headers(init.headers);

    if (unsafeMethods.includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers.set(CSRF_HEADER_NAME, csrfToken);
        }
    }

    const hasExternalSignal = !!init.signal;
    const controller = hasExternalSignal ? null : new AbortController();
    const timeoutId = hasExternalSignal ? null : setTimeout(() => controller!.abort(), DEFAULT_TIMEOUT_MS);

    try {
        return await fetch(input, {
            ...init,
            headers,
            signal: init.signal || controller?.signal,
        });
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}
