/**
 * 纯密码学/配置层认证工具
 *
 * 注意：此文件不能依赖 next/headers、prisma 等 Node-only 模块，
 * 因为它会被 Edge Middleware 和客户端代码间接引用。
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * C端认证 Cookie 名称
 * 生产环境使用 __Host- 前缀以强化 Cookie 安全（要求 Path=/、Secure、无 Domain）
 */
export const AUTH_COOKIE_NAME =
    process.env.NODE_ENV === "production" ? "__Host-auth_token" : "auth_token";

export function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
        if (process.env.NODE_ENV !== 'development') {
            throw new Error(
                '🔴 CRITICAL: JWT_SECRET environment variable is not set. ' +
                'Refusing to start without a proper secret in non-development environment. ' +
                'Set JWT_SECRET in your environment variables.'
            );
        }
        console.warn('⚠️  JWT_SECRET not set — using development fallback. Do NOT use in production.');
    }
    return new TextEncoder().encode(secret!);
}

export async function signToken(payload: Record<string, unknown>, expiresIn: string | number = '7d'): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(getJwtSecret());
}

export type TokenVerificationError = 'expired' | 'invalid_signature' | 'malformed' | 'unknown';

export interface VerifyTokenResult {
    payload: JWTPayload | null;
    error?: TokenVerificationError;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    const result = await verifyTokenDetailed(token);
    return result.payload;
}

export async function verifyTokenDetailed(token: string): Promise<VerifyTokenResult> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        return { payload };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        let error: TokenVerificationError = 'unknown';
        if (err?.code === 'ERR_JWT_EXPIRED') {
            error = 'expired';
        } else if (err?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
            error = 'invalid_signature';
        } else if (err?.code === 'ERR_JWT_MALFORMED' || err?.code === 'ERR_JWS_INVALID') {
            error = 'malformed';
        }
        // 安全日志：记录签名错误以便审计（不记录完整 token）
        if (error === 'invalid_signature' || error === 'malformed') {
            console.warn(`[Security] JWT ${error}: ${token.substring(0, 10)}...`);
        }
        return { payload: null, error };
    }
}
