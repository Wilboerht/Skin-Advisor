import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { hashIP } from '@/lib/privacy';
import { getClientIP } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

// 默认游客每日测试次数限制
export const DEFAULT_GUEST_LIMIT = 3;

// 游客身份标识
export interface GuestIdentifiers {
    ipAddress: string;  // Always hashed — never stores raw IP
    cookieId: string | null;
    fingerprint: string | null;
    userAgent: string | null;
}

// 游客限制检查结果
export interface GuestLimitCheckResult {
    canTest: boolean;
    usedCount: number;
    dailyLimit: number;
    remaining: number;
    isBlocked: boolean;
    blockReason: string | null;
    matchedBy: 'ip' | 'cookie' | 'fingerprint' | 'combined' | 'none';
    confidenceScore: number; // 0-100 置信度
}

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
 * 检查游客是否可以测试
 * 使用多维度标识进行去重和限流
 */
export async function checkGuestLimit(
    identifiers: GuestIdentifiers
): Promise<GuestLimitCheckResult> {
    const { ipAddress, cookieId, fingerprint } = identifiers;

    // 获取今天的日期边界
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 查询匹配的游客记录
    const whereConditions = [];

    // IP 匹配 (最基础)
    whereConditions.push({ ipAddress });

    // Cookie 匹配 (中等可靠)
    if (cookieId) {
        whereConditions.push({ cookieId });
    }

    // 指纹匹配 (最可靠)
    if (fingerprint) {
        whereConditions.push({ fingerprint });
    }

    // 查询所有可能匹配的记录（限制返回数量防止滥用）
    const matchedRecords = await prisma.guestUsage.findMany({
        where: { OR: whereConditions },
        orderBy: { todayCount: 'desc' }, // 优先取使用次数最多的
        take: 50
    });

    // 如果没有任何记录，说明是新访客
    if (matchedRecords.length === 0) {
        return {
            canTest: true,
            usedCount: 0,
            dailyLimit: DEFAULT_GUEST_LIMIT,
            remaining: DEFAULT_GUEST_LIMIT,
            isBlocked: false,
            blockReason: null,
            matchedBy: 'none',
            confidenceScore: 0
        };
    }

    // 分析匹配结果
    let primaryRecord = matchedRecords[0];
    let matchedBy: 'ip' | 'cookie' | 'fingerprint' | 'combined' = 'ip';
    let confidenceScore = 30; // IP 匹配基础分

    // 寻找最佳匹配
    for (const record of matchedRecords) {
        let score = 0;

        if (record.ipAddress === ipAddress) score += 30;
        if (cookieId && record.cookieId === cookieId) score += 35;
        if (fingerprint && record.fingerprint === fingerprint) score += 50;

        if (score > confidenceScore) {
            confidenceScore = Math.min(100, score);
            primaryRecord = record;

            // 确定匹配类型
            if (fingerprint && record.fingerprint === fingerprint) {
                matchedBy = 'fingerprint';
            } else if (cookieId && record.cookieId === cookieId) {
                matchedBy = 'cookie';
            } else if (score > 50) {
                matchedBy = 'combined';
            }
        }
    }

    // 检查是否被封禁
    if (primaryRecord.isBlocked) {
        return {
            canTest: false,
            usedCount: primaryRecord.todayCount,
            dailyLimit: DEFAULT_GUEST_LIMIT,
            remaining: 0,
            isBlocked: true,
            blockReason: primaryRecord.blockedReason,
            matchedBy,
            confidenceScore
        };
    }

    // 检查是否需要重置今日计数（跨天）
    let todayCount = primaryRecord.todayCount;
    // 安全处理 lastResetDate 为 null 的边界情况（理论上 schema 有 default，但防御性编码）
    const rawLastReset = primaryRecord.lastResetDate || primaryRecord.lastTestAt;
    if (!rawLastReset) {
        todayCount = 0; // 安全重置：无历史记录时视为需要重置
    } else {
        const lastReset = new Date(rawLastReset);
        lastReset.setHours(0, 0, 0, 0);
        if (lastReset < today) {
            // 需要重置
            todayCount = 0;
        }
    }

    const canTest = todayCount < DEFAULT_GUEST_LIMIT;

    return {
        canTest,
        usedCount: todayCount,
        dailyLimit: DEFAULT_GUEST_LIMIT,
        remaining: Math.max(0, DEFAULT_GUEST_LIMIT - todayCount),
        isBlocked: false,
        blockReason: null,
        matchedBy,
        confidenceScore
    };
}

/**
 * 解析 User-Agent (已废弃，保留供 checkGuestLimit 内部使用)
 */
function parseUserAgent(userAgent: string | null): {
    deviceType: string | null;
    browser: string | null;
    os: string | null;
} {
    if (!userAgent) {
        return { deviceType: null, browser: null, os: null };
    }

    const ua = userAgent.toLowerCase();

    // 检测设备类型
    let deviceType = 'desktop';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        deviceType = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(userAgent)) {
        deviceType = 'mobile';
    }

    // 检测浏览器
    let browser = 'unknown';
    if (ua.includes('firefox')) browser = 'firefox';
    else if (ua.includes('edg')) browser = 'edge';
    else if (ua.includes('chrome')) browser = 'chrome';
    else if (ua.includes('safari')) browser = 'safari';
    else if (ua.includes('opera') || ua.includes('opr')) browser = 'opera';

    // 检测操作系统
    let os = 'unknown';
    if (ua.includes('win')) os = 'windows';
    else if (ua.includes('mac')) os = 'macos';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'ios';

    return { deviceType, browser, os };
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
