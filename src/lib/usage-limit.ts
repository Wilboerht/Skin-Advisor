
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
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
    role: 'guest' | 'member';
}

/**
 * 原子性预占额度结果
 */
export interface ReserveUsageResult {
    success: boolean;
    error?: string;
    role: 'guest' | 'member';
}

/**
 * 获取登录用户的每日测试限制
 */
function getUserDailyLimit(user: { dailyTestLimit?: number | null } | null | undefined): number {
    // dailyTestLimit 为 null/undefined 时回退到系统默认 3 次；
    // 显式设置为 0-1 均视为有效自定义值（0 表示禁用测试）。
    // 登录用户享有比游客（1次/天）更多的测试权益。
    if (user && typeof user.dailyTestLimit === 'number') {
        return Math.max(0, user.dailyTestLimit);
    }
    return 3;
}

/**
 * 检查用户或访客的测试频率限制（快速前置检查，不扣费）
 *
 * 规则：
 * 1. 访客：每日 1 次
 * 2. 登录用户：每日 3 次（管理员可通过 dailyTestLimit 调整）
 */
export async function checkUsageLimit(request: NextRequest, body?: Record<string, unknown>): Promise<UsageLimitResult> {
    // 本地开发环境不限制次数
    if (process.env.NODE_ENV !== "production") {
        return { canTest: true, remaining: 999, dailyLimit: 999, role: 'member' };
    }

    const user = await getSession();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. 如果是登录用户
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
        const limit = getUserDailyLimit(user);
        return {
            canTest: totalCount < limit,
            remaining: Math.max(0, limit - totalCount),
            dailyLimit: limit,
            role: 'member',
            error: totalCount >= limit ? '今日测试次数已用完，请明天再试。' : undefined
        };
    }

    // 2. 如果是访客 — 每日 1 次
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, fingerprint, cookieId } = identifiers;
    const limit = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 跨 IP 指纹检查：同一指纹在其他 IP 上的用量也计入 (防 VPN 切换)
    // 但上限为限制的 50%，避免 CGNAT/IP 频繁切换的合法用户被过度惩罚
    let crossIpCount = 0;
    if (fingerprint) {
        const crossIpRecord = await withDbRetry(() =>
            prisma.guestUsage.findFirst({
                where: {
                    fingerprint,
                    ipAddress: { not: ipAddress },
                    lastTestAt: { gte: today },
                },
                orderBy: { todayCount: 'desc' },
            })
        );
        crossIpCount = Math.min(crossIpRecord?.todayCount || 0, Math.floor(limit * 0.5));
    }

    // 安全：始终以服务端可信的 IP 哈希作为主匹配键，fingerprint/cookieId 仅作辅助存储。
    const todayRecord = await withDbRetry(() =>
        prisma.guestUsage.findFirst({
            where: { ipAddress, lastTestAt: { gte: today } },
            orderBy: { todayCount: 'desc' }
        })
    );

    const count = (todayRecord?.todayCount || 0) + crossIpCount;

    const blockedRecord = await withDbRetry(() =>
        prisma.guestUsage.findFirst({
            where: {
                isBlocked: true,
                OR: [
                    { ipAddress },
                    ...(fingerprint ? [{ fingerprint }] : []),
                    ...(cookieId ? [{ cookieId }] : [])
                ]
            }
        })
    );
    if (blockedRecord) {
        return {
            canTest: false,
            remaining: 0,
            dailyLimit: limit,
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

    if (totalCount >= limit) {
        return {
            canTest: false,
            remaining: 0,
            dailyLimit: limit,
            role: 'guest',
            error: '今日测试次数已用完，登录后可获更多次数。'
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
    // 本地开发环境不限制次数
    if (process.env.NODE_ENV !== "production") {
        return { success: true, role: 'member' };
    }

    const user = await getSession();
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint, userAgent } = identifiers;

    try {
        return await withDbRetry(async () => {
            return await prisma.$transaction(async (tx) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

                // 1. 登录用户（从数据库读取最新额度，避免 JWT 缓存滞后）
                if (user) {
                    const userId = user.id;
                    const [dbUser, count, inProgressCount] = await Promise.all([
                        tx.user.findUnique({ where: { id: userId }, select: { dailyTestLimit: true } }),
                        tx.testRecord.count({ where: { userId, testDate: { gte: today } } }),
                        tx.advisorSession.count({ where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null } })
                    ]);
                    const totalCount = count + inProgressCount;
                    const limit = getUserDailyLimit(dbUser);
                    if (totalCount >= limit) {
                        return { success: false, error: '今日测试次数已用完，请明天再试。', role: 'member' };
                    }
                    await tx.testRecord.create({
                        data: { userId, sessionId, testDate: new Date() }
                    });
                    return { success: true, role: 'member' };
                }

                // 2. 访客 — IP 为主匹配键，fingerprint/cookieId 为辅助维度防止 VPN 绕过
                const limit = 1;
                const blockedRecord = await tx.guestUsage.findFirst({
                    where: {
                        isBlocked: true,
                        OR: [
                            { ipAddress },
                            ...(fingerprint ? [{ fingerprint }] : []),
                            ...(cookieId ? [{ cookieId }] : [])
                        ]
                    }
                });
                if (blockedRecord) {
                    return { success: false, error: blockedRecord.blockedReason || '您的访问已被限制，请联系客服。', role: 'guest' };
                }

                // 跨 IP 指纹检查：同一指纹在其他 IP 上的当日用量也计入限制（防 VPN 切换）
                let crossIpCount = 0;
                if (fingerprint) {
                    const crossIpRecord = await tx.guestUsage.findFirst({
                        where: {
                            fingerprint,
                            ipAddress: { not: ipAddress },
                            lastTestAt: { gte: today },
                        },
                        orderBy: { todayCount: 'desc' },
                    });
                    crossIpCount = Math.min(crossIpRecord?.todayCount || 0, Math.floor(limit * 0.5));
                }

                // 按 IP 匹配当日记录
                const todayRecord = await tx.guestUsage.findFirst({
                    where: { ipAddress, lastTestAt: { gte: today } },
                    orderBy: { todayCount: 'desc' }
                });

                const guestInProgress = await tx.advisorSession.count({
                    where: { ip: ipAddress, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null }
                });

                const currentCount = (todayRecord?.todayCount || 0) + crossIpCount;
                const totalCount = currentCount + guestInProgress;

                if (totalCount >= limit) {
                    return { success: false, error: '今日测试次数已用完，登录后可获更多次数。', role: 'guest' };
                }

                await tx.testRecord.create({
                    data: { guestId: fingerprint || cookieId || ipAddress, sessionId, testDate: new Date() }
                });

                // 更新 GuestUsage 时同样以 IP 为主要键，fingerprint/cookieId 作为辅助元数据存储
                const existing = await tx.guestUsage.findFirst({
                    where: { ipAddress },
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
            return { success: true, role: user ? 'member' : 'guest' };
        }
        console.error('Failed to reserve usage:', e);
        return { success: false, error: '额度预占失败，请重试', role: user ? 'member' : 'guest' };
    }
}

/**
 * 回滚已预占的额度（用于 AI 服务不可用、图片验证失败等明确非用户原因的场景）
 *
 * 规则：
 * 1. 登录用户：删除本次创建的 TestRecord
 * 2. 游客：将 GuestUsage 的 testCount/todayCount 减 1（不低于 0）
 */
export async function rollbackUsage(
    request: NextRequest,
    sessionId: string,
    body?: Record<string, unknown>
): Promise<boolean> {
    const user = await getSession();
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint } = identifiers;

    try {
        await withDbRetry(async () => {
            await prisma.$transaction(async (tx) => {
                // 1. 删除 TestRecord（登录用户或游客都会创建）
                await tx.testRecord.deleteMany({
                    where: { sessionId }
                });

                // 2. 游客回滚 GuestUsage 计数
                if (!user) {
                    const existing = await tx.guestUsage.findFirst({
                        where: {
                            OR: [
                                { ipAddress },
                                ...(fingerprint ? [{ fingerprint }] : []),
                                ...(cookieId ? [{ cookieId }] : [])
                            ]
                        },
                        orderBy: { lastTestAt: 'desc' }
                    });

                    if (existing && (existing.testCount > 0 || existing.todayCount > 0)) {
                        await tx.guestUsage.update({
                            where: { id: existing.id },
                            data: {
                                testCount: Math.max(0, existing.testCount - 1),
                                todayCount: Math.max(0, existing.todayCount - 1)
                            }
                        });
                    }
                }
            });
        });
        return true;
    } catch (e: unknown) {
        console.error(`[rollbackUsage] Failed to rollback usage for session ${sessionId}:`, e);
        return false;
    }
}
