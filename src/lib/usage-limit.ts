
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getSession, isVipCheck } from '@/lib/auth';
import { extractGuestIdentifiers } from './guest-limit';
import { withDbRetry } from './utils';

/**
 * 使用频率限制结果
 */
export interface UsageLimitResult {
    canTest: boolean;
    error?: string;
    remaining: number;
    dailyLimit: number;
    resetTime?: Date;
    role: 'guest' | 'member' | 'vip';
}

/**
 * 原子性预占额度结果
 */
export interface ReserveUsageResult {
    success: boolean;
    error?: string;
    role: 'guest' | 'member' | 'vip';
}

/**
 * 获取用户或访客的每日测试限制
 */
function getUserDailyLimit(user: { dailyTestLimit?: number | null } | null | undefined, isVip: boolean): number {
    if (isVip) return 100;
    // dailyTestLimit 为 null/undefined 时回退到系统默认 10 次；
    // 显式设置为 0-1 均视为有效自定义值（0 表示禁用测试）。
    if (user && typeof user.dailyTestLimit === 'number') {
        return Math.max(0, user.dailyTestLimit);
    }
    return 10;
}

/**
 * 检查用户或访客的测试频率限制（快速前置检查，不扣费）
 *
 * 规则：
 * 1. 访客：每日 3 次
 * 2. 普通注册用户：每日 10 次（管理员可通过 dailyTestLimit 调整）
 * 3. VIP 用户：每日 100 次
 */
export async function checkUsageLimit(request: NextRequest, body?: Record<string, unknown>): Promise<UsageLimitResult> {
    const user = await getSession();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. 如果是 VIP 用户
    if (isVipCheck(user)) {
        const userId = user!.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [count, inProgressCount] = await Promise.all([
            withDbRetry(() =>
                prisma.testRecord.count({
                    where: { userId, testDate: { gte: today } }
                })
            ),
            withDbRetry(() =>
                prisma.advisorSession.count({
                    where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null }
                })
            )
        ]);

        const totalCount = count + inProgressCount;
        const limit = 100;
        return {
            canTest: totalCount < limit,
            remaining: Math.max(0, limit - totalCount),
            dailyLimit: limit,
            role: 'vip',
            error: totalCount >= limit ? '您的 VIP 今日测试次数已用完，请明天再试。' : undefined
        };
    }

    // 2. 如果是普通注册用户
    if (user) {
        const userId = user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [count, inProgressCount] = await Promise.all([
            withDbRetry(() =>
                prisma.testRecord.count({
                    where: { userId, testDate: { gte: today } }
                })
            ),
            withDbRetry(() =>
                prisma.advisorSession.count({
                    where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null }
                })
            )
        ]);

        const totalCount = count + inProgressCount;
        // getSession() 已返回最新的 dailyTestLimit（每次调用都查数据库确认状态）
        const limit = getUserDailyLimit(user, isVipCheck(user));
        return {
            canTest: totalCount < limit,
            remaining: Math.max(0, limit - totalCount),
            dailyLimit: limit,
            role: isVipCheck(user) ? 'vip' : 'member',
            error: totalCount >= limit ? '今日测试次数已用完，请明天再试。' : undefined
        };
    }

    // 3. 如果是访客 — 每日 3 次
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint } = identifiers;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereConditions: Prisma.GuestUsageWhereInput[] = [{ ipAddress }];
    if (cookieId) whereConditions.push({ cookieId });
    if (fingerprint) whereConditions.push({ fingerprint });

    const todayCount = await withDbRetry(() =>
        prisma.guestUsage.findFirst({
            where: { OR: whereConditions, lastTestAt: { gte: today } },
            orderBy: { todayCount: 'desc' }
        })
    );

    const count = todayCount?.todayCount || 0;

    const blockedRecord = await withDbRetry(() =>
        prisma.guestUsage.findFirst({
            where: { OR: whereConditions, isBlocked: true }
        })
    );
    if (blockedRecord) {
        return {
            canTest: false,
            remaining: 0,
            dailyLimit: 3,
            role: 'guest',
            error: blockedRecord.blockedReason || '您的访问已被限制，请联系客服。'
        };
    }

    const inProgressCount = await withDbRetry(() =>
        prisma.advisorSession.count({
            where: { ip: ipAddress, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null }
        })
    );

    const totalCount = count + inProgressCount;
    const limit = 3;

    if (totalCount >= limit) {
        return {
            canTest: false,
            remaining: 0,
            dailyLimit: limit,
            role: 'guest',
            error: '今日测试次数已用完，请明天再试。'
        };
    }

    return {
        canTest: true,
        remaining: Math.max(0, limit - totalCount),
        dailyLimit: limit,
        role: 'guest'
    };
}

/**
 * 原子性预占额度：在数据库事务内检查限制并创建使用记录
 *
 * 最佳实践：在 AI 分析前调用，防止"结果已出但额度未扣"的 TOCTOU 竞态窗口。
 * 如果分析最终失败，预占的额度不自动释放（服务器资源已消耗）。
 *
 * @returns ReserveUsageResult 预占成功时 success=true；失败时返回错误信息
 */
