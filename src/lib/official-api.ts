import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

function getSignatureHeader(): string {
    return process.env.OFFICIAL_API_SIGNATURE_HEADER || "x-official-signature";
}

function getSecret(): string | undefined {
    return process.env.OFFICIAL_API_SECRET;
}

/**
 * Node.js undici fetch 在容器化 / 生产环境中偶发 DNS 解析失败。
 * 使用指数退避重试 + 细化错误分类以提升可观测性。
 */
async function fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = 2,
    backoffMs = 300
): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const signal = init.signal
                ? AbortSignal.any([init.signal as AbortSignal, controller.signal])
                : controller.signal;

            const timeoutMs = (init as { _timeoutMs?: number })._timeoutMs ?? 30000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(url, { ...init, signal });
                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            lastError = error;
            const errMsg = error instanceof Error ? error.message : String(error);

            if (errMsg.includes("abort") || errMsg.includes("AbortError") || errMsg.includes("timeout")) {
                logger.error(`[OfficialAPI] Request timed out after ${(init as { _timeoutMs?: number })._timeoutMs ?? 30000}ms`, url);
                throw error; // 超时不重试
            }

            if (attempt < retries) {
                const delay = backoffMs * Math.pow(2, attempt);
                logger.warn(`[OfficialAPI] fetch failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms: ${errMsg}`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * 使用共享密钥对响应体进行 HMAC-SHA256 签名（十六进制）。
 * 此函数主要用于测试，实际签名由 nihplod.cn 服务端完成。
 */
export function signOfficialResponseBody(rawBody: string, secret = getSecret()): string | null {
    if (!secret) return null;
    return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * 校验官网 API 响应签名。
 *
 * 规则：
 * - 若未配置 OFFICIAL_API_SECRET，仅记录警告并返回 true（兼容旧部署）。
 * - 若已配置 secret 但响应缺少签名头，返回 false（拒绝不可信响应）。
 * - 若签名存在但校验失败，返回 false。
 */
export function verifyOfficialResponseSignature(
    rawBody: string,
    signature: string | null | undefined
): boolean {
    const secret = getSecret();
    if (!secret) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
            // 开发/测试环境未配置 secret 时允许通过，避免阻塞本地调试
            return true;
        }
        logger.error("[OfficialAPI] OFFICIAL_API_SECRET not configured in production, rejecting official response");
        return false;
    }

    if (!signature) {
        logger.error("[OfficialAPI] Missing signature header from official API");
        return false;
    }

    const expected = signOfficialResponseBody(rawBody, secret);
    if (!expected) return false;

    try {
        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expected, "hex");
        if (sigBuf.length !== expBuf.length) return false;
        return timingSafeEqual(sigBuf, expBuf);
    } catch {
        return false;
    }
}

export function getOfficialSignatureHeaderName(): string {
    return getSignatureHeader();
}

export interface OfficialResponse<T = unknown> {
    rawBody: string;
    data: T;
    signature: string | null;
}

export interface OfficialApiError {
    code?: string;
    message?: string;
}

export interface OfficialApiResponse<T = unknown> {
    success: boolean;
    error?: OfficialApiError;
    data?: T;
}

export interface ParseOfficialResponseOptions {
    /**
     * 是否要求响应必须包含有效签名。
     * 官网认证接口不返回 x-official-signature，应设为 false。
     */
    requireSignature?: boolean;
}

/**
 * 读取官网响应原始文本、校验签名并解析 JSON。
 * 若签名校验失败返回 null，调用方应视为上游不可信。
 */
export async function parseOfficialResponse<T = unknown>(
    officialResponse: Response,
    options: ParseOfficialResponseOptions = {}
): Promise<OfficialResponse<T> | null> {
    const { requireSignature = true } = options;
    const contentType = officialResponse.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const text = await officialResponse.text();
        logger.error("[OfficialAPI] Official API returned non-JSON response", text.slice(0, 300));
        return null;
    }

    const rawBody = await officialResponse.text();
    let data: T;
    try {
        data = JSON.parse(rawBody) as T;
    } catch {
        logger.error("[OfficialAPI] Official API JSON parse failed", rawBody.slice(0, 300));
        return null;
    }

    const signature = officialResponse.headers.get(getSignatureHeader());
    if (requireSignature && !verifyOfficialResponseSignature(rawBody, signature)) {
        logger.error("[OfficialAPI] Signature verification failed for official response");
        return null;
    }

    return { rawBody, data, signature };
}

