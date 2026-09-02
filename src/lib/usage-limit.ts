
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/sso-auth';
import { extractGuestIdentifiers } from './guest-limit';
import { withDbRetry } from './utils';
import { startOfTodayShanghai } from './time';

/**
 * 使用频率限制结果
 */
export interface UsageLimitResult {
    canTest: boolean;
    error?: string;
    remaining: number;
    dailyLimit: number;
    /** 额度口径：day = 每日上限（游客/高级会员），lifetime = 终身总量（普通会员） */
    quotaPeriod?: 'day' | 'lifetime';
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
    /**
     * true 表示同一 sessionId 已存在预占记录（P2002 幂等命中），本次并未实际新增计数。
     * 调用方据此决定是否可安全回滚，避免误删其他请求的预占。
     */
    alreadyReserved?: boolean;
}

// 游客每日测试次数限制（业务可随时调整，保持单点配置）
const GUEST_DAILY_LIMIT = 3;

// ===== 会员测肤额度（业务规则，单点配置）=====
// 普通会员（REGULAR 或未识别）：终身总量 12 次
const REGULAR_TOTAL_LIMIT = 12;
// 高级会员（ADVANCED）：总量不限，每日 3 次
const ADVANCED_DAILY_LIMIT = 3;
// dailyTestLimit 的历史系统默认值；等于该值视为未被管理员自定义
const LEGACY_DEFAULT_DAILY_LIMIT = 10;

interface MemberQuota {
    /** 每日上限；null = 不限 */
    dailyLimit: number | null;
    /** 终身总量上限；null = 不限 */
    totalLimit: number | null;
    isAdvanced: boolean;
}

/**
 * 会员额度规则：
 * - ADVANCED（高级会员）：每日 3 次，总量不限
 * - REGULAR（普通会员，含 null/未知等级兜底）：终身总量 12 次，无每日上限
 * - 管理员自定义 dailyTestLimit（≠ 系统默认 10）作为每日上限，优先于会员默认值
 */
function getMemberQuota(user: { membershipLevel?: string | null; dailyTestLimit?: number | null } | null | undefined): MemberQuota {
    const isAdvanced = user?.membershipLevel === "ADVANCED";
    const adminOverride =
        user && typeof user.dailyTestLimit === 'number' && user.dailyTestLimit !== LEGACY_DEFAULT_DAILY_LIMIT
            ? Math.max(0, user.dailyTestLimit)
            : null;
    return {
        dailyLimit: adminOverride ?? (isAdvanced ? ADVANCED_DAILY_LIMIT : null),
        totalLimit: isAdvanced ? null : REGULAR_TOTAL_LIMIT,
        isAdvanced,
    };
}

/**
 * 检查用户或访客的测试频率限制（快速前置检查，不扣费）
 *
 * 规则：
 * 1. 访客：每日 3 次
 * 2. 普通会员（REGULAR）：终身总量 12 次
 * 3. 高级会员（ADVANCED）：总量不限，每日 3 次
 * 4. 管理员自定义 dailyTestLimit（≠ 系统默认 10）作为每日上限，优先于会员默认值
 */
