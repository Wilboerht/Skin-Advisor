/**
 * 带 CSRF token 的客户端 fetch 封装
 *
 * 自动从 document.cookie 读取 csrf_token 并加入 X-CSRF-Token header。
 * 用于所有会触发 C 端状态变更的请求（POST/PUT/PATCH/DELETE）。
 * 默认 30 秒超时，防止网络挂起导致 UI 永久等待。
 *
 * SSO 迁移说明：
 * - SSO token 存于 httpOnly Cookie；access_token 过期由 /api/auth/me 用
 *   refresh_token 静默轮换（UserProvider 挂载、定时续期及 refresh() 时触发）。
 * - 写操作收到 401（本地 JWT 1h 过期 / CSRF 校验失败）时，自动调
 *   /api/auth/session-init?json=1 静默重建本地会话并重试一次；
 *   session-init 内部会在 SSO access token 过期时用 refresh token 轮换。
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

/**
 * 本地会话重建：本地 JWT 过期（1h）后 CSRF 校验会返回 401，
 * 此时若 SSO 会话仍有效（必要时用 refresh token 轮换），session-init 会
 * 重新签发本地双 token + CSRF cookie。
 *
 * 成功判定依赖 json=1 模式返回的 { ok: true }——本地 auth_token 是
 * httpOnly Cookie，document.cookie 读不到，不能用它判断重建结果。
 *
 * 单飞：并发 401 的多个写请求共享同一次重建，避免重复打 session-init
 * 触发其 10 次/分钟/IP 限流，也避免并发签发导致 CSRF cookie 互相覆盖。
 */
let rebuildInflight: Promise<boolean> | null = null;

function rebuildLocalSession(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (rebuildInflight) return rebuildInflight;

    rebuildInflight = (async () => {
        try {
            const res = await fetch(
                `/api/auth/session-init?json=1&return_to=${encodeURIComponent(window.location.pathname)}`,
                { redirect: "manual" }
            );
            if (!res.ok) return false;
            const data = (await res.json()) as { ok?: boolean };
            return data?.ok === true;
        } catch {
            return false;
        } finally {
            rebuildInflight = null;
        }
    })();
    return rebuildInflight;
}

export async function fetchWithCsrf(
    input: RequestInfo | URL,
    init: RequestInit = {},
    options: { retries?: number; timeoutMs?: number; _sessionRebuilt?: boolean } = {}
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

            // 写操作 401：本地 JWT 可能已过期，静默重建本地会话后重试一次
            if (
                res.status === 401 &&
                unsafeMethods.includes(method) &&
                !options._sessionRebuilt
            ) {
                const rebuilt = await rebuildLocalSession();
                if (rebuilt) {
                    return fetchWithCsrf(input, init, { ...options, _sessionRebuilt: true });
                }
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
