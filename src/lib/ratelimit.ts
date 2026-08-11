
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

import { FACE_ANALYZE_RATE_LIMIT, COMPREHENSIVE_ANALYZE_RATE_LIMIT } from "@/config/ai";

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

export const RATE_LIMIT_PRESETS = {
    default: { maxRequests: 100, windowMs: 60 * 1000 },
    advisor: { maxRequests: 30, windowMs: 60 * 1000 },
    "face-analyze": { maxRequests: FACE_ANALYZE_RATE_LIMIT, windowMs: 60 * 60 * 1000 },
    "comprehensive-analyze": { maxRequests: COMPREHENSIVE_ANALYZE_RATE_LIMIT, windowMs: 60 * 60 * 1000 },
    form: { maxRequests: 10, windowMs: 60 * 1000 },
    login: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
    "oss-sign": { maxRequests: 20, windowMs: 60 * 1000 },
    "session-status": { maxRequests: 60, windowMs: 60 * 1000 },
};

/**
 * 速率限制检查
 *
 * @param identifier - 唯一标识符（通常是 IP 地址）
 * @param type - 限制类型（使用预设配置）
 * @param options - 自定义配置（覆盖预设）
 * @returns 限制检查结果
 */
// 多实例检测缓存：首次检测后 5 分钟内不再重复调用（避免每次 rateLimit 都 await）
let multiInstanceChecked = false;
let multiInstanceCheckAt = 0;
const MULTI_INSTANCE_RECHECK_MS = 5 * 60_000;

export async function rateLimit(
    identifier: string,
    type: keyof typeof RATE_LIMIT_PRESETS = "default",
    options?: Partial<RateLimitOptions>
): Promise<RateLimitResult> {
    // 安全检测：多实例部署下内存限流将失效
    // 缓存检测结果，避免每次调用都执行动态导入 + DB 查询
    const now = Date.now();
    if (!multiInstanceChecked || now - multiInstanceCheckAt > MULTI_INSTANCE_RECHECK_MS) {
        try {
            const { detectMultiInstance } = await import("@/lib/instance-check");
            await detectMultiInstance();
        } catch {
            // 检测失败不阻塞主流程
        }
        multiInstanceChecked = true;
        multiInstanceCheckAt = now;
    }

    // 启动清理定时器
    startCleanup();

    // 合并配置
    const preset = RATE_LIMIT_PRESETS[type] || DEFAULT_OPTIONS;
    const opts: RateLimitOptions = { ...preset, ...options };

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

/** 可信代理层数（从请求头最右端向左排除的代理数量）
 *
 * 生产部署要求：
 * 1. 必须配置 TRUSTED_PROXY_HOPS（例如 nginx 单层代理设 1），
 *    否则 X-Real-IP 不被信任，IP 维度限流可能不准确。
 * 2. 边缘代理（nginx）必须主动覆写而非透传客户端 IP，例如：
 *      proxy_set_header X-Real-IP $remote_addr;
 *      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 */
const TRUSTED_PROXY_HOPS = (() => {
    const raw = process.env.TRUSTED_PROXY_HOPS;
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
})();

// 启动告警：生产环境未配置可信代理时，IP 类限流/配额可被伪造头绕过
if (process.env.NODE_ENV === "production" && !process.env.TRUSTED_PROXY_HOPS) {
    console.warn(
        "[ratelimit] WARNING: TRUSTED_PROXY_HOPS is not set in production. " +
        "X-Real-IP will be ignored and IP-based rate limiting may be inaccurate. " +
        "Set TRUSTED_PROXY_HOPS and ensure the edge proxy overwrites X-Real-IP/X-Forwarded-For."
    );
}

function normalizeClientIp(ip: string): string {
    if (ip === '::1' || ip === '127.0.0.1') {
        return 'local_dev_loopback';
    }
    return ip;
}

/**
 * 获取客户端 IP 地址
 * 支持代理环境
 *
 * 优先级：
 * 1. X-Real-IP（仅在配置了 TRUSTED_PROXY_HOPS 时信任，否则客户端可直接伪造该头绕过 IP 限流）
 * 2. X-Forwarded-For：按 TRUSTED_PROXY_HOPS 从右向左取真实客户端 IP
 * 3. 未配置可信代理时，使用 X-Forwarded-For 最后一个值（离服务器最近的一跳）
 */
export function getClientIP(request: Request): string {
    if (TRUSTED_PROXY_HOPS > 0) {
        const realIp = request.headers.get("x-real-ip");
        if (realIp) {
            return normalizeClientIp(realIp.trim());
        }
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const ips = forwardedFor.split(",").map(s => s.trim()).filter(Boolean);
        if (ips.length > 0) {
            const idx = TRUSTED_PROXY_HOPS > 0
                ? Math.max(0, ips.length - TRUSTED_PROXY_HOPS - 1)
                : ips.length - 1;
            return normalizeClientIp(ips[idx]);
        }
    }

    return "unknown";
}


