import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
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
    } catch (err) {
        console.error("[auth] Failed to sign local session:", err);
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

    try {
        // 1. 验证 refresh token JWT 签名
        const payload = await verifyRefreshToken(refreshTokenValue);
        if (!payload) return null;

        const userId = typeof payload.sub === 'string' ? payload.sub : null;
        if (!userId) return null;

        // 2. 检查 DB 中是否存在且未被撤销
        const tokenHash = hashToken(refreshTokenValue);
        const dbToken = await prisma.refreshToken.findFirst({
            where: { userId, token: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        });
        if (!dbToken) {
            // refresh token 重用检测：JWT 有效但 DB 中不存在 → 可能被盗用，撤销所有 token
            await revokeAllRefreshTokens(userId);
            return null;
        }

        // 3. 检查用户状态
        const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, phoneNumber: true, name: true, role: true, tokenVersion: true, dailyTestLimit: true },
        });
        if (!dbUser || isDisabledUser(dbUser.role)) return null;

        const tokenVersion = payload.tokenVersion;
        if (typeof tokenVersion !== "number" || tokenVersion !== dbUser.tokenVersion) return null;

        // 4. 撤销旧的 refresh token
        await revokeSpecificRefreshToken(userId, refreshTokenValue);

        // 5. 签发新的双 token
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
    } catch (err) {
        console.error("[auth] Failed to refresh session:", err);
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
    response.cookies.delete("auth_token");
    response.cookies.delete("user_token");
}