export async function reserveUsage(
    request: NextRequest,
    sessionId: string,
    body?: Record<string, unknown>
): Promise<ReserveUsageResult> {
    const user = await getSession();
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint, userAgent } = identifiers;

    try {
        return await withDbRetry(async () => {
            return await prisma.$transaction(async (tx) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

                // 1. VIP 用户
                if (isVipCheck(user)) {
                    const userId = user!.id;
                    const [count, inProgressCount] = await Promise.all([
                        tx.testRecord.count({ where: { userId, testDate: { gte: today } } }),
                        tx.advisorSession.count({ where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null } })
                    ]);
                    const totalCount = count + inProgressCount;
                    const limit = 100;
                    if (totalCount >= limit) {
                        return { success: false, error: '您的 VIP 今日测试次数已用完，请明天再试。', role: 'vip' };
                    }
                    await tx.testRecord.create({
                        data: { userId, sessionId, testDate: new Date() }
                    });
                    return { success: true, role: 'vip' };
                }

                // 2. 普通注册用户（从数据库读取最新额度，避免 JWT 缓存滞后）
                if (user) {
                    const userId = user.id;
                    const [dbUser, count, inProgressCount] = await Promise.all([
                        tx.user.findUnique({ where: { id: userId }, select: { dailyTestLimit: true } }),
                        tx.testRecord.count({ where: { userId, testDate: { gte: today } } }),
                        tx.advisorSession.count({ where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null } })
                    ]);
                    const totalCount = count + inProgressCount;
                    const limit = getUserDailyLimit(dbUser, isVipCheck(user));
                    if (totalCount >= limit) {
                        return { success: false, error: '今日测试次数已用完，请明天再试。', role: isVipCheck(user) ? 'vip' : 'member' };
                    }
                    await tx.testRecord.create({
                        data: { userId, sessionId, testDate: new Date() }
                    });
                    return { success: true, role: isVipCheck(user) ? 'vip' : 'member' };
                }

                // 3. 访客
                const whereConditions: Prisma.GuestUsageWhereInput[] = [{ ipAddress }];
                if (cookieId) whereConditions.push({ cookieId });
                if (fingerprint) whereConditions.push({ fingerprint });

                const blockedRecord = await tx.guestUsage.findFirst({
                    where: { OR: whereConditions, isBlocked: true }
                });
                if (blockedRecord) {
                    return { success: false, error: blockedRecord.blockedReason || '您的访问已被限制，请联系客服。', role: 'guest' };
                }

                const todayRecord = await tx.guestUsage.findFirst({
                    where: { OR: whereConditions, lastTestAt: { gte: today } },
                    orderBy: { todayCount: 'desc' }
                });

                const guestInProgress = await tx.advisorSession.count({
                    where: { ip: ipAddress, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null }
                });

                const currentCount = todayRecord?.todayCount || 0;
                const totalCount = currentCount + guestInProgress;
                const limit = 3;

                if (totalCount >= limit) {
                    return { success: false, error: '今日测试次数已用完，请明天再试。', role: 'guest' };
                }

                await tx.testRecord.create({
                    data: { guestId: fingerprint || cookieId || ipAddress, sessionId, testDate: new Date() }
                });

                const existing = await tx.guestUsage.findFirst({
                    where: {
                        OR: [{ ipAddress }, ...(fingerprint ? [{ fingerprint }] : []), ...(cookieId ? [{ cookieId }] : [])]
                    },
                    orderBy: { lastTestAt: 'desc' }
                });

                const now = new Date();
                if (existing) {
                    // 安全处理 lastResetDate 为 null 的边界情况
                    const lastReset = existing.lastResetDate || existing.lastTestAt || now;
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const needsReset = !lastReset || new Date(lastReset).setHours(0, 0, 0, 0) < todayStart.getTime();

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
                            todayCount: 1,
                            lastResetDate: now
                        }
                    });
                }

                return { success: true, role: 'guest' };
            });
        });
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        // P2002 = unique constraint violation (already recorded) — 幂等行为，视为成功
        if ((err as { code?: string }).code === 'P2002' || err.message?.includes('Unique constraint')) {
            return { success: true, role: user ? (isVipCheck(user) ? 'vip' : 'member') : 'guest' };
        }
        console.error('Failed to reserve usage:', e);
        return { success: false, error: '额度预占失败，请重试', role: user ? (isVipCheck(user) ? 'vip' : 'member') : 'guest' };
    }
}

/**
 * 记录一次测试行为（后置扣费模式）
 *
 * @deprecated 已废弃。请使用 {@link reserveUsage} 进行原子性预占，避免 TOCTOU 竞态条件。
 * 保留此函数以确保向后兼容，新代码不应再调用。
 */
export async function recordUsage(request: NextRequest, sessionId: string, body?: Record<string, unknown>): Promise<boolean> {
    const user = await getSession();
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint, userAgent } = identifiers;

    try {
        return await withDbRetry(async () => {
            await prisma.$transaction(async (tx) => {
                await tx.testRecord.create({
                    data: {
                        userId: user?.id || null,
                        guestId: !user ? (fingerprint || cookieId || ipAddress) : null,
                        sessionId,
                        testDate: new Date()
                    }
                });

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
                        const lastReset = existing.lastResetDate || existing.lastTestAt || now;
                        const todayStart = new Date();
                        todayStart.setHours(0, 0, 0, 0);
                        const needsReset = !lastReset || new Date(lastReset).setHours(0, 0, 0, 0) < todayStart.getTime();

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
                                todayCount: 1,
                                lastResetDate: now
                            }
                        });
                    }
                }
            });
            return true;
        });
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        if ((err as { code?: string }).code === 'P2002' || err.message?.includes('Unique constraint')) {
            console.log(`[recordUsage] Session ${sessionId} already recorded, skipping duplicate.`);
            return true;
        }
        console.error('Failed to record usage:', e);
        return false;
    }
}
