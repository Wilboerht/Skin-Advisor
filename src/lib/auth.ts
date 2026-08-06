import { compare, hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import {
    AUTH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    getJwtSecret,
    signToken,
    signRefreshToken,
    verifyToken,
    verifyTokenDetailed,
    accessCookieOptions,
    refreshCookieOptions,
    type VerifyTokenResult,
    type TokenVerificationError,
} from '@/lib/auth-config';
import { generateCsrfToken, CSRF_COOKIE_NAME } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export {
    AUTH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    getJwtSecret,
    signToken,
    signRefreshToken,
    verifyToken,
    verifyTokenDetailed,
    accessCookieOptions,
    refreshCookieOptions,
    type VerifyTokenResult,
    type TokenVerificationError,
};

export async function hashPassword(plain: string): Promise<string> {
    return hash(plain, 12);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
}

export interface SessionUser {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    tokenVersion: number;
    dailyTestLimit?: number | null;
}

export async function incrementTokenVersion(userId: string): Promise<number | null> {
    try {
        const updated = await prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } },
            select: { tokenVersion: true }
        });
        return updated.tokenVersion;
    } catch (error) {
        console.error(`[auth] Failed to increment tokenVersion for user ${userId}:`, error);
        return null;
    }
}

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

async function saveRefreshTokenToDb(userId: string, token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
        data: { userId, token: tokenHash, expiresAt },
    });
}

/**
 * 签发子站本地双 Token session（access + refresh + csrf）。
 */
export async function signLocalSession(
    response: NextResponse,
    user: {
        id: string;
        email?: string | null;
        phone?: string | null;
        name?: string | null;
        role: string;
        tokenVersion: number;
        dailyTestLimit?: number | null;
    },
    options?: { secure?: boolean }
): Promise<boolean> {
    const secure = options?.secure ?? true;

    try {
        const csrfToken = generateCsrfToken();

        const accessToken = await signToken({
            sub: user.id,
            email: user.email ?? null,
            phone: user.phone ?? null,
            name: user.name,
            role: user.role,
            tokenVersion: user.tokenVersion,
            dailyTestLimit: user.dailyTestLimit ?? null,
            csrf: csrfToken,
        }, "1h");

        const refreshToken = await signRefreshToken({
            sub: user.id,
            tokenVersion: user.tokenVersion,
        });

        // 持久化 refresh token 哈希到数据库
        await saveRefreshTokenToDb(user.id, refreshToken);

        response.cookies.set(AUTH_COOKIE_NAME, accessToken, accessCookieOptions(secure));
        response.cookies.set(AUTH_REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(secure));
        response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
            httpOnly: false,
            secure,
            sameSite: "strict" as const,
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
        });

        logger.info("[auth] Local session signed", {
            userId: user.id,
            authCookieName: AUTH_COOKIE_NAME,
            refreshCookieName: AUTH_REFRESH_COOKIE_NAME,
            csrfCookieName: CSRF_COOKIE_NAME,
            secure,
        });
        return true;
    } catch (err) {
        logger.error("[auth] Failed to sign local session", { userId: user.id, error: err });
        return false;
    }
}

/**
 * 清除子站本地 session Cookie（双 token + CSRF）。
 */
export function clearLocalSession(response: NextResponse): void {
    response.cookies.delete(AUTH_COOKIE_NAME);
    response.cookies.delete(AUTH_REFRESH_COOKIE_NAME);
    response.cookies.delete(CSRF_COOKIE_NAME);
}
