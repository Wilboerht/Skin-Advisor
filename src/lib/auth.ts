import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';
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
            if (!dbUser || isDisabledUser(dbUser.role)) {
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
