
/**
 * 速率限制工具
 * 使用内存 Map 实现简单的 IP 限流
 *
 * ⚠️ 重要限制：当前实现基于进程内内存缓存，仅在单实例部署下有效。
 * 如果应用水平扩展到多个实例/容器，每个实例拥有独立的内存缓存，
 * 限流将被绕过（一个 IP 可在每个实例上都达到限制上限）。
 *
 * 多实例兼容方案：
 * 1. 使用 Redis / Upstash Redis 等外部存储替代内存 Map
 * 2. 或使用 @upstash/ratelimit 等专门的分布式限流库
 * 当前部署环境为 PM2 单实例常驻进程，故暂使用内存实现。
 */

/** 速率限制配置 */
export interface RateLimitOptions {
    /** 最大请求数 */
    maxRequests: number;
    /** 时间窗口（毫秒） */
    windowMs: number;
}

/** 速率限制结果 */
export interface RateLimitResult {
    /** 是否允许请求 */
    success: boolean;
    /** 剩余请求次数 */
    remaining: number;
    /** 重置时间戳 */
    reset: number;
    /** 限制总次数 */
    limit: number;
}

/** 请求记录 */
interface RequestRecord {
    timestamps: number[];
    windowStart: number;
}

/** 内存缓存 - 存储 IP 请求记录 */
const rateLimitCache = new Map<string, RequestRecord>();

/** 最大缓存条目数（防止内存无限增长） */
const MAX_CACHE_SIZE = 10000;

/** 缓存清理间隔（5分钟） */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/** 定期清理过期记录 */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function enforceCacheLimit() {
    if (rateLimitCache.size <= MAX_CACHE_SIZE) return;
    // 删除最旧的 20% 条目（基于 windowStart）
    const entries = Array.from(rateLimitCache.entries());
    entries.sort((a, b) => a[1].windowStart - b[1].windowStart);
    const deleteCount = Math.floor(MAX_CACHE_SIZE * 0.2);
    for (let i = 0; i < deleteCount; i++) {
        rateLimitCache.delete(entries[i][0]);
    }
}

function startCleanup() {
    if (cleanupTimer) return;

    cleanupTimer = setInterval(() => {
        const now = Date.now();
        rateLimitCache.forEach((record, key) => {
            // 删除超过 1 小时未活跃的记录
            if (now - record.windowStart > 60 * 60 * 1000) {
                rateLimitCache.delete(key);
            }
        });
    }, CLEANUP_INTERVAL);
}

/** 默认配置 */
const DEFAULT_OPTIONS: RateLimitOptions = {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 分钟
};

/** 预定义的限制配置 */
export const RATE_LIMIT_PRESETS = {
    /** 默认 API 限制 */
    default: { maxRequests: 100, windowMs: 60 * 1000 },
    /** AI 顾问限制 - 较宽松 */
    advisor: { maxRequests: 30, windowMs: 60 * 1000 },
    /** 面部分析限制 - 严格 */
    "face-analyze": { maxRequests: 5, windowMs: 60 * 60 * 1000 },
    /** 综合分析限制 - 严格，与面部分析一致 */
    "comprehensive-analyze": { maxRequests: 5, windowMs: 60 * 60 * 1000 },
    /** 表单提交限制 */
    form: { maxRequests: 10, windowMs: 60 * 1000 },
    /** 登录限制 - 防暴力破解 */
    login: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
    /** AI Chat 限制 - 每分钟 10 次 */
    chat: { maxRequests: 10, windowMs: 60 * 1000 },
    /** 用户级 Chat 限制 - 每分钟 15 次 */
    "chat-user": { maxRequests: 15, windowMs: 60 * 1000 },
    /** OSS 签名获取限制 - 每分钟 20 次 */
    "oss-sign": { maxRequests: 20, windowMs: 60 * 1000 },
} as const;

/**
 * 速率限制检查
 *
 * @param identifier - 唯一标识符（通常是 IP 地址）
 * @param type - 限制类型（使用预设配置）
 * @param options - 自定义配置（覆盖预设）
 * @returns 限制检查结果
 */
