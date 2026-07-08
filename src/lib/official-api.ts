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
        if (process.env.NODE_ENV === "development") {
            // 开发环境未配置 secret 时允许通过，避免阻塞本地调试
            return true;
        }
        console.warn("[OfficialAPI] OFFICIAL_API_SECRET not configured, skipping signature verification");
        return true;
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

/**
 * 读取官网响应原始文本、校验签名并解析 JSON。
 * 若签名校验失败返回 null，调用方应视为上游不可信。
 */
export async function parseOfficialResponse<T = unknown>(
    officialResponse: Response
): Promise<OfficialResponse<T> | null> {
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
    if (!verifyOfficialResponseSignature(rawBody, signature)) {
        console.error("[OfficialAPI] Signature verification failed for official response");
        return null;
    }

    return { rawBody, data, signature };
}