// ============================================================
// 对齐官网 CSRF 与统一代理调用
// ============================================================

const OFFICIAL_CSRF_COOKIE_NAME = "__Host-csrf_token";
const OFFICIAL_CSRF_HEADER_NAME = "X-CSRF-Token";

export interface OfficialCsrfToken {
    token: string;
    cookieValue: string;
}

/**
 * 从官网获取 CSRF Token。
 * 官网会返回 Set-Cookie: __Host-csrf_token=...，我们在服务端把该 Cookie 值
 * 与 Token 一并返回，供后续写请求转发给官网使用。
 */
export async function getOfficialCsrfToken(): Promise<OfficialCsrfToken | null> {
    const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";

    try {
        const res = await fetchWithRetry(`${officialApiUrl}/api/auth/csrf`, {
            method: "GET",
            _timeoutMs: 15000,
        } as RequestInit & { _timeoutMs?: number });

        if (!res.ok) {
            logger.error("[OfficialAPI] Failed to fetch CSRF token from official API", res.status);
            return null;
        }

        const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        const csrfSetCookie = setCookies.find((c) => c.trim().startsWith(`${OFFICIAL_CSRF_COOKIE_NAME}=`));
        if (!csrfSetCookie) {
            logger.error("[OfficialAPI] Official CSRF response missing __Host-csrf_token Set-Cookie");
            return null;
        }

        const match = csrfSetCookie.match(new RegExp(`${OFFICIAL_CSRF_COOKIE_NAME}=([^;]+)`));
        if (!match) {
            logger.error("[OfficialAPI] Unable to parse __Host-csrf_token value");
            return null;
        }

        const raw = await res.json() as OfficialApiResponse<{ token: string }>;
        const token = raw.data?.token;
        if (!token) {
            logger.error("[OfficialAPI] Official CSRF response missing token field");
            return null;
        }

        return { token, cookieValue: match[1] };
    } catch (error) {
        logger.error("[OfficialAPI] Error fetching CSRF token:", error);
        return null;
    }
}

export interface CallOfficialApiOptions {
    method: string;
    path: string;
    body?: unknown;
    /**
     * 调用方已有的 Cookie 字符串（例如从浏览器请求中收集的 user_token 等）。
     */
    cookies?: string;
    /**
     * 是否需要转发 User-Agent（微信授权等场景需要）。
     */
    userAgent?: string | null;
    /**
     * 是否要求响应签名。官网认证接口不返回签名，应传 false。
     */
    requireSignature?: boolean;
    timeoutMs?: number;
    /**
     * 真实客户端 IP（由调用方通过 getClientIP 从入站请求获取）。
     * 仅在配置了 SUBSITE_PROXY_KEY 时，与 X-Subsite-Proxy-Key 一并转发给主站；
     * 主站校验密钥通过后才信任 X-Forwarded-For 用于限流与 SmsCode.ipAddress 记录。
     * 未配置密钥时不发送这两个头（主站也不会信任 XFF），其他出站调用一律不带密钥。
     */
    clientIp?: string;
}

export interface CallOfficialApiResult<T = unknown> {
    ok: boolean;
    status: number;
    data: T;
    rawBody: string;
    officialResponse: Response;
}

/**
 * 统一封装对官网 API 的调用。
 *
 * 处理以下对齐点：
 * 1. 写操作自动获取并转发官网 CSRF Token（Cookie + Header）。
 * 2. 透传已有 Cookie（如 user_token）。
 * 3. 可选透传 User-Agent。
 * 4. 对认证接口默认不校验响应签名（官网不返回）。
 */
