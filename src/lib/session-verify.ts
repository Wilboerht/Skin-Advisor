/**
 * 会话签名验证模块
 *
 * 兼容 Edge Runtime 和 Node.js Runtime。
 * 使用 Web Crypto API（crypto.subtle）进行 HMAC-SHA256 签名/验证，
 * 替代 Node.js 原生 crypto 模块，确保 middleware（Edge）和 API 路由（Node.js）
 * 使用完全一致的算法，避免维护两套独立实现导致的不一致风险。
 */

import { logger } from "@/lib/logger";

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * 服务端会话撤销集合
 * 管理员登出或密码修改时，记录撤销时间戳。
 * 所有在该时间戳之前创建的会话均被判定为无效。
 *
 * 设计：用 adminId → revocationTimestamp 映射替代复杂的 sessionId 匹配，
 * 天然支持"撤销该管理员所有会话"的语义。
 */
const revokedSessions = new Map<string, number>(); // adminId -> revokedAt timestamp
const MAX_REVOKED = 10000;

function cleanExpiredRevocations(): void {
    const cutoff = Date.now() - SESSION_MAX_AGE_MS;
    for (const [key, timestamp] of revokedSessions) {
        if (timestamp < cutoff) {
            revokedSessions.delete(key);
        }
    }
}

/**
 * Admin session cookie 名称
 * 生产环境使用 __Host- 前缀以强化 Cookie 安全（要求 Path=/、Secure、无 Domain）
 */
export const ADMIN_SESSION_COOKIE_NAME =
    process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";

function getSessionSecret(): string {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
        throw new Error(
            "🔴 CRITICAL: ADMIN_SESSION_SECRET is not set! " +
            "Admin sessions cannot be secured without this secret. " +
            "Set ADMIN_SESSION_SECRET in your environment variables."
        );
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
            logger.warn("[Security] Session cookie signature mismatch — possible tampering");
            return null;
        }

        // 检查会话是否已被服务端撤销
        // 若会话创建时间早于撤销时间，则该会话已失效
        const sessionIat = typeof parsed.iat === "number" ? parsed.iat : 0;
        const revokedAt = revokedSessions.get(parsed.adminId as string);
        if (revokedAt && sessionIat < revokedAt) {
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

/**
 * 撤销管理员的所有会话（登出/密码修改时调用）
 * 所有在此时间戳之前创建的会话均失效
 */
export function revokeAdminSessions(adminId: string): void {
    if (revokedSessions.size >= MAX_REVOKED) {
        cleanExpiredRevocations();
    }
    revokedSessions.set(adminId, Date.now());
}

/**
 * 恢复管理员的会话（解除撤销）
 */
export function unrevokeAdminSessions(adminId: string): void {
    revokedSessions.delete(adminId);
}