export async function rateLimit(
    identifier: string,
    type: keyof typeof RATE_LIMIT_PRESETS = "default",
    options?: Partial<RateLimitOptions>
): Promise<RateLimitResult> {
    // 启动清理定时器
    startCleanup();

    // 合并配置
    const preset = RATE_LIMIT_PRESETS[type] || DEFAULT_OPTIONS;
    const opts: RateLimitOptions = { ...preset, ...options };

    const now = Date.now();
    const cacheKey = `${type}:${identifier}`;

    // 获取或创建请求记录
    let record = rateLimitCache.get(cacheKey);

    if (!record) {
        record = {
            timestamps: [],
            windowStart: now,
        };
        rateLimitCache.set(cacheKey, record);
    }

    // 清理过期的请求记录
    const windowStart = now - opts.windowMs;
    record.timestamps = record.timestamps.filter((t: number) => t > windowStart);
    // Update windowStart on every request to reflect latest activity.
    // Cleanup uses windowStart to determine stale entries.
    record.windowStart = now;

    // 检查是否超过限制
    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, opts.maxRequests - currentCount);
    const reset = now + opts.windowMs;

    if (currentCount >= opts.maxRequests) {
        return {
            success: false,
            remaining: 0,
            reset,
            limit: opts.maxRequests,
        };
    }

    // 记录本次请求
    record.timestamps.push(now);

    // 防止缓存无限增长
    enforceCacheLimit();

    return {
        success: true,
        remaining: remaining - 1,
        reset,
        limit: opts.maxRequests,
    };
}

/**
 * Reset rate limit for a given identifier
 */
export function resetRateLimit(
    identifier: string,
    type: keyof typeof RATE_LIMIT_PRESETS = "default"
): void {
    const cacheKey = `${type}:${identifier}`;
    rateLimitCache.delete(cacheKey);
}

/**
 * 获取客户端 IP 地址
 * 支持代理环境
 */
export function getClientIP(request: Request): string {
    // Use the LAST value in X-Forwarded-For (closest to the server / most trusted)
    // instead of the FIRST value which can be spoofed by the client.
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const ips = forwardedFor.split(",").map(s => s.trim()).filter(Boolean);
        if (ips.length > 0) {
            return ips[ips.length - 1];
        }
    }

    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
        return realIP;
    }

    return "unknown";
}

/** 双重限流结果 */
export interface DualRateLimitResult extends RateLimitResult {
    /** 被限制的类型：ip | user | null（未被限制） */
    limitedBy: "ip" | "user" | null;
}

/**
 * 双重速率限制检查（IP + 用户级）
 *
 * 优先检查 IP 限流，再检查用户级限流
 * 任一触发即拒绝请求
 *
 * @param ip - IP 地址
 * @param userId - 用户 ID（可选，未登录用户只检查 IP）
 * @param ipType - IP 限流类型
 * @param userType - 用户限流类型
 * @returns 限制检查结果
 */
export async function dualRateLimit(
    ip: string,
    userId: string | null | undefined,
    ipType: keyof typeof RATE_LIMIT_PRESETS = "chat",
    userType: keyof typeof RATE_LIMIT_PRESETS = "chat-user"
): Promise<DualRateLimitResult> {
    // 1. 检查 IP 限流
    const ipResult = await rateLimit(ip, ipType);
    if (!ipResult.success) {
        return {
            ...ipResult,
            limitedBy: "ip",
        };
    }

    // 2. 如果有用户 ID，检查用户级限流
    if (userId) {
        const userResult = await rateLimit(`user:${userId}`, userType);
        if (!userResult.success) {
            return {
                ...userResult,
                limitedBy: "user",
            };
        }

        // 返回较严格的限制信息
        return {
            success: true,
            remaining: Math.min(ipResult.remaining, userResult.remaining),
            reset: Math.max(ipResult.reset, userResult.reset),
            limit: Math.min(ipResult.limit, userResult.limit),
            limitedBy: null,
        };
    }

    return {
        ...ipResult,
        limitedBy: null,
    };
}
