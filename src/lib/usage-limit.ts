
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/sso-auth';
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
    /** 额度口径：day = 每日上限，lifetime = 终身总量（普通/银卡会员） */
    quotaPeriod?: 'day' | 'lifetime';
    resetTime?: Date;
    role: 'guest' | 'member';
    /** 游客拒绝时置 true：测肤功能需登录，调用方应返回 401 并引导登录 */
    requireLogin?: boolean;
    /** 归一化后的会员档位（仅登录用户） */
    level?: MemberLevel;
    /** 用量与配额明细（仅登录用户，供 test-limit / 前端展示） */
    usage?: {
        totalUsed: number;
        todayUsed: number;
        lifetimeLimit: number | null;
        dailyLimit: number | null;
        unlimited: boolean;
    };
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
    /** 游客拒绝时置 true：调用方应返回 401 而非 429 */
    requireLogin?: boolean;
}

// ===== 会员测肤额度（四档会员规则，单点配置）=====
// 普通会员（REGULAR 或未识别）：终身总量 10 次，无每日上限
const REGULAR_TOTAL_LIMIT = 10;
// 银卡（SILVER）：终身池 = 10 + 每消费满 1000 元加赠 20 次
const SILVER_BONUS_PER_1000 = 20;
// 银卡（SILVER）：每日最多 10 次
const SILVER_DAILY_LIMIT = 10;
// 金卡/钻石（GOLD/DIAMOND，含历史 ADVANCED 兜底）：总量不限，每日 10 次
const UNLIMITED_DAILY_LIMIT = 10;
// dailyTestLimit 的历史系统默认值；等于该值视为未被管理员自定义
const LEGACY_DEFAULT_DAILY_LIMIT = 10;

// ===== 错误文案（单点配置）=====
const GUEST_REQUIRE_LOGIN_MESSAGE = '测肤功能需登录后使用，注册即享 10 次免费 AI 测肤。';
const REGULAR_EXHAUSTED_MESSAGE = `免费测肤次数已用完（共 ${REGULAR_TOTAL_LIMIT} 次），升级银卡会员可享更多测肤次数。`;
const SILVER_EXHAUSTED_MESSAGE = '测肤次数已用完，每消费满 ¥1,000 可加赠 20 次，或升级金卡享不限次测肤。';
const DAILY_EXHAUSTED_MESSAGE = '今日测肤次数已用完，明天再来。';

/** 归一化后的会员档位 */
export type MemberLevel = 'REGULAR' | 'SILVER' | 'GOLD' | 'DIAMOND';

export interface MemberQuota {
    /** 归一化后的会员档位 */
    level: MemberLevel;
    /** 每日上限；null = 不限（普通会员） */
    dailyLimit: number | null;
    /** 终身总量上限；null = 不限（金卡/钻石） */
    lifetimeLimit: number | null;
    /** 总量不限（GOLD/DIAMOND/历史 ADVANCED） */
    unlimited: boolean;
}

/**
 * 归一化会员等级：
 * - 历史残留值 ADVANCED 按 GOLD 兜底（下次 SSO 登录会刷新为新四档值）
 * - null/未知值按 REGULAR 兜底
 */
export function normalizeMembershipLevel(level?: string | null): MemberLevel {
    switch (level) {
        case 'SILVER': return 'SILVER';
        case 'GOLD': return 'GOLD';
        case 'DIAMOND': return 'DIAMOND';
        case 'ADVANCED': return 'GOLD';
        default: return 'REGULAR';
    }
}

/**
 * 会员测肤额度规则（官网四档会员策略）：
 * - REGULAR（普通，含 null/未知兜底）：终身总量 10 次，无每日上限
 * - SILVER（银卡）：终身池 = 10 + 20 × ⌊totalSpent/1000⌋，每日最多 10 次
 * - GOLD/DIAMOND（金卡/钻石，历史 ADVANCED 同等待遇）：总量不限，每日 10 次
 * - 管理员自定义 dailyTestLimit（≠ 系统默认 10）优先级最高，覆盖会员每日上限
 */
export function getMemberQuota(
    user: { membershipLevel?: string | null; dailyTestLimit?: number | null; totalSpent?: number | null } | null | undefined
): MemberQuota {
    const level = normalizeMembershipLevel(user?.membershipLevel);
    const adminOverride =
        user && typeof user.dailyTestLimit === 'number' && user.dailyTestLimit !== LEGACY_DEFAULT_DAILY_LIMIT
            ? Math.max(0, user.dailyTestLimit)
            : null;

    if (level === 'GOLD' || level === 'DIAMOND') {
        return {
            level,
            dailyLimit: adminOverride ?? UNLIMITED_DAILY_LIMIT,
            lifetimeLimit: null,
            unlimited: true,
        };
    }

    if (level === 'SILVER') {
        const spent = typeof user?.totalSpent === 'number' && user.totalSpent > 0 ? user.totalSpent : 0;
        return {
            level,
            dailyLimit: adminOverride ?? SILVER_DAILY_LIMIT,
            lifetimeLimit: REGULAR_TOTAL_LIMIT + SILVER_BONUS_PER_1000 * Math.floor(spent / 1000),
            unlimited: false,
        };
    }

    return {
        level: 'REGULAR',
        dailyLimit: adminOverride,
        lifetimeLimit: REGULAR_TOTAL_LIMIT,
        unlimited: false,
    };
}

