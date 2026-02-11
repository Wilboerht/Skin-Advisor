
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, isVipCheck } from '@/lib/auth';
import { extractGuestIdentifiers } from './guest-limit';

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
 * 1. 访客：每周一次 (7天内只能测1次)
 * 2. 普通注册用户：每日一次
 * 3. VIP 用户：每日 5 次
 */
export async function checkUsageLimit(request: NextRequest, body?: any): Promise<UsageLimitResult> {
    const user = await getSession();
    const now = new Date();

    // 1. 如果是 VIP 用户
    if (isVipCheck(user)) {
        const userId = user!.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = await prisma.testRecord.count({
            where: {
                userId,
                testDate: { gte: today }
            }
        });

        // VIP 限制：每日 5 次
        const limit = 5;
        return {
            canTest: count < limit,
            remaining: Math.max(0, limit - count),
            role: 'vip',
            error: count >= limit ? '您的 VIP 今日测试次数（5次）已用完，请明天再试。' : undefined
        };
    }

    // 2. 如果是普通注册用户
    if (user) {
        const userId = user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = await prisma.testRecord.count({
            where: {
                userId,
                testDate: { gte: today }
            }
        });

        // 普通用户限制：每日 1 次
        const limit = 1;
        return {
            canTest: count < limit,
            remaining: Math.max(0, limit - count),
            role: 'member',
            error: count >= limit ? '普通会员每日仅限测试 1 次，升级 VIP 享受每日 5 次深度分析。' : undefined
        };
    }

    // 3. 如果是访客
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint } = identifiers;

    // 获取 7 天前的时间
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 查询 matching 记录，看过去 7 天是否有测试过
    const whereConditions: any[] = [{ ipAddress }];
    if (cookieId) whereConditions.push({ cookieId });
    if (fingerprint) whereConditions.push({ fingerprint });

    const recentTest = await prisma.guestUsage.findFirst({
        where: {
            OR: whereConditions,
            lastTestAt: { gte: sevenDaysAgo }
        },
        orderBy: { lastTestAt: 'desc' }
    });

    if (recentTest && recentTest.lastTestAt) {
        return {
            canTest: false,
            remaining: 0,
            role: 'guest',
            error: '游客模式每周仅限测试 1 次，注册登录后可享受每日测试权益。'
        };
    }

    return {
        canTest: true,
        remaining: 1,
        role: 'guest'
    };
}

/**
 * 记录一次测试行为
 */
export async function recordUsage(request: NextRequest, sessionId: string, body?: any) {
    const user = await getSession();
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint, userAgent } = identifiers;

    try {
        // 1. 创建 TestRecord (用于所有角色计数)
        await prisma.testRecord.create({
            data: {
                userId: user?.id || null,
                guestId: !user ? (fingerprint || cookieId || ipAddress) : null,
                sessionId,
                testDate: new Date()
            }
        });

        // 2. 如果是访客，同时更新 GuestUsage (用于访客识别)
        if (!user) {
            // 查找或创建
            const existing = await prisma.guestUsage.findFirst({
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
                await prisma.guestUsage.update({
                    where: { id: existing.id },
                    data: {
                        lastTestAt: now,
                        testCount: { increment: 1 },
                        todayCount: { increment: 1 },
                        ipAddress,
                        cookieId: cookieId || existing.cookieId,
                        fingerprint: fingerprint || existing.fingerprint,
                        userAgent
                    }
                });
            } else {
                await prisma.guestUsage.create({
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
    } catch (e) {
        console.error('Failed to record usage:', e);
    }
}
