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
import { SSO_INSECURE_LOCAL_DEV } from '@/lib/sso-config';
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
    /** SSO 会员等级（REGULAR 普通/SILVER 银卡/GOLD 金卡/DIAMOND 钻石），null/未知视为普通；历史值 ADVANCED 按金卡兜底 */
    membershipLevel?: string | null;
    /** 主站累计消费金额（元），用于 SILVER 银卡测肤加赠 */
    totalSpent?: number | null;
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

        // Access token 30 分钟（原 2h）：配合主站 backchannel logout——本地 JWT
        // 无状态无法即时撤销，缩短 TTL 把远程登出/撤销授权后的失效窗口压到 ≤30min；
        // 过期后由 session-init / fetchWithCsrf 凭 SSO 会话静默重建，用户无感知。
        // refresh token（30d）不变。
        const accessToken = await signToken({
            sub: user.id,
            email: user.email ?? null,
            phone: user.phone ?? null,
            name: user.name,
            role: user.role,
            tokenVersion: user.tokenVersion,
            dailyTestLimit: user.dailyTestLimit ?? null,
            csrf: csrfToken,
        }, "30m");

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
 *
 * 不能用 response.cookies.delete()：其序列化结果不含 Secure 属性，
 * 而浏览器对 __Host- 前缀 Cookie 的删除指令同样强制校验前缀规则
 *（Secure + Path=/ + 无 Domain），缺 Secure 的删除会被静默拒绝，
 * 导致登出后本地 JWT 存活、被 /api/auth/me 的本地会话兜底"复活"登录态。
 * 删除属性必须与签发侧（signLocalSession）保持一致。
 */
export function clearLocalSession(response: NextResponse): void {
    const secure = !SSO_INSECURE_LOCAL_DEV;
    response.cookies.set(AUTH_COOKIE_NAME, "", { ...accessCookieOptions(secure), maxAge: 0 });
    response.cookies.set(AUTH_REFRESH_COOKIE_NAME, "", { ...refreshCookieOptions(secure), maxAge: 0 });
    response.cookies.set(CSRF_COOKIE_NAME, "", {
        httpOnly: false,
        secure,
        sameSite: "strict" as const,
        path: "/",
        maxAge: 0,
    });
}

/**
 * 撤销本地 refresh token（登出时调用）：按哈希标记 revokedAt。
 * 表保留记录供审计，由 data-cleanup 定时清除过期/已撤销数据。
 */
export async function revokeLocalRefreshToken(token: string): Promise<void> {
    try {
        await prisma.refreshToken.updateMany({
            where: { token: hashToken(token), revokedAt: null },
            data: { revokedAt: new Date() },
        });
    } catch (err) {
        // 尽力而为：撤销失败不阻断登出（Cookie 已清除，token 最长 30 天自然过期）
        logger.warn("[auth] Failed to revoke local refresh token", { error: String(err) });
    }
}

/**
 * 撤销某用户的全部本地 refresh token（backchannel logout 接收端调用）：
 * 主站全局登出/撤销授权时，本地各设备签发的 refresh token 需一并失效。
 * 返回撤销条数；失败抛错由调用方记录并让主站重投。
 */
export async function revokeAllLocalRefreshTokens(userId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    return result.count;
}