/**
 * 检查用户或访客的测试频率限制（快速前置检查，不扣费）
 *
 * 规则：
 * 1. 游客：一律拒绝（requireLogin），不再按 IP/指纹计次
 * 2. 普通会员（REGULAR）：终身总量 10 次
 * 3. 银卡（SILVER）：终身池 = 10 + 20 × ⌊totalSpent/1000⌋，每日最多 10 次
 * 4. 金卡/钻石（GOLD/DIAMOND，历史 ADVANCED 兜底）：总量不限，每日 10 次
 * 5. 管理员自定义 dailyTestLimit（≠ 系统默认 10）作为每日上限，优先于会员默认值
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function checkUsageLimit(request: NextRequest, _body?: Record<string, unknown>): Promise<UsageLimitResult> {
    // 本地开发环境不限制次数
    if (process.env.NODE_ENV !== "production") {
        return { canTest: true, remaining: 999, dailyLimit: 999, role: 'member' };
    }

    const user = await getSessionUser(request);

    // 1. 游客：测肤功能需登录，不再查 GuestUsage 计次/封禁
    if (!user) {
        return {
            canTest: false,
            remaining: 0,
            dailyLimit: 0,
            quotaPeriod: 'lifetime',
            role: 'guest',
            requireLogin: true,
            error: GUEST_REQUIRE_LOGIN_MESSAGE,
        };
    }

    // 2. 登录用户：按新四档口径（lifetime 与 daily 两个维度）
    const userId = user.id;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
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
        withDbRetry(() => prisma.testRecord.count({ where: { userId } }))
    ]);

    const usedToday = count + inProgressCount;
    const usedTotal = lifetimeCount + inProgressCount;
    const dailyRemaining = quota.dailyLimit == null ? Infinity : Math.max(0, quota.dailyLimit - usedToday);
    const totalRemaining = quota.lifetimeLimit == null ? Infinity : Math.max(0, quota.lifetimeLimit - usedTotal);
    const remaining = Math.min(dailyRemaining, totalRemaining);
    // 展示口径：终身额度更紧张时按总量展示（普通/银卡会员），否则按日（金卡/钻石/管理员自定义）
    const lifetimeBinding = totalRemaining <= dailyRemaining;
    const effectiveLimit = lifetimeBinding ? (quota.lifetimeLimit ?? 0) : (quota.dailyLimit ?? 0);

    let error: string | undefined;
    if (remaining <= 0) {
        if (totalRemaining <= 0) {
            error = quota.level === 'SILVER' ? SILVER_EXHAUSTED_MESSAGE : REGULAR_EXHAUSTED_MESSAGE;
        } else {
            error = DAILY_EXHAUSTED_MESSAGE;
        }
    }

    return {
        canTest: remaining > 0,
        remaining: remaining === Infinity ? 999 : remaining,
        dailyLimit: effectiveLimit,
        quotaPeriod: lifetimeBinding ? 'lifetime' : 'day',
        role: 'member',
        level: quota.level,
        usage: {
            totalUsed: usedTotal,
            todayUsed: usedToday,
            lifetimeLimit: quota.lifetimeLimit,
            dailyLimit: quota.dailyLimit,
            unlimited: quota.unlimited,
        },
        error,
    };
}

/**
 * 原子性预占额度：在数据库事务内检查限制并创建使用记录
 *
 * 最佳实践：在 AI 分析前调用，防止"结果已出但额度未扣"的 TOCTOU 竞态窗口。
 * 如果分析最终失败，预占的额度不自动释放（服务器资源已消耗）。
 *
 * 游客一律拒绝（requireLogin=true），不再写 TestRecord / GuestUsage。
 *
 * @returns ReserveUsageResult 预占成功时 success=true；失败时返回错误信息
 */
