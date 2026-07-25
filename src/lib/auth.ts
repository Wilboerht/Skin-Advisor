import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { cache } from 'react';
import prisma from '@/lib/prisma';
import { isDisabledUser, UserRole } from '@/lib/permissions';
import {
    AUTH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    getJwtSecret,
    signToken,
    signRefreshToken,
    verifyToken,
    verifyTokenDetailed,
    verifyRefreshToken,
    accessCookieOptions,
    refreshCookieOptions,
    type VerifyTokenResult,
    type TokenVerificationError,
} from '@/lib/auth-config';
import { generateCsrfToken, CSRF_COOKIE_NAME } from '@/lib/csrf';
import { verifyUserStatus } from '@/lib/user-sync';
import { logger } from '@/lib/logger';

export {
    AUTH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    getJwtSecret,
    signToken,
    signRefreshToken,
    verifyToken,
    verifyTokenDetailed,
    verifyRefreshToken,
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

export const getSession = cache(async (): Promise<SessionUser | null> => {
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
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    phoneNumber: true,
                    name: true,
                    role: true,
                    tokenVersion: true,
                    dailyTestLimit: true
                }
            });
            if (!dbUser || isDisabledUser(dbUser.role)) {
                return null;
            }
            const tokenVersion = payload.tokenVersion;
            if (typeof tokenVersion !== "number" || tokenVersion !== dbUser.tokenVersion) {
                return null;
            }

            const statusCheck = await verifyUserStatus(dbUser.id);
            if (!statusCheck.valid && statusCheck.officialStatus !== null) {
                try {
                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: {
                            role: UserRole.DISABLED,
                            tokenVersion: { increment: 1 },
                        },
                    });
                } catch (err) {
                    console.warn(`[auth] Failed to sync disabled status for user ${dbUser.id}:`, err);
                }
                return null;
            }

            if (statusCheck.officialUpdatedAt) {
                const officialTime = new Date(statusCheck.officialUpdatedAt).getTime();
                const jwtIat = (payload.iat as number) * 1000;
                if (!isNaN(officialTime) && officialTime > jwtIat) {
                    try {
                        await prisma.user.update({
                            where: { id: dbUser.id },
                            data: { tokenVersion: { increment: 1 } },
                        });
                    } catch (err) {
                        console.warn(`[auth] Failed to increment tokenVersion for user ${dbUser.id}:`, err);
                    }
                    return null;
                }
            }
            return {
                id: dbUser.id,
                email: dbUser.email,
                phone: dbUser.phoneNumber || undefined,
                name: dbUser.name || undefined,
                role: dbUser.role,
                tokenVersion: dbUser.tokenVersion,
                dailyTestLimit: dbUser.dailyTestLimit
            };
        }
        return null;
    }

    return null;
});

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

async function revokeAllRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

async function revokeSpecificRefreshToken(userId: string, token: string): Promise<number> {
    const tokenHash = hashToken(token);
    const result = await prisma.refreshToken.updateMany({
        where: { userId, token: tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    return result.count;
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
): Promise<void> {
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
        }, "15m");

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
    } catch (err) {
        logger.error("[auth] Failed to sign local session", { userId: user.id, error: err });
    }
}

/**
 * 刷新双 Token：验证 refresh token → 撤销旧 token → 签发新双 token
 */
