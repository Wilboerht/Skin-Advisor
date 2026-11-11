/**
 * 跨实例共享缓存（Redis 可选，未配置时自动回落到进程内 Map）。
 *
 * 用途：评分分布、面部分析结果缓存等需要多实例一致的数据。
 * 配置 REDIS_URL 后启用；Redis 连接失败时静默回落到内存，不阻塞业务。
 */

import Redis from "ioredis";
import { aiLogger } from "@/lib/logger";

interface MemoryEntry {
    value: string;
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
        // 冷却期内直接回落内存，避免每个请求都等待连接超时
        redisDisabledUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
        aiLogger.warn("[SharedCache] Redis error, falling back to memory", { error: String(error) });
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
        // 已有连接在跑：最多等 150ms，超时走内存，不阻塞业务请求
        await waitForConnecting();
        return (client.status as string) === "ready" ? client : null;
    }
    redisConnecting = client.connect().then(() => undefined).catch(() => undefined).finally(() => {
        redisConnecting = null;
    });
    await waitForConnecting();
    return (client.status as string) === "ready" ? client : null;
}

function memoryGet<T>(key: string): T | null {
    const entry = memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        memory.delete(key);
        return null;
    }
    try {
        return JSON.parse(entry.value) as T;
    } catch {
        memory.delete(key);
        return null;
    }
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
    // 简单容量保护，避免无 Redis 时无限增长
    if (memory.size > 500) {
        const now = Date.now();
        for (const [k, v] of memory) {
            if (v.expiresAt <= now) memory.delete(k);
        }
        if (memory.size > 500) {
            const oldest = memory.keys().next().value;
            if (oldest) memory.delete(oldest);
        }
    }
    memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** 缓存命令最多等 120ms；Redis 抖动时走内存，避免把延迟传给测肤请求 */
function withCacheTimeout<T>(promise: Promise<T>, fallback: T, ms = 120): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([promise.catch(() => fallback), timeout]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

export async function getSharedJson<T>(key: string): Promise<T | null> {
    const client = await ensureRedisConnected();
    if (client) {
        try {
            const raw = await withCacheTimeout<string | null>(client.get(key), null);
            if (raw) return JSON.parse(raw) as T;
        } catch (error) {
            aiLogger.warn("[SharedCache] Redis get failed, using memory", { key, error: String(error) });
        }
    }
    return memoryGet<T>(key);
}

export async function setSharedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    memorySet(key, raw, ttlSeconds);
    const client = await ensureRedisConnected();
    if (!client) return;
    try {
        await withCacheTimeout(client.set(key, raw, "EX", Math.max(1, Math.floor(ttlSeconds))), "OK");
    } catch (error) {
        aiLogger.warn("[SharedCache] Redis set failed", { key, error: String(error) });
    }
}

export async function deleteSharedJson(key: string): Promise<void> {
    memory.delete(key);
    const client = await ensureRedisConnected();
    if (!client) return;
    try {
        await client.del(key);
    } catch {
        // ignore
    }
}

export function getSharedCacheMode(): "redis" | "memory" {
    return process.env.REDIS_URL?.trim() ? "redis" : "memory";
}

// 启动时预热连接：避免第一个测肤请求承担 Redis 建连延迟。
// 构建阶段不连接（构建机通常没有 Redis）。
if (typeof window === "undefined"
    && process.env.REDIS_URL?.trim()
    && process.env.NEXT_PHASE !== "phase-production-build") {
    void ensureRedisConnected();
}