export async function callOfficialApi<T = unknown>(
    options: CallOfficialApiOptions
): Promise<CallOfficialApiResult<T> | null> {
    const {
        method,
        path,
        body,
        cookies,
        userAgent,
        requireSignature = true,  // 默认要求签名，安全优先
        timeoutMs = 30000,
        clientIp,
    } = options;

    const officialApiUrl = process.env.OFFICIAL_API_URL || (() => {
        if (process.env.NODE_ENV === "production") {
            console.warn("[official-api] OFFICIAL_API_URL not set, using fallback https://nihplod.cn");
        }
        return "https://nihplod.cn";
    })();
    const url = `${officialApiUrl}${path}`;

    const isUnsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());

    let csrfToken: string | undefined;
    let csrfCookieValue: string | undefined;

    if (isUnsafeMethod) {
        const csrf = await getOfficialCsrfToken();
        if (!csrf) {
            logger.error("[OfficialAPI] Cannot call unsafe official API without CSRF token", path);
            return null;
        }
        csrfToken = csrf.token;
        csrfCookieValue = csrf.cookieValue;
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    if (csrfToken) {
        headers.set(OFFICIAL_CSRF_HEADER_NAME, csrfToken);
    }

    const cookieParts: string[] = [];
    if (csrfCookieValue) {
        cookieParts.push(`${OFFICIAL_CSRF_COOKIE_NAME}=${csrfCookieValue}`);
    }
    if (cookies) {
        // 过滤调用方 Cookie 中自带的 __Host-csrf_token：
        // 子站生产环境的 CSRF Cookie 与官网同名（见 csrf-client.ts），
        // 若不过滤会出现重复的 __Host-csrf_token 项（仅靠排列顺序侥幸让官网 token 生效），
        // 必须确保只发送刚获取的官网 token。
        const filteredCookies = cookies
            .split(";")
            .map((part) => part.trim())
            .filter((part) => part && !part.startsWith(`${OFFICIAL_CSRF_COOKIE_NAME}=`));
        if (filteredCookies.length > 0) {
            cookieParts.push(filteredCookies.join("; "));
        }
    }
    if (cookieParts.length > 0) {
        headers.set("Cookie", cookieParts.join("; "));
    }

    if (userAgent) {
        headers.set("User-Agent", userAgent);
    }

    // 子站→主站代理身份标识：仅在配置了共享密钥 SUBSITE_PROXY_KEY 且调用方
    // 提供了真实客户端 IP 时发送。主站校验 X-Subsite-Proxy-Key 通过后才信任
    // X-Forwarded-For（用于按真实客户端 IP 限流与记录 SmsCode.ipAddress）；
    // 未配置密钥时两个头都不发送，避免伪造的 XFF 被误信。
    const subsiteProxyKey = process.env.SUBSITE_PROXY_KEY;
    if (subsiteProxyKey && clientIp) {
        headers.set("X-Forwarded-For", clientIp);
        headers.set("X-Subsite-Proxy-Key", subsiteProxyKey);
    }

    try {
        const officialResponse = await fetchWithRetry(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            _timeoutMs: timeoutMs,
        } as RequestInit & { _timeoutMs?: number });

        const parsed = await parseOfficialResponse<T>(officialResponse, { requireSignature });
        if (!parsed) {
            return null;
        }

        return {
            ok: officialResponse.ok,
            status: officialResponse.status,
            data: parsed.data,
            rawBody: parsed.rawBody,
            officialResponse,
        };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const errName = error instanceof Error ? error.name : "Unknown";
        const cause = error instanceof Error && (error as Error & { cause?: unknown }).cause
            ? String((error as Error & { cause?: unknown }).cause)
            : "";

        logger.error("[OfficialAPI] callOfficialApi error:", {
            path,
            method,
            errorName: errName,
            errorMessage: errMsg,
            cause: cause || undefined,
            url: `${process.env.OFFICIAL_API_URL || "https://nihplod.cn"}${path}`,
        });

        if (errMsg.includes("ENOTFOUND") || errMsg.includes("EAI_AGAIN")) {
            logger.error("[OfficialAPI] DNS resolution failed for official API — check server DNS / network");
        } else if (errMsg.includes("ECONNREFUSED")) {
            logger.error("[OfficialAPI] Official API refused connection — target may be down");
        }

        return null;
    }
}
