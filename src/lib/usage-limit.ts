
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, isVipCheck } from '@/lib/auth';
import { extractGuestIdentifiers } from './guest-limit';
import { withDbRetry } from './utils';
import { hashIP } from './privacy';

/**
 * 使用频率限制结果
 */
export interface UsageLimitResult {
    canTest: boolean;
    error?: string;
    remaining: number;
    resetTime?: Date;
    role: 'guest' | 'member' | 'vip';
}

/**
 * 检查用户或访客的测试频率限制
 * 
 * 规则：
 * 1. 访客：每日 3 次
 * 2. 普通注册用户：每日 10 次
 * 3. VIP 用户：每日 100 次
 */
export async function checkUsageLimit(request: NextRequest, body?: any): Promise<UsageLimitResult> {
    const user = await getSession();
    const now = new Date();

    // 统计进行中请求（5 分钟内启动但未完成的），防止并发重试导致超额
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // 1. 如果是 VIP 用户
    if (isVipCheck(user)) {
        const userId = user!.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = await withDbRetry(() =>
            prisma.testRecord.count({
                where: {
                    userId,
                    testDate: { gte: today }
                }
            })
        );

        const inProgressCount = await withDbRetry(() =>
            prisma.advisorSession.count({
                where: {
                    userId,
                    analysisStartedAt: { gte: fiveMinutesAgo },
                    completedAt: null
                }
            })
        );

        const totalCount = count + inProgressCount;

        // VIP 限制：每日 100 次
        const limit = 100;
        return {
            canTest: totalCount < limit,
            remaining: Math.max(0, limit - totalCount),
            role: 'vip',
            error: totalCount >= limit ? '您的 VIP 今日测试次数已用完，请明天再试。' : undefined
        };
    }

    // 2. 如果是普通注册用户
    if (user) {
        const userId = user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = await withDbRetry(() =>
            prisma.testRecord.count({
                where: {
                    userId,
                    testDate: { gte: today }
                }
            })
        );

        const inProgressCount = await withDbRetry(() =>
            prisma.advisorSession.count({
                where: {
                    userId,
                    analysisStartedAt: { gte: fiveMinutesAgo },
                    completedAt: null
                }
            })
        );

        const totalCount = count + inProgressCount;

        // 普通用户限制：每日 10 次
        const limit = 10;
        return {
            canTest: totalCount < limit,
            remaining: Math.max(0, limit - totalCount),
            role: 'member',
            error: totalCount >= limit ? '今日测试次数已用完，请明天再试。' : undefined
        };
    }

    // 3. 如果是访客 — 每日 3 次
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint } = identifiers;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 查询当天的测试次数
    const whereConditions: any[] = [{ ipAddress }];
    if (cookieId) whereConditions.push({ cookieId });
    if (fingerprint) whereConditions.push({ fingerprint });

    const todayCount = await withDbRetry(() =>
        prisma.guestUsage.findFirst({
            where: {
                OR: whereConditions,
                lastTestAt: { gte: today }
            },
            orderBy: { lastTestAt: 'desc' }
        })
    );

    const count = todayCount?.todayCount || 0;

    // 统计访客进行中的请求
    const inProgressCount = await withDbRetry(() =>
        prisma.advisorSession.count({
            where: {
                ip: hashIP(ipAddress),
                analysisStartedAt: { gte: fiveMinutesAgo },
                completedAt: null
            }
        })
    );

    const totalCount = count + inProgressCount;
    const limit = 3;

    if (totalCount >= limit) {
        return {
            canTest: false,
            remaining: 0,
            role: 'guest',
            error: '今日测试次数已用完，请明天再试。'
        };
    }

    return {
        canTest: true,
        remaining: Math.max(0, limit - totalCount),
        role: 'guest'
    };
}

/**
 * 记录一次测试行为
 * 
 * 幂等性保护：同一个 sessionId 只记录一次，防止超时重试导致重复扣额度
 */
export async function recordUsage(request: NextRequest, sessionId: string, body?: any) {
    // 幂等性检查：同一个 sessionId 只扣一次额度
    const existingRecord = await prisma.testRecord.findFirst({
        where: { sessionId }
    });
    if (existingRecord) {
        console.log(`[recordUsage] Session ${sessionId} already recorded, skipping duplicate.`);
        return;
    }

    const user = await getSession();
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint, userAgent } = identifiers;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. 创建 TestRecord (用于所有角色计数)
            await tx.testRecord.create({
                data: {
                    userId: user?.id || null,
                    guestId: !user ? (fingerprint || cookieId || ipAddress) : null,
                    sessionId,
                    testDate: new Date()
                }
            });

            // 2. 如果是访客，同时原子更新 GuestUsage
            if (!user) {
                const existing = await tx.guestUsage.findFirst({
                    where: {
                        OR: [
                            { ipAddress },
                            ...(fingerprint ? [{ fingerprint }] : []),
                            ...(cookieId ? [{ cookieId }] : [])
                        ]
                    }
                });

                const now = new Date();
                if (existing) {
                    const lastReset = existing.lastResetDate || existing.lastTestAt;
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const needsReset = !lastReset || lastReset < todayStart;

                    await tx.guestUsage.update({
                        where: { id: existing.id },
                        data: {
                            lastTestAt: now,
                            testCount: { increment: 1 },
                            todayCount: needsReset ? 1 : { increment: 1 },
                            lastResetDate: needsReset ? todayStart : undefined,
                            ipAddress,
                            cookieId: cookieId || existing.cookieId,
                            fingerprint: fingerprint || existing.fingerprint,
                            userAgent
                        }
                    });
                } else {
                    await tx.guestUsage.create({
                        data: {
                            ipAddress,
                            cookieId,
                            fingerprint,
                            userAgent,
                            lastTestAt: now,
                            testCount: 1,
                            todayCount: 1
                        }
                    });
                }
            }
        });
    } catch (e) {
        console.error('Failed to record usage:', e);
    }
}
