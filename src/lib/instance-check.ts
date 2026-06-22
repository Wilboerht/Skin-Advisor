/**
 * 多实例部署检测模块
 *
 * 用途：检测当前是否运行了多个应用实例。如果是，则告警提示内存限流将失效。
 * 原理：每个实例启动时在 AppInstance 表中注册自己，并定期更新心跳。
 *       rateLimit() 调用时检查活跃实例数量，>1 则输出严重告警。
 */

import prisma from "@/lib/prisma";
import { hostname as getHostname } from "os";

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 分钟更新一次心跳
const INSTANCE_TIMEOUT_MS = 3 * 60_000; // 3 分钟无心跳视为离线
const ALERT_COOLDOWN_MS = 5 * 60_000; // 同一告警冷却 5 分钟

let instanceId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastAlertTime = 0;
let hasWarned = false;

// 缓存活跃实例数，避免每次限流都查询数据库
let cachedInstanceCount: number | null = null;
let cachedInstanceCountAt = 0;
const INSTANCE_COUNT_CACHE_MS = 30_000;

function generateInstanceId(): string {
    const hostname = typeof process !== "undefined" ? process.env.HOSTNAME || getHostname() : "unknown";
    const pid = typeof process !== "undefined" ? process.pid : 0;
    const ts = Date.now();
    return `${hostname}-${pid}-${ts}`;
}

/**
 * 注册当前实例到数据库
 */
export async function registerInstance(): Promise<void> {
    if (instanceId) return; // 已注册

    instanceId = generateInstanceId();

    try {
        await prisma.appInstance.upsert({
            where: { id: instanceId },
            update: { lastPing: new Date(), metadata: buildMetadata() },
            create: {
                id: instanceId,
                startedAt: new Date(),
                lastPing: new Date(),
                metadata: buildMetadata(),
            },
        });

        // 启动心跳
        startHeartbeat();

        // 清理过期的实例记录（其他进程可能已崩溃未注销）
        await cleanupStaleInstances();

        console.log(`[InstanceCheck] Registered instance: ${instanceId}`);
    } catch (error) {
        console.error("[InstanceCheck] Failed to register instance:", error);
    }
}

/**
 * 注销当前实例（优雅关闭时调用）
 */
export function stopHeartbeat(): void {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

export async function unregisterInstance(): Promise<void> {
    if (!instanceId) return;

    stopHeartbeat();

    try {
        await prisma.appInstance.delete({ where: { id: instanceId } });
        console.log(`[InstanceCheck] Unregistered instance: ${instanceId}`);
    } catch {
        // 忽略删除失败（可能已被清理任务删除）
    }

    instanceId = null;
}

/**
 * 检查当前活跃实例数量
 */
export async function getActiveInstanceCount(): Promise<number> {
    const now = Date.now();
    if (cachedInstanceCount !== null && now - cachedInstanceCountAt < INSTANCE_COUNT_CACHE_MS) {
        return cachedInstanceCount;
    }

    const cutoff = new Date(Date.now() - INSTANCE_TIMEOUT_MS);
    try {
        const count = await prisma.appInstance.count({
            where: { lastPing: { gte: cutoff } },
        });
        cachedInstanceCount = count;
        cachedInstanceCountAt = now;
        return count;
    } catch {
        return 1; // 如果查询失败，保守返回 1
    }
}

/**
 * 检测多实例并告警
 * 在 rateLimit() 中调用，发现多实例时输出严重告警
 */
export async function detectMultiInstance(): Promise<void> {
    // 非生产环境跳过检测（减少开发噪音）
    if (process.env.NODE_ENV !== "production") return;

    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;

    const count = await getActiveInstanceCount();
    if (count > 1 && !hasWarned) {
        hasWarned = true;
        lastAlertTime = now;
        console.error(
            `\n` +
            `🔴🔴🔴 SECURITY WARNING 🔴🔴🔴\n` +
            `[InstanceCheck] 检测到 ${count} 个活跃的应用实例同时运行！\n` +
            `当前基于内存的 rateLimit 在多实例环境下完全失效。\n` +
            `攻击者可在每个实例上独立达到限流上限。\n` +
            `建议立即采取以下措施之一：\n` +
            `  1. 降级为单实例部署（PM2 fork mode, instances: 1）\n` +
            `  2. 引入 Redis / Upstash Redis 作为分布式限流存储\n` +
            `  3. 使用 @upstash/ratelimit 替代内存 Map 实现\n` +
            `🔴🔴🔴 SECURITY WARNING 🔴🔴🔴\n`
        );
    }
}

function buildMetadata(): string {
    return JSON.stringify({
        hostname: typeof process !== "undefined" ? process.env.HOSTNAME || getHostname() : "unknown",
        pid: typeof process !== "undefined" ? process.pid : 0,
        nodeEnv: process.env.NODE_ENV,
        nodeVersion: process.version,
    });
}

export function startHeartbeat(): void {
    if (heartbeatTimer) return;

    heartbeatTimer = setInterval(async () => {
        if (!instanceId) return;
        try {
            await prisma.appInstance.update({
                where: { id: instanceId },
                data: { lastPing: new Date() },
            });
        } catch {
            // 心跳更新失败不致命，下次重试
        }
    }, HEARTBEAT_INTERVAL_MS);
}

async function cleanupStaleInstances(): Promise<void> {
    const cutoff = new Date(Date.now() - INSTANCE_TIMEOUT_MS);
    try {
        const { count } = await prisma.appInstance.deleteMany({
            where: { lastPing: { lt: cutoff } },
        });
        if (count > 0) {
            console.log(`[InstanceCheck] Cleaned up ${count} stale instance(s)`);
        }
    } catch {
        // 忽略清理失败
    }
}
