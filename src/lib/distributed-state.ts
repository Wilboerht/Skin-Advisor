/**
 * 分布式状态管理（nonce / jti / 撤销列表）
 *
 * 用于替代进程内 Map，支持多实例部署：
 * - 配置 REDIS_URL 时使用 Redis SET NX EX（原子占位，自然过期）
 * - 未配置时回落到进程内 Map（单实例部署兼容）
 *
 * 设计要点：
 * - 防重放场景必须"先占位再校验"：SET NX 成功才视为首次，失败即重放
 * - Redis 故障时 fail-closed（拒绝请求），避免重放窗口
 * - 内存模式仅作为单实例降级，多实例部署必须配置 REDIS_URL
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";

interface MemoryEntry {
    expiresAt: number;
}

const memory = new Map<string, MemoryEntry>();
let redis: Redis | null = null;
let redisDisabledUntil = 0;
let redisConnecting: Promise<void> | null = null;

const REDIS_CONNECT_WAIT_MS = 150;
const REDIS_RETRY_COOLDOWN_MS = 60_000;

function getRedis(): Redis | null {
    const url = process.env.REDIS_URL?.trim();
    if (!url) return null;
    if (Date.now() < redisDisabledUntil) return null;
    if (redis) {
        const status = redis.status as string;
        if (status !== "end") return redis;
        try { redis.disconnect(); } catch { /* ignore */ }
        redis = null;
    }

    redis = new Redis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
        commandTimeout: 1500,
        retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 600)),
    });
    redis.on("error", (error) => {
        redisDisabledUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
        logger.warn("[DistributedState] Redis error, falling back to memory", { error: String(error) });
    });
    redis.on("end", () => {
        redisDisabledUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
    });
    return redis;
}

async function waitForConnecting(): Promise<void> {
    if (!redisConnecting) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            redisConnecting,
            new Promise<void>((resolve) => {
                timer = setTimeout(resolve, REDIS_CONNECT_WAIT_MS);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function ensureRedisConnected(): Promise<Redis | null> {
    const client = getRedis();
    if (!client) return null;
    const status = client.status as string;
    if (status === "ready") return client;
    if (redisConnecting) {
        await waitForConnecting();
        return (client.status as string) === "ready" ? client : null;
    }
    redisConnecting = client.connect().then(() => undefined).catch(() => undefined).finally(() => {
        redisConnecting = null;
    });
    await waitForConnecting();
    return (client.status as string) === "ready" ? client : null;
}

function memoryConsume(key: string, ttlMs: number): boolean {
    const now = Date.now();
    // 清理过期条目
    for (const [k, v] of memory) {
        if (v.expiresAt <= now) memory.delete(k);
    }
    if (memory.has(key)) return false;
    memory.set(key, { expiresAt: now + ttlMs });
    // 容量保护：最多 10000 条，超出淘汰最旧
    if (memory.size > 10000) {
        const oldest = memory.keys().next().value;
        if (oldest) memory.delete(oldest);
    }
    return true;
}

/**
 * 原子消费一个一次性标识（nonce / jti）。
 * 返回 true 表示首次使用（允许继续），false 表示已存在（重放，拒绝）。
 *
 * @param namespace 命名空间（如 "internal-nonce"、"admin-sso-jti"）
 * @param id 唯一标识
 * @param ttlMs 过期时间（毫秒），应大于标识本身有效期
 */
export async function consumeOnce(
    namespace: string,
    id: string,
    ttlMs: number
): Promise<boolean> {
    const key = `ds:${namespace}:${id}`;
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    const client = await ensureRedisConnected();
    if (client) {
        try {
            // SET NX EX：原子占位，已存在则返回 null
            const result = await client.set(key, "1", "EX", ttlSeconds, "NX");
            return result === "OK";
        } catch (error) {
            // Redis 故障时 fail-closed：无法确认是否重放，拒绝请求
            logger.error("[DistributedState] Redis consumeOnce failed, rejecting", {
                namespace,
                error: String(error),
            });
            return false;
        }
    }

    // 无 Redis：单实例内存模式
    return memoryConsume(key, ttlMs);
}

/**
 * 检查标识是否已存在（不消费）。
 * 仅用于只读检查场景；防重放请使用 consumeOnce。
 */
export async function exists(namespace: string, id: string): Promise<boolean> {
    const key = `ds:${namespace}:${id}`;
    const client = await ensureRedisConnected();
    if (client) {
        try {
            const result = await client.exists(key);
            return result === 1;
        } catch {
            return true; // fail-closed
        }
    }
    const entry = memory.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
        memory.delete(key);
        return false;
    }
    return true;
}

/**
 * 删除标识（用于业务失败时释放，允许重试）。
 */
export async function release(namespace: string, id: string): Promise<void> {
    const key = `ds:${namespace}:${id}`;
    memory.delete(key);
    const client = await ensureRedisConnected();
    if (!client) return;
    try {
        await client.del(key);
    } catch {
        // ignore
    }
}

export function getDistributedStateMode(): "redis" | "memory" {
    return process.env.REDIS_URL?.trim() ? "redis" : "memory";
}