export async function reserveUsage(
    request: NextRequest,
    sessionId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _body?: Record<string, unknown>
): Promise<ReserveUsageResult> {
    // 本地开发环境不限制次数
    if (process.env.NODE_ENV !== "production") {
        return { success: true, role: 'member' };
    }

    const user = await getSessionUser(request);

    // 游客：测肤功能需登录，不再写 TestRecord / 自增 GuestUsage
    if (!user) {
        return { success: false, role: 'guest', requireLogin: true, error: GUEST_REQUIRE_LOGIN_MESSAGE };
    }

    try {
        return await withDbRetry(async () => {
            return await prisma.$transaction(async (tx) => {
                const today = startOfTodayShanghai();
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                const userId = user.id;

                // 从数据库读取最新额度与消费金额，避免 JWT 缓存滞后
                const [dbUser, count, inProgressCount, lifetimeCount] = await Promise.all([
                    tx.user.findUnique({ where: { id: userId }, select: { dailyTestLimit: true, membershipLevel: true, totalSpent: true } }),
                    tx.testRecord.count({ where: { userId, testDate: { gte: today } } }),
                    tx.advisorSession.count({ where: { userId, analysisStartedAt: { gte: tenMinutesAgo }, completedAt: null } }),
                    tx.testRecord.count({ where: { userId } })
                ]);
                const quota = getMemberQuota(dbUser);
                const usedToday = count + inProgressCount;
                const usedTotal = lifetimeCount + inProgressCount;
                if (quota.dailyLimit != null && usedToday >= quota.dailyLimit) {
                    return { success: false, error: DAILY_EXHAUSTED_MESSAGE, role: 'member' };
                }
                if (quota.lifetimeLimit != null && usedTotal >= quota.lifetimeLimit) {
                    const error = quota.level === 'SILVER' ? SILVER_EXHAUSTED_MESSAGE : REGULAR_EXHAUSTED_MESSAGE;
                    return { success: false, error, role: 'member' };
                }
                // upsert 语义：createMany + skipDuplicates 天然幂等，
                // 按实际插入行数判断是否首次预占，避免重试导致的漏计/重复计数。
                const created = await tx.testRecord.createMany({
                    data: { userId, sessionId, testDate: new Date() },
                    skipDuplicates: true
                });
                if (created.count === 0) {
                    // sessionId 已预占（重试/重复请求），本次未实际新增计数
                    return { success: true, role: 'member', alreadyReserved: true };
                }
                return { success: true, role: 'member' };
            });
        });
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        // P2002 = unique constraint violation — createMany skipDuplicates 下不应再触发，
        // 保留作兼容兜底：视为幂等成功，但标记 alreadyReserved，调用方不得据此回滚。
        if ((err as { code?: string }).code === 'P2002' || err.message?.includes('Unique constraint')) {
            return { success: true, role: 'member', alreadyReserved: true };
        }
        console.error('Failed to reserve usage:', e);
        return { success: false, error: '请稍后再试。', role: 'member' };
    }
}

/**
 * 回滚已预占的额度（用于 AI 服务不可用、图片验证失败等明确非用户原因的场景）
 *
 * 规则：
 * 1. 按 sessionId 精确冲销：仅当本 session 的 TestRecord 真实存在时才回滚
 * 2. 天然幂等：重复调用时删除 0 行，不会重复扣减
 * 3. 游客不再预占额度（需登录），无 GuestUsage 回滚分支；历史 GuestUsage 数据保留不写入
 */
export async function rollbackUsage(
    request: NextRequest,
    sessionId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _body?: Record<string, unknown>
): Promise<boolean> {
    try {
        await withDbRetry(async () => {
            await prisma.$transaction(async (tx) => {
                // 按 sessionId 精确删除本次预占的 TestRecord（仅登录用户会创建）
                await tx.testRecord.deleteMany({
                    where: { sessionId }
                });
            });
        });
        return true;
    } catch (e: unknown) {
        console.error(`[rollbackUsage] Failed to rollback usage for session ${sessionId}:`, e);
        return false;
    }
}

/**
 * 用户测肤用量汇总（供内部接口 / 会员面板复用）
 *
 * 统计口径：仅 TestRecord 实际落库计数（终身 + 北京时间当日），不含在途分析。
 * 用户不存在（从未用过子站）时 level 返回 null，quota 按 REGULAR 档计算。
 */
export interface SkinTestUsageSummary {
    /** 归一化后的会员档位；用户不存在时为 null */
    level: MemberLevel | null;
    totalUsed: number;
    todayUsed: number;
    quota: {
        lifetimeLimit: number | null;
        dailyLimit: number | null;
        unlimited: boolean;
    };
    /** 终身剩余次数；unlimited 时为 null */
    remaining: number | null;
}

export async function getSkinTestUsageSummary(userId: string): Promise<SkinTestUsageSummary> {
    const today = startOfTodayShanghai();
    const [user, totalUsed, todayUsed] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { membershipLevel: true, totalSpent: true, dailyTestLimit: true },
        }),
        prisma.testRecord.count({ where: { userId } }),
        prisma.testRecord.count({ where: { userId, testDate: { gte: today } } }),
    ]);

    const quota = getMemberQuota(user);
    return {
        level: user ? quota.level : null,
        totalUsed,
        todayUsed,
        quota: {
            lifetimeLimit: quota.lifetimeLimit,
            dailyLimit: quota.dailyLimit,
            unlimited: quota.unlimited,
        },
        remaining: quota.lifetimeLimit == null ? null : Math.max(0, quota.lifetimeLimit - totalUsed),
    };
}