export async function checkUsageLimit(request: NextRequest, body?: Record<string, unknown>): Promise<UsageLimitResult> {
    // 本地开发环境不限制次数
    if (process.env.NODE_ENV !== "production") {
        return { canTest: true, remaining: 999, dailyLimit: 999, role: 'member' };
    }

    const user = await getSessionUser(request);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. 如果是登录用户
    if (user) {
        const userId = user.id;
        // 日界固定北京时间，避免 UTC 部署时凌晨时段额度计算漂移
        const today = startOfTodayShanghai();
        const quota = getMemberQuota(user);

        const [count, inProgressCount, lifetimeCount] = await Promise.all([
            withDbRetry(() =>
                prisma.testRecord.count({
                    where: { userId, testDate: { gte: today } }
                })
            ),
            withDbRetry(() =>
                prisma.advisorSession.count({
                    where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null }
                })
            ),
            // 终身总量仅普通会员需要统计
            quota.totalLimit != null
                ? withDbRetry(() => prisma.testRecord.count({ where: { userId } }))
                : Promise.resolve(0)
        ]);

        const usedToday = count + inProgressCount;
        const usedTotal = lifetimeCount + inProgressCount;
        const dailyRemaining = quota.dailyLimit == null ? Infinity : Math.max(0, quota.dailyLimit - usedToday);
        const totalRemaining = quota.totalLimit == null ? Infinity : Math.max(0, quota.totalLimit - usedTotal);
        const remaining = Math.min(dailyRemaining, totalRemaining);
        // 展示口径：终身额度更紧张时按总量展示（普通会员），否则按日（高级会员/管理员自定义）
        const lifetimeBinding = totalRemaining <= dailyRemaining;
        const effectiveLimit = lifetimeBinding ? (quota.totalLimit ?? 0) : (quota.dailyLimit ?? 0);

        return {
            canTest: remaining > 0,
            remaining: remaining === Infinity ? 999 : remaining,
            dailyLimit: effectiveLimit,
            quotaPeriod: lifetimeBinding ? 'lifetime' : 'day',
            role: 'member',
            error: remaining <= 0
                ? (lifetimeBinding
                    ? `免费测肤次数已用完（共 ${effectiveLimit} 次），升级高级会员可享不限次测肤。`
                    : '今日测肤次数已用完，明天再来。')
                : undefined
        };
    }

    // 2. 如果是访客 — 每日 3 次
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, fingerprint, cookieId } = identifiers;
    const limit = GUEST_DAILY_LIMIT;

    const today = startOfTodayShanghai();

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
            error: blockedRecord.blockedReason || '如需帮助，请联系客服。'
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
            error: '今日免费测试已达上限，注册即享 12 次免费测肤。'
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

    const user = await getSessionUser(request);
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint, userAgent } = identifiers;

    try {
        return await withDbRetry(async () => {
            return await prisma.$transaction(async (tx) => {
                const today = startOfTodayShanghai();
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

                // 1. 登录用户（从数据库读取最新额度，避免 JWT 缓存滞后）
                if (user) {
                    const userId = user.id;
                    const [dbUser, count, inProgressCount, lifetimeCount] = await Promise.all([
                        tx.user.findUnique({ where: { id: userId }, select: { dailyTestLimit: true, membershipLevel: true } }),
                        tx.testRecord.count({ where: { userId, testDate: { gte: today } } }),
                        tx.advisorSession.count({ where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null } }),
                        tx.testRecord.count({ where: { userId } })
                    ]);
                    const quota = getMemberQuota(dbUser);
                    const usedToday = count + inProgressCount;
                    const usedTotal = lifetimeCount + inProgressCount;
                    if (quota.dailyLimit != null && usedToday >= quota.dailyLimit) {
                        return { success: false, error: '今日测肤次数已用完，明天再来。', role: 'member' };
                    }
                    if (quota.totalLimit != null && usedTotal >= quota.totalLimit) {
                        return { success: false, error: `免费测肤次数已用完（共 ${quota.totalLimit} 次），升级高级会员可享不限次测肤。`, role: 'member' };
                    }
                    // upsert 语义：createMany + skipDuplicates 天然幂等。
                    // 原 create 在 withDbRetry 重试时会撞 P2002 被外层 catch 归为
                    // alreadyReserved，但首次尝试可能已建 TestRecord 而 GuestUsage
                    // 未自增，造成漏计；改为按实际插入行数判断。
                    const created = await tx.testRecord.createMany({
                        data: { userId, sessionId, testDate: new Date() },
                        skipDuplicates: true
                    });
                    if (created.count === 0) {
                        // sessionId 已预占（重试/重复请求），本次未实际新增计数
                        return { success: true, role: 'member', alreadyReserved: true };
                    }
                    return { success: true, role: 'member' };
                }

                // 2. 访客 — IP 为主匹配键，fingerprint/cookieId 为辅助维度防止 VPN 绕过
                const limit = GUEST_DAILY_LIMIT;
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
                    return { success: false, error: '今日测试次数已用完，注册即享 12 次免费测肤。', role: 'guest' };
                }

                // upsert 语义：同登录用户分支，按实际插入行数判断是否首次预占，
                // 仅在真实新增时才自增 GuestUsage，避免重试导致的漏计/重复计数
                const created = await tx.testRecord.createMany({
                    data: { guestId: fingerprint || cookieId || ipAddress, sessionId, testDate: new Date() },
                    skipDuplicates: true
                });
                if (created.count === 0) {
                    return { success: true, role: 'guest', alreadyReserved: true };
                }

                // 更新 GuestUsage 时同样以 IP 为主要键，fingerprint/cookieId 作为辅助元数据存储
                const existing = await tx.guestUsage.findFirst({
                    where: { ipAddress },
                    orderBy: { lastTestAt: 'desc' }
                });

                const now = new Date();
                if (existing) {
                    // 日切并发竞态保护：用条件 UPDATE 替代"读-改-写"，
                    // 避免两个并发请求同时判定 needsReset=true、都写 todayCount=1 导致丢计数。
                    const meta = {
                        lastTestAt: now,
                        ipAddress,
                        cookieId: cookieId || existing.cookieId,
                        fingerprint: fingerprint || existing.fingerprint,
                        userAgent
                    };
                    // 1) 今日已重置过（lastResetDate >= 当日零点，null 不匹配）：直接自增
                    let updated = await tx.guestUsage.updateMany({
                        where: { id: existing.id, lastResetDate: { gte: today } },
                        data: { ...meta, testCount: { increment: 1 }, todayCount: { increment: 1 } }
                    });
                    if (updated.count === 0) {
                        // 2) 需要日切重置：竞争重置权，仅首个满足"今日未重置"的请求置 todayCount=1
                        updated = await tx.guestUsage.updateMany({
                            where: {
                                id: existing.id,
                                lastResetDate: { lt: today }
                            },
                            data: { ...meta, testCount: { increment: 1 }, todayCount: 1, lastResetDate: today }
                        });
                        if (updated.count === 0) {
                            // 3) 另一并发请求已完成日切重置，直接自增即可
                            await tx.guestUsage.updateMany({
                                where: { id: existing.id },
                                data: { ...meta, testCount: { increment: 1 }, todayCount: { increment: 1 } }
                            });
                        }
                    }
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
        // P2002 = unique constraint violation — createMany skipDuplicates 下不应再触发，
        // 保留作兼容兜底：视为幂等成功，但标记 alreadyReserved，调用方不得据此回滚。
        if ((err as { code?: string }).code === 'P2002' || err.message?.includes('Unique constraint')) {
            return { success: true, role: user ? 'member' : 'guest', alreadyReserved: true };
        }
        console.error('Failed to reserve usage:', e);
        return { success: false, error: '请稍后再试。', role: user ? 'member' : 'guest' };
    }
}

/**
 * 回滚已预占的额度（用于 AI 服务不可用、图片验证失败等明确非用户原因的场景）
 *
 * 规则：
 * 1. 按 sessionId 精确冲销：仅当本 session 的 TestRecord 真实存在时才回滚
 * 2. 天然幂等：重复调用时删除 0 行，不会重复扣减
 * 3. 游客：在确认实际计过数的前提下，将 GuestUsage 的 testCount/todayCount 减 1（不低于 0）
 */
export async function rollbackUsage(
    request: NextRequest,
    sessionId: string,
    body?: Record<string, unknown>
): Promise<boolean> {
    const user = await getSessionUser(request);
    const identifiers = extractGuestIdentifiers(request, body);
    const { ipAddress, cookieId, fingerprint } = identifiers;

    try {
        await withDbRetry(async () => {
            await prisma.$transaction(async (tx) => {
                // 1. 按 sessionId 精确删除本次预占的 TestRecord（登录用户或游客都会创建）
                const deleted = await tx.testRecord.deleteMany({
                    where: { sessionId }
                });
                // 无记录 = 本 session 未实际预占（幂等命中或已回滚过），不做任何扣减
                if (deleted.count === 0) return;

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
