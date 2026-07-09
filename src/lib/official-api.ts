import { createHmac, timingSafeEqual } from "crypto";

function getSignatureHeader(): string {
    return process.env.OFFICIAL_API_SIGNATURE_HEADER || "x-official-signature";
}

function getSecret(): string | undefined {
    return process.env.OFFICIAL_API_SECRET;
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
        console.error("[OfficialAPI] OFFICIAL_API_SECRET not configured in production, rejecting official response");
        return false;
    }

    if (!signature) {
        console.error("[OfficialAPI] Missing signature header from official API");
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
        console.error("[OfficialAPI] Official API returned non-JSON response", text.slice(0, 300));
        return null;
    }

    const rawBody = await officialResponse.text();
    let data: T;
    try {
        data = JSON.parse(rawBody) as T;
    } catch {
        console.error("[OfficialAPI] Official API JSON parse failed", rawBody.slice(0, 300));
        return null;
    }

    const signature = officialResponse.headers.get(getSignatureHeader());
    if (requireSignature && !verifyOfficialResponseSignature(rawBody, signature)) {
        console.error("[OfficialAPI] Signature verification failed for official response");
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${officialApiUrl}/api/auth/csrf`, {
            method: "GET",
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (!res.ok) {
            console.error("[OfficialAPI] Failed to fetch CSRF token from official API", res.status);
            return null;
        }

        const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        const csrfSetCookie = setCookies.find((c) => c.trim().startsWith(`${OFFICIAL_CSRF_COOKIE_NAME}=`));
        if (!csrfSetCookie) {
            console.error("[OfficialAPI] Official CSRF response missing __Host-csrf_token Set-Cookie");
            return null;
        }

        const match = csrfSetCookie.match(new RegExp(`${OFFICIAL_CSRF_COOKIE_NAME}=([^;]+)`));
        if (!match) {
            console.error("[OfficialAPI] Unable to parse __Host-csrf_token value");
            return null;
        }

        const raw = await res.json() as OfficialApiResponse<{ token: string }>;
        const token = raw.data?.token;
        if (!token) {
            console.error("[OfficialAPI] Official CSRF response missing token field");
            return null;
        }

        return { token, cookieValue: match[1] };
    } catch (error) {
        console.error("[OfficialAPI] Error fetching CSRF token:", error);
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
        requireSignature = false,
        timeoutMs = 30000,
    } = options;

    const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
    const url = `${officialApiUrl}${path}`;

    const isUnsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());

    let csrfToken: string | undefined;
    let csrfCookieValue: string | undefined;

    if (isUnsafeMethod) {
        const csrf = await getOfficialCsrfToken();
        if (!csrf) {
            console.error("[OfficialAPI] Cannot call unsafe official API without CSRF token", path);
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
        cookieParts.push(cookies);
    }
    if (cookieParts.length > 0) {
        headers.set("Cookie", cookieParts.join("; "));
    }

    if (userAgent) {
        headers.set("User-Agent", userAgent);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const officialResponse = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

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
        console.error("[OfficialAPI] callOfficialApi error:", error);
        return null;
    }
}
