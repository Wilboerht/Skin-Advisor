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

export const AUTH_REFRESH_COOKIE_NAME =
    process.env.NODE_ENV === "production" ? "__Host-auth_refresh_token" : "auth_refresh_token";

export function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
        throw new Error(
            '🔴 CRITICAL: JWT_SECRET environment variable is not set. ' +
            'Set JWT_SECRET in your environment variables.'
        );
    }
    return new TextEncoder().encode(secret);
}

function getJwtIssuer(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://advisor.nihplod.cn";
}

/**
 * 签发 Access Token（短期，15 分钟）
 */
export async function signToken(payload: Record<string, unknown>, expiresIn: string | number = "15m"): Promise<string> {
    const token = new SignJWT({ ...payload, type: "access" })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(getJwtIssuer())
        .setAudience("advisor-api")
        .setIssuedAt()
        .setExpirationTime(expiresIn);
    return token.sign(getJwtSecret());
}

/**
 * 签发 Refresh Token（长期，30 天）
 */
export async function signRefreshToken(payload: Record<string, unknown>): Promise<string> {
    const token = new SignJWT({ ...payload, type: "refresh" })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(getJwtIssuer())
        .setAudience("advisor-api")
        .setIssuedAt()
        .setExpirationTime("30d");
    return token.sign(getJwtSecret());
}

export type TokenVerificationError = 'expired' | 'invalid_signature' | 'malformed' | 'unknown' | 'wrong_type';

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
        const { payload } = await jwtVerify(token, getJwtSecret(), {
            issuer: getJwtIssuer(),
            audience: "advisor-api",
        });
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
        if (error === 'invalid_signature' || error === 'malformed') {
            console.warn(`[Security] JWT ${error}: ${token.substring(0, 10)}...`);
        }
        return { payload: null, error };
    }
}

/**
 * 验证 Refresh Token（仅接受 type="refresh" 的 token）
 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
    const result = await verifyTokenDetailed(token);
    if (!result.payload) return null;
    if (result.payload.type !== "refresh") return null;
    return result.payload;
}

/**
 * Access Token Cookie 配置（15 分钟）
 */
export function accessCookieOptions(secure: boolean = true) {
    return {
        httpOnly: true,
        secure,
        sameSite: "strict" as const,
        path: "/",
        maxAge: 15 * 60,
    };
}

/**
 * Refresh Token Cookie 配置（30 天）
 */
export function refreshCookieOptions(secure: boolean = true) {
    return {
        httpOnly: true,
        secure,
        sameSite: "strict" as const,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
    };
}
