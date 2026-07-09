import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isDisabledUser } from '@/lib/permissions';
import {
    AUTH_COOKIE_NAME,
    getJwtSecret,
    signToken,
    verifyToken,
    verifyTokenDetailed,
    type VerifyTokenResult,
    type TokenVerificationError,
} from '@/lib/auth-config';
import { generateCsrfToken, CSRF_COOKIE_NAME } from '@/lib/csrf';

export {
    AUTH_COOKIE_NAME,
    getJwtSecret,
    signToken,
    verifyToken,
    verifyTokenDetailed,
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
    tokenVersion: number; // 当前 token 版本，用于撤销
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
            // 查询数据库确认用户当前状态（禁用/删除/token 撤销检测）
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
            // JWT 撤销校验：token 版本必须匹配当前数据库版本
            const tokenVersion = payload.tokenVersion;
            if (typeof tokenVersion !== "number" || tokenVersion !== dbUser.tokenVersion) {
                return null;
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

/**
 * 递增指定用户的 tokenVersion，使该用户已签发的所有 JWT 立即失效。
 * 用于：修改密码、管理员禁用/启用用户、安全事件、显式登出等场景。
 */
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

/**
 * 签发子站本地 session（auth_token + csrf_token）。
 * 登录、注册、微信回调、微信绑定等成功后应立即调用，
 * 确保子站本地 API 能立即识别用户。
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
    const localCookieOptions = {
        httpOnly: true,
        secure,
        sameSite: "strict" as const,
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
    };
    const csrfCookieOptions = {
        httpOnly: false,
        secure,
        sameSite: "strict" as const,
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
    };


    try {
        const csrfToken = generateCsrfToken();
        const localToken = await signToken({
            sub: user.id,
            email: user.email ?? null,
            phone: user.phone ?? null,
            name: user.name,
            role: user.role,
            tokenVersion: user.tokenVersion,
            dailyTestLimit: user.dailyTestLimit ?? null,
            csrf: csrfToken,
        }, "7d");
        response.cookies.set(AUTH_COOKIE_NAME, localToken, localCookieOptions);
        response.cookies.set(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions);
    } catch (err) {
        console.error("[auth] Failed to sign local session:", err);
    }
}

/**
 * 清除子站本地 session Cookie。
 * 用于：登出、重置密码、安全事件等场景。
 */
export function clearLocalSession(response: NextResponse): void {
    response.cookies.delete(AUTH_COOKIE_NAME);
    response.cookies.delete(CSRF_COOKIE_NAME);
    response.cookies.delete("auth_token");
    response.cookies.delete("user_token");
}