export async function refreshSession(
    response: NextResponse,
    refreshTokenValue: string,
    options?: { secure?: boolean }
): Promise<SessionUser | null> {
    const secure = options?.secure ?? true;
    const tokenPrefix = refreshTokenValue.slice(0, 8);

    try {
        // 1. 验证 refresh token JWT 签名
        const jwtResult = await verifyTokenDetailed(refreshTokenValue);
        if (!jwtResult.payload) {
            logger.warn("[auth] Refresh token JWT verification failed", {
                tokenPrefix,
                error: jwtResult.error,
            });
            return null;
        }

        if (jwtResult.payload.type !== "refresh") {
            logger.warn("[auth] Refresh token type mismatch", {
                tokenPrefix,
                type: jwtResult.payload.type,
            });
            return null;
        }

        const userId = typeof jwtResult.payload.sub === 'string' ? jwtResult.payload.sub : null;
        if (!userId) {
            logger.warn("[auth] Refresh token missing subject", { tokenPrefix });
            return null;
        }

        // 2. 检查 DB 中是否存在且未被撤销
        const tokenHash = hashToken(refreshTokenValue);
        const dbToken = await prisma.refreshToken.findFirst({
            where: { userId, token: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        });
        if (!dbToken) {
            // Grace Period：检查是否是刚刚被撤销的 token（30 秒内）
            // 多标签页并发 refresh 时，第一个请求成功后撤销旧 token，
            // 后续请求在 grace period 内不应触发重用检测，而是正常返回用户信息。
            const GRACE_PERIOD_MS = 30_000;
            const graceCutoff = new Date(Date.now() - GRACE_PERIOD_MS);
            const recentlyRevoked = await prisma.refreshToken.findFirst({
                where: { userId, token: tokenHash, revokedAt: { gte: graceCutoff } },
            });
            if (recentlyRevoked) {
                // 在 grace period 内：为并发标签页签发新 token（第一个请求已完成轮转，此处为后续请求补发）
                logger.info("[auth] Refresh token within grace period, issuing tokens for concurrent tab", { userId, tokenPrefix });
                const dbUser = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, email: true, phoneNumber: true, name: true, role: true, tokenVersion: true, dailyTestLimit: true },
                });
                if (!dbUser || isDisabledUser(dbUser.role)) return null;
                // 签发新 token 对，确保此标签页也获得有效 Cookie
                await signLocalSession(response, {
                    id: dbUser.id,
                    email: dbUser.email,
                    phone: dbUser.phoneNumber,
                    name: dbUser.name,
                    role: dbUser.role,
                    tokenVersion: dbUser.tokenVersion,
                    dailyTestLimit: dbUser.dailyTestLimit,
                }, { secure });
                return {
                    id: dbUser.id,
                    email: dbUser.email,
                    phone: dbUser.phoneNumber || undefined,
                    name: dbUser.name || undefined,
                    role: dbUser.role,
                    tokenVersion: dbUser.tokenVersion,
                    dailyTestLimit: dbUser.dailyTestLimit,
                };
            }

            // refresh token 重用检测：JWT 有效但 DB 中不存在 → 可能被盗用，撤销所有 token
            logger.warn("[auth] Refresh token not found or revoked in DB", {
                userId,
                tokenHashPrefix: tokenHash.slice(0, 8),
            });
            await revokeAllRefreshTokens(userId);
            return null;
        }

        // 3. 检查用户状态
        const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, phoneNumber: true, name: true, role: true, tokenVersion: true, dailyTestLimit: true },
        });
        if (!dbUser || isDisabledUser(dbUser.role)) {
            logger.warn("[auth] User not found or disabled during refresh", {
                userId,
                role: dbUser?.role,
            });
            return null;
        }

        const tokenVersion = jwtResult.payload.tokenVersion;
        if (typeof tokenVersion !== "number" || tokenVersion !== dbUser.tokenVersion) {
            logger.warn("[auth] Refresh token version mismatch", {
                userId,
                jwtTokenVersion: tokenVersion,
                dbTokenVersion: dbUser.tokenVersion,
            });
            return null;
        }

        // 4. 签发新的双 token（先签发成功，再撤销旧 token，避免签发失败时用户被强制登出）
        await signLocalSession(response, {
            id: dbUser.id,
            email: dbUser.email,
            phone: dbUser.phoneNumber,
            name: dbUser.name,
            role: dbUser.role,
            tokenVersion: dbUser.tokenVersion,
            dailyTestLimit: dbUser.dailyTestLimit,
        }, { secure });

        // 5. 新 token 签发成功后，撤销旧的 refresh token
        await revokeSpecificRefreshToken(userId, refreshTokenValue);

        logger.info("[auth] Session refreshed successfully", { userId, tokenPrefix });

        return {
            id: dbUser.id,
            email: dbUser.email,
            phone: dbUser.phoneNumber || undefined,
            name: dbUser.name || undefined,
            role: dbUser.role,
            tokenVersion: dbUser.tokenVersion,
            dailyTestLimit: dbUser.dailyTestLimit,
        };
    } catch (err) {
        logger.error("[auth] Failed to refresh session", { tokenPrefix, error: err });
        return null;
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
