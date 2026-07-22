/**
 * 带 CSRF token 的客户端 fetch 封装
 *
 * 自动从 document.cookie 读取 csrf_token 并加入 X-CSRF-Token header。
 * 用于所有会触发 C 端状态变更的请求（POST/PUT/PATCH/DELETE）。
 * 默认 30 秒超时，防止网络挂起导致 UI 永久等待。
 *
 * 额外行为：
 * - 当服务端返回 401/403 且疑似 session 过期/无效时，自动尝试 /api/auth/refresh
 *   刷新 access token，然后重试原请求一次，避免用户因 token 过期被拦在正常流程外。
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

const RETRIED_AFTER_REFRESH = Symbol("retried-after-refresh");

interface FetchWithCsrfInit extends RequestInit {
    [RETRIED_AFTER_REFRESH]?: boolean;
}

let refreshPromise: Promise<Response> | null = null;

async function refreshAccessToken(): Promise<Response> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
    });

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

function shouldRetryAfterRefresh(response: Response): boolean {
    // 仅对 session 相关错误重试；普通 403（如 CSRF mismatch）刷新通常无济于事，
    // 但 access token 过期导致的 401/403 刷新后可恢复。
    if (response.status !== 401 && response.status !== 403) return false;

    // 用 header 作为轻量判断；若服务端返回更具体的错误体，可进一步细化。
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return false;

    return true;
}

function isAuthEndpoint(input: RequestInfo | URL): boolean {
    const url = typeof input === "string" ? input : input.toString();
    return url.includes("/api/auth/refresh") || url.includes("/api/auth/login") || url.includes("/api/auth/logout");
}

export async function fetchWithCsrf(
    input: RequestInfo | URL,
    init: FetchWithCsrfInit = {}
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
        const response = await fetch(input, {
            ...init,
            headers,
            signal: init.signal || controller?.signal,
        });

        // 自动刷新：仅一次、不刷新刷新接口本身、且响应疑似 session 问题时
        if (!response.ok && !init[RETRIED_AFTER_REFRESH] && !isAuthEndpoint(input) && shouldRetryAfterRefresh(response)) {
            const clonedResponse = response.clone();
            let errorData: { error?: string; message?: string } = {};
            try {
                errorData = await clonedResponse.json();
            } catch {
                // ignore parse error
            }

            const isSessionError =
                response.status === 401 ||
                errorData.error?.includes("session") ||
                errorData.error?.includes("Unauthorized") ||
                errorData.error?.includes("CSRF token missing");

            if (isSessionError) {
                // 没有 CSRF cookie 说明从未登录或已登出，刷新不可能成功，
                // 直接返回原响应避免游客触发无意义的 /api/auth/refresh 401。
                if (!getCsrfToken()) {
                    return response;
                }
                const refreshResponse = await refreshAccessToken();
                if (refreshResponse.ok) {
                    return fetchWithCsrf(input, { ...init, [RETRIED_AFTER_REFRESH]: true });
                }
            }
        }

        return response;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}
