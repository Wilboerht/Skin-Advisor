/**
 * AI API Key 健康管理
 *
 * 功能：
 * 1. 跟踪每个 Key 的连续失败/限流次数
 * 2. 对异常 Key 进行短期冷却，避免在单个 Key 失效时反复调用产生费用
 * 3. 提供 key 选择接口，优先返回健康 key
 *
 * 注意：此为进程内实现，适用于单实例部署；多实例/生产级场景建议使用外部 Secret Manager + 统一状态。
 */

import { aiLogger } from "./logger";

interface KeyHealthEntry {
    failCount: number;
    rateLimitCount: number;
    lastFailureAt: number;
    cooledUntil: number;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 连续失败后冷却 5 分钟，避免 429 风暴每分钟重试
const MAX_FAILURES_BEFORE_COOLDOWN = 3; // 连续 3 次失败进入冷却
const MAX_RATE_LIMITS_BEFORE_COOLDOWN = 2; // 连续 2 次 429 进入冷却

const keyHealthMap = new Map<string, KeyHealthEntry>();

function getKeyFingerprint(provider: string, apiKey: string): string {
    // 仅取前 4 + 后 4 位，减少密钥暴露面
    const visible = apiKey.length > 10 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "short";
    return `${provider}:${visible}`;
}

function getOrCreateEntry(fingerprint: string): KeyHealthEntry {
    let entry = keyHealthMap.get(fingerprint);
    if (!entry) {
        entry = {
            failCount: 0,
            rateLimitCount: 0,
            lastFailureAt: 0,
            cooledUntil: 0,
        };
        keyHealthMap.set(fingerprint, entry);
    }
    return entry;
}

/**
 * 标记一次 Key 调用结果
 */
export function recordKeyResult(
    provider: string,
    apiKey: string,
    result: { success: boolean; isRateLimit?: boolean; isAuthError?: boolean }
): void {
    const fingerprint = getKeyFingerprint(provider, apiKey);
    const entry = getOrCreateEntry(fingerprint);
    const now = Date.now();

    if (result.success) {
        entry.failCount = 0;
        entry.rateLimitCount = 0;
        entry.cooledUntil = 0;
        return;
    }

    entry.failCount++;
    entry.lastFailureAt = now;

    if (result.isRateLimit) {
        entry.rateLimitCount++;
    }

    const shouldCooldown =
        entry.failCount >= MAX_FAILURES_BEFORE_COOLDOWN ||
        entry.rateLimitCount >= MAX_RATE_LIMITS_BEFORE_COOLDOWN ||
        result.isAuthError;

    if (shouldCooldown) {
        entry.cooledUntil = now + COOLDOWN_MS;
        aiLogger.warn(`[AIKeyHealth] Key ${fingerprint} cooled down for ${COOLDOWN_MS}ms due to ${result.isAuthError ? 'auth error' : result.isRateLimit ? 'rate limit' : 'failures'}`);
    }
}

/**
 * 从 key 列表中筛选出当前健康的 key
 */
export function filterHealthyKeys(provider: string, apiKeys: string[]): string[] {
    const now = Date.now();
    return apiKeys.filter((key) => {
        const fingerprint = getKeyFingerprint(provider, key);
        const entry = keyHealthMap.get(fingerprint);
        if (!entry) return true;
        if (entry.cooledUntil > now) {
            return false;
        }
        return true;
    });
}

/**
 * 获取 key 健康状态（用于监控/调试）
 */
export function getKeyHealthStatus(): Record<string, Omit<KeyHealthEntry, "cooledUntil"> & { cooledUntil?: number; isCoolingDown: boolean }> {
    const now = Date.now();
    const result: Record<string, Omit<KeyHealthEntry, "cooledUntil"> & { cooledUntil?: number; isCoolingDown: boolean }> = {};
    keyHealthMap.forEach((entry, fingerprint) => {
        const isCoolingDown = entry.cooledUntil > now;
        result[fingerprint] = {
            failCount: entry.failCount,
            rateLimitCount: entry.rateLimitCount,
            lastFailureAt: entry.lastFailureAt,
            ...(isCoolingDown ? { cooledUntil: entry.cooledUntil } : {}),
            isCoolingDown,
        };
    });
    return result;
}
