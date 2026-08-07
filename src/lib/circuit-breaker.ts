/**
 * AI API 全局熔断器
 *
 * 功能：
 * 1. 连续失败 N 次后自动熔断，暂停 AI 调用一段时间
 * 2. 半开状态允许少量探测请求，验证服务是否恢复
 * 3. 内存级实现，适合单实例部署
 */

import { aiLogger } from "./logger";
import {
    CIRCUIT_FAILURE_THRESHOLD,
    CIRCUIT_COOLDOWN_MS,
    CIRCUIT_HALF_OPEN_MAX,
    CIRCUIT_FAILURE_WINDOW_MS,
} from "@/config/ai";

/** 熔断器状态 */
type CircuitState = "closed" | "open" | "half-open";

interface CircuitConfig {
    /** 连续失败次数阈值，超过后熔断 */
    failureThreshold: number;
    /** 熔断后的冷却时间（毫秒） */
    cooldownMs: number;
    /** 半开状态下允许的最大探测请求数 */
    halfOpenMaxRequests: number;
    /** 失败计数重置窗口（毫秒），超过此窗口的旧失败不计入 */
    failureWindowMs: number;
}

const DEFAULT_CONFIG: CircuitConfig = {
    failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
    cooldownMs: CIRCUIT_COOLDOWN_MS,
    halfOpenMaxRequests: CIRCUIT_HALF_OPEN_MAX,
    failureWindowMs: CIRCUIT_FAILURE_WINDOW_MS,
};

interface CircuitBreakerEntry {
    state: CircuitState;
    failures: { timestamp: number }[];
    lastFailureTime: number;
    openedAt: number;
    halfOpenCount: number;
}

class AICircuitBreaker {
    private breakers = new Map<string, CircuitBreakerEntry>();
    private config: CircuitConfig;

    constructor(config: Partial<CircuitConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * 纯查询：检查当前熔断状态是否允许请求通过（无副作用）
     */
    private checkRequestAllowed(service: string): boolean {
        const entry = this.getOrCreate(service);
        const now = Date.now();

        const activeFailures = entry.failures.filter(
            f => now - f.timestamp < this.config.failureWindowMs
        );

        switch (entry.state) {
            case "closed":
                return true;
            case "open": {
                const cooldownElapsed = now - entry.openedAt >= this.config.cooldownMs;
                return cooldownElapsed;
            }
            case "half-open":
                return entry.halfOpenCount < this.config.halfOpenMaxRequests;
            default:
                return true;
        }
    }

    /**
     * 检查是否允许通过请求（有副作用：可能触发 OPEN→HALF-OPEN 转换，递增探测计数）
     * @param service 服务标识（如 "vision-qwen", "text-deepseek"）
     * @returns true = 允许通过
     */
    allowRequest(service: string): boolean {
        const entry = this.getOrCreate(service);

        // 清理过期失败记录
        const now = Date.now();
        entry.failures = entry.failures.filter(
            f => now - f.timestamp < this.config.failureWindowMs
        );

        switch (entry.state) {
            case "closed":
                return true;
            case "open":
                // 检查冷却时间是否已过
                if (now - entry.openedAt >= this.config.cooldownMs) {
                    entry.state = "half-open";
                    entry.halfOpenCount = 0;
                    aiLogger.warn(`[CircuitBreaker] ${service}: OPEN → HALF-OPEN (probing)`);
                    return true;
                }
                return false;
            case "half-open":
                // 允许有限数量的探测请求
                if (entry.halfOpenCount < this.config.halfOpenMaxRequests) {
                    entry.halfOpenCount++;
                    return true;
                }
                return false;
            default:
                return true;
        }
    }

    /**
     * 记录成功
     */
    recordSuccess(service: string): void {
        const entry = this.getOrCreate(service);

        if (entry.state === "half-open") {
            entry.state = "closed";
            entry.failures = [];
            aiLogger.info(`[CircuitBreaker] ${service}: HALF-OPEN → CLOSED (recovered)`);
        }

        // 在 closed 状态下也清理失败计数（渐进恢复）
        if (entry.state === "closed" && entry.failures.length > 0) {
            entry.failures = [];
        }
    }

    /**
     * 记录失败
     */
    recordFailure(service: string): void {
        const entry = this.getOrCreate(service);
        const now = Date.now();

        entry.failures.push({ timestamp: now });
        entry.lastFailureTime = now;

        // 清理过期记录后重新计数
        entry.failures = entry.failures.filter(
            f => now - f.timestamp < this.config.failureWindowMs
        );

        if (
            entry.state === "closed" &&
            entry.failures.length >= this.config.failureThreshold
        ) {
            entry.state = "open";
            entry.openedAt = now;
            aiLogger.error(
                `[CircuitBreaker] ${service}: CLOSED → OPEN after ${entry.failures.length} failures`
            );
        }

        if (
            entry.state === "half-open" &&
            entry.failures.length >= this.config.failureThreshold
        ) {
            entry.state = "open";
            entry.openedAt = now;
            aiLogger.error(
                `[CircuitBreaker] ${service}: HALF-OPEN → OPEN (probe failed)`
            );
        }
    }

    /**
     * 获取熔断器状态（纯查询，无副作用，用于监控/调试）
     */
    getStatus(service: string): {
        state: CircuitState;
        failureCount: number;
        isBlocked: boolean;
    } {
        const entry = this.getOrCreate(service);
        const now = Date.now();

        const activeFailures = entry.failures.filter(
            f => now - f.timestamp < this.config.failureWindowMs
        );

        return {
            state: entry.state,
            failureCount: activeFailures.length,
            isBlocked: !this.checkRequestAllowed(service),
        };
    }

    /**
     * 手动重置熔断器
     */
    reset(service: string): void {
        this.breakers.delete(service);
        aiLogger.info(`[CircuitBreaker] ${service}: manually reset`);
    }

    private getOrCreate(service: string): CircuitBreakerEntry {
        let entry = this.breakers.get(service);
        if (!entry) {
            entry = {
                state: "closed",
                failures: [],
                lastFailureTime: 0,
                openedAt: 0,
                halfOpenCount: 0,
            };
            this.breakers.set(service, entry);
        }
        return entry;
    }
}

// 全局单例
export const circuitBreaker = new AICircuitBreaker();

export { AICircuitBreaker };
export type { CircuitState };
