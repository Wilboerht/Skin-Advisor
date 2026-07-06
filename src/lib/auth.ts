
import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

/**
 * C端认证 Cookie 名称
 * 生产环境使用 __Host- 前缀以强化 Cookie 安全（要求 Path=/、Secure、无 Domain）
 */
export const AUTH_COOKIE_NAME =
    process.env.NODE_ENV === "production" ? "__Host-auth_token" : "auth_token";

function getJwtSecret(): Uint8Array {
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

const JWT_SECRET = getJwtSecret();

export async function hashPassword(plain: string): Promise<string> {
    return hash(plain, 12);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
}

export async function signToken(payload: Record<string, unknown>, expiresIn: string | number = '7d'): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(JWT_SECRET);
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
        const { payload } = await jwtVerify(token, JWT_SECRET);
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

export interface SessionUser {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    dailyTestLimit?: number | null; // 每日测试次数限制，管理员可调整
}

export async function getSession(): Promise<SessionUser | null> {
    const cookieStore = await cookies();

    const tokenValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!tokenValue) {
        return null;
    }

    const payload = await verifyToken(tokenValue);
    if (payload) {
        const userId =
            typeof payload.sub === 'string' ? payload.sub :
            typeof payload.userId === 'string' ? payload.userId :
            null;
        if (userId) {
            // 查询数据库确认用户当前状态（禁用/删除检测）
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    phoneNumber: true,
                    name: true,
                    role: true,
                    dailyTestLimit: true
                }
            });
            if (!dbUser || dbUser.role === 'disabled') {
                return null;
            }
            return {
                id: dbUser.id,
                email: dbUser.email,
                phone: dbUser.phoneNumber || undefined,
                name: dbUser.name || undefined,
                role: dbUser.role,
                dailyTestLimit: dbUser.dailyTestLimit
            };
        }
        return null;
    }

    return null;
}


