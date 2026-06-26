/**
 * 会话签名验证模块
 *
 * 兼容 Edge Runtime 和 Node.js Runtime。
 * 使用 Web Crypto API（crypto.subtle）进行 HMAC-SHA256 签名/验证，
 * 替代 Node.js 原生 crypto 模块，确保 middleware（Edge）和 API 路由（Node.js）
 * 使用完全一致的算法，避免维护两套独立实现导致的不一致风险。
 */

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * Admin session cookie 名称
 * 生产环境使用 __Host- 前缀以强化 Cookie 安全（要求 Path=/、Secure、无 Domain）
 */
export const ADMIN_SESSION_COOKIE_NAME =
    process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";

function getSessionSecret(): string {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV !== "development") {
            throw new Error(
                "🔴 CRITICAL: ADMIN_SESSION_SECRET is not set! " +
                "Refusing to use a fallback secret in non-development environment. " +
                "Set ADMIN_SESSION_SECRET in your environment variables."
            );
        }
        console.warn(
            "⚠️  ADMIN_SESSION_SECRET not set — using development fallback. Do NOT use in production."
        );
        return "dev-admin-session-secret-change-me";
    }
    return secret;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

/**
 * Sign session payload with HMAC-SHA256
 */
export async function signSessionData(data: string): Promise<string> {
    const key = await importHmacKey(getSessionSecret());
    const encoder = new TextEncoder();
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return Array.from(new Uint8Array(sigBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Verify HMAC signature of session cookie value.
 * Returns parsed session payload if valid, null otherwise.
 *
 * Uses Web Crypto subtle.verify() which provides built-in constant-time comparison,
 * preventing timing attacks.
 */
export async function verifySessionSignature(
    signedValue: string
): Promise<Record<string, unknown> | null> {
    try {
        const separatorIndex = signedValue.lastIndexOf(".");
        if (separatorIndex === -1) {
            return null;
        }

        const data = signedValue.substring(0, separatorIndex);
        const signature = signedValue.substring(separatorIndex + 1);

        // Validate payload structure and expiration
        const parsed = JSON.parse(data);
        if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) {
            return null;
        }
        if (!parsed.adminId || typeof parsed.adminId !== "string") {
            return null;
        }

        // Convert hex signature to Uint8Array
        if (signature.length % 2 !== 0) {
            return null;
        }
        const sigBytes = new Uint8Array(signature.length / 2);
        for (let i = 0; i < signature.length; i += 2) {
            const byte = parseInt(signature.substring(i, i + 2), 16);
            if (Number.isNaN(byte)) {
                return null;
            }
            sigBytes[i / 2] = byte;
        }

        // Verify HMAC using Web Crypto (timing-safe)
        const key = await importHmacKey(getSessionSecret());
        const encoder = new TextEncoder();
        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            sigBytes,
            encoder.encode(data)
        );

        if (!valid) {
            console.warn("[Security] Session cookie signature mismatch — possible tampering");
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Create a signed session cookie value
 */
export async function createSignedSession(
    sessionData: Omit<Record<string, unknown>, "iat" | "exp"> & {
        adminId: string;
        username: string;
        role: string;
    }
): Promise<string> {
    const now = Date.now();
    const payload = {
        ...sessionData,
        iat: now,
        exp: now + SESSION_MAX_AGE_MS,
    };
    const data = JSON.stringify(payload);
    const signature = await signSessionData(data);
    return `${data}.${signature}`;
}
