import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { hashIP } from '@/lib/privacy';
import { getClientIP } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

// 游客身份标识
export interface GuestIdentifiers {
    ipAddress: string;  // Always hashed — never stores raw IP
    cookieId: string | null;
    fingerprint: string | null;
    userAgent: string | null;
}

// 游客限制检查逻辑已迁移至 usage-limit.ts（checkUsageLimit/reserveUsage），
// 本文件仅保留游客身份提取与封禁/解封能力。

/**
 * 从请求中提取游客标识
 * Note: IP address is hashed before returning for privacy compliance.
 */
export function extractGuestIdentifiers(request: NextRequest, body?: {
    cookieId?: string;
    fingerprint?: string;
    guestId?: string;
}): GuestIdentifiers {
    // 获取客户端 IP（已处理可信代理与 X-Real-IP 优先级）
    const rawIp = getClientIP(request);

    // Hash the IP for privacy — raw IP is never stored or returned
    const ipAddress = hashIP(rawIp);

    // 获取其他标识
    const userAgent = request.headers.get('user-agent');
    const cookieId = body?.cookieId || request.headers.get('x-guest-cookie-id');
    const fingerprint = body?.fingerprint || body?.guestId || request.headers.get('x-fingerprint');

    return {
        ipAddress,
        cookieId,
        fingerprint,
        userAgent
    };
}

/**
 * 封禁游客
 */
export async function blockGuest(
    identifiers: Partial<GuestIdentifiers>,
    reason: string
): Promise<boolean> {
    try {
        const whereConditions = [];

        if (identifiers.ipAddress) {
            whereConditions.push({ ipAddress: identifiers.ipAddress });
        }
        if (identifiers.fingerprint) {
            whereConditions.push({ fingerprint: identifiers.fingerprint });
        }
        if (identifiers.cookieId) {
            whereConditions.push({ cookieId: identifiers.cookieId });
        }

        if (whereConditions.length === 0) return false;

        await prisma.guestUsage.updateMany({
            where: { OR: whereConditions },
            data: {
                isBlocked: true,
                blockedReason: reason,
                blockedAt: new Date()
            }
        });

        return true;
    } catch (error) {
        logger.error('Failed to block guest:', error);
        return false;
    }
}

/**
 * 解封游客
 */
export async function unblockGuest(
    identifiers: Partial<GuestIdentifiers>
): Promise<boolean> {
    try {
        const whereConditions = [];

        if (identifiers.ipAddress) {
            whereConditions.push({ ipAddress: identifiers.ipAddress });
        }
        if (identifiers.fingerprint) {
            whereConditions.push({ fingerprint: identifiers.fingerprint });
        }
        if (identifiers.cookieId) {
            whereConditions.push({ cookieId: identifiers.cookieId });
        }

        if (whereConditions.length === 0) return false;

        await prisma.guestUsage.updateMany({
            where: { OR: whereConditions },
            data: {
                isBlocked: false,
                blockedReason: null,
                blockedAt: null
            }
        });

        return true;
    } catch (error) {
        logger.error('Failed to unblock guest:', error);
        return false;
    }
}
