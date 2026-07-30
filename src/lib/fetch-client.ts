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
const UPLOAD_TIMEOUT_MS = 60_000; // 上传大图片需要更长时间

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
    init: RequestInit = {},
    options: { retries?: number; timeoutMs?: number } = {}
): Promise<Response> {
    const { retries = 0, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    const method = (init.method || "GET").toUpperCase();
    const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const headers = new Headers(init.headers);

        if (unsafeMethods.includes(method)) {
            const csrfToken = getCsrfToken();
            if (csrfToken) {
                headers.set(CSRF_HEADER_NAME, csrfToken);
            }
        }

        const hasExternalSignal = !!init.signal;
        const controller = hasExternalSignal ? null : new AbortController();
        const timeoutId = hasExternalSignal ? null : setTimeout(() => controller!.abort(), timeoutMs);

        try {
            const res = await fetch(input, {
                ...init,
                headers,
                signal: init.signal || controller?.signal,
            });

            // 5xx 才重试；4xx 立即返回给上层处理
            if (!res.ok && attempt < retries && res.status >= 500 && res.status < 600) {
                throw new Error(`Server returned ${res.status}`);
            }
            return res;
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            if (attempt < retries) {
                const delay = 1000 * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error("Request failed after retries");
}

/**
 * 带超时和重试的 fetch 封装
 * 用于上传等可能因网络抖动失败的请求
 *
 * @param input 请求 URL
 * @param init fetch 选项
 * @param options 重试配置
 */
export async function fetchWithRetry(
    input: RequestInfo | URL,
    init: RequestInit = {},
    options: { retries?: number; timeoutMs?: number; retryDelayMs?: number } = {}
): Promise<Response> {
    const { retries = 2, timeoutMs = UPLOAD_TIMEOUT_MS, retryDelayMs = 1000 } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(input, {
                ...init,
                signal: init.signal || controller.signal,
            });

            // 5xx 错误才重试；4xx 通常是客户端错误，立即返回让上层处理
            if (!res.ok && attempt < retries && res.status >= 500 && res.status < 600) {
                throw new Error(`Server returned ${res.status}`);
            }
            return res;
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            if (attempt < retries) {
                const delay = retryDelayMs * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error("Request failed after retries");
}
