
/**
 * AI 请求队列管理器
 * 
 * 功能：
 * 1. 控制并发数量，避免 AI 服务 429 限流
 * 2. 请求排队机制，高峰期有序处理
 * 3. 提供队列状态查询，支持前端显示排队位置
 * 
 * 使用方式：
 * const result = await aiQueue.enqueue('face-analyze', () => callAI(...));
 */

import { aiLogger } from "./logger";
import {
    AI_QUEUE_MAX_CONCURRENT,
    AI_ANALYSIS_QUEUE_MAX_CONCURRENT,
    AI_VISION_QUEUE_MAX_CONCURRENT,
    AI_MAX_CONCURRENT_PER_USER,
    AI_QUEUE_MAX_LENGTH,
    AI_VISION_QUEUE_MAX_LENGTH,
} from "@/config/ai";

/**
 * 队列项
 */
interface QueueItem<T> {
    id: string;
    type: string;
    userId?: string;
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    enqueuedAt: number;
    startedAt?: number;
}

/**
 * 队列统计信息
 */
export interface QueueStats {
    /** 当前排队数量 */
    queueLength: number;
    /** 正在执行的数量 */
    runningCount: number;
    /** 最大并发数 */
    maxConcurrent: number;
    /** 预估等待时间（秒） */
    estimatedWaitSeconds: number;
    /** 当前是否繁忙 */
    isBusy: boolean;
}

/**
 * 入队返回结果
 */
export interface EnqueueResult<T> {
    /** 请求 ID */
    requestId: string;
    /** 排队位置（从 1 开始，0 表示正在执行） */
    position: number;
    /** 预估等待时间（秒） */
    estimatedWaitSeconds: number;
    /** 结果 Promise */
    promise: Promise<T>;
}

/**
 * AI 请求队列类
 */
class AIRequestQueue {
    /** 等待队列 */
    private queue: QueueItem<unknown>[] = [];

    /** 正在执行的请求数 */
    private runningCount = 0;

    /** 最大并发数 */
    private maxConcurrent: number;

    /** 单用户最大并发数 */
    private maxConcurrentPerUser: number;

    /** 每个用户正在执行的请求数 */
    private userRunningCount = new Map<string, number>();

    /** 平均执行时间（毫秒），用于估算等待时间 */
    private avgExecutionTimeMs = 40000; // 初始 40 秒，随实际执行自动校准

    /** 最近执行时间记录（用于计算平均值） */
    private executionTimes: number[] = [];

    /** 请求 ID 计数器 */
    private idCounter = 0;

    /** 存储用于释放锁的 resolver (针对 acquire/release 模式) */
    private releaseResolvers: (() => void)[] = [];

    /** 追踪已获取但未释放的槽位数，防止 double release */
    private acquireCount = 0;

    /** 最大队列长度（防止无界增长） */
    private maxQueueLength: number;

    constructor(maxConcurrent = 10, maxConcurrentPerUser = 1, maxQueueLength = 100) {
        if (typeof maxConcurrent !== 'number' || isNaN(maxConcurrent) || maxConcurrent < 1) {
            throw new Error(`[AIQueue] Invalid maxConcurrent: ${maxConcurrent}. Must be a positive integer.`);
        }
        if (typeof maxQueueLength !== 'number' || isNaN(maxQueueLength) || maxQueueLength < 1) {
            throw new Error(`[AIQueue] Invalid maxQueueLength: ${maxQueueLength}. Must be a positive integer.`);
        }
        this.maxConcurrent = Math.floor(maxConcurrent);
        this.maxConcurrentPerUser = Math.floor(maxConcurrentPerUser || 1);
        this.maxQueueLength = Math.floor(maxQueueLength);
        aiLogger.info("AI Queue initialized", {
            maxConcurrent: this.maxConcurrent,
            maxConcurrentPerUser: this.maxConcurrentPerUser,
            maxQueueLength: this.maxQueueLength,
        });
    }

    /**
     * 生成唯一请求 ID
     */
    private generateId(): string {
        return `req_${Date.now()}_${++this.idCounter}`;
    }

    /**
     * 计算预估等待时间
     */
    private estimateWaitTime(position: number): number {
        if (position === 0) return 0;

        // 预估：(排队位置 / 最大并发数) * 平均执行时间
        const waitTimeMs = (Math.ceil(position / this.maxConcurrent)) * this.avgExecutionTimeMs;
        return Math.ceil(waitTimeMs / 1000);
    }

    /**
     * 更新平均执行时间
     */
    private updateAvgExecutionTime(durationMs: number) {
        this.executionTimes.push(durationMs);
        // 只保留最近 20 条记录
        if (this.executionTimes.length > 20) {
            this.executionTimes.shift();
        }
        // 计算平均值
        this.avgExecutionTimeMs =
            this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
    }

    /**
     * 将请求加入队列
     */
    enqueue<T>(type: string, execute: () => Promise<T>, userId?: string): EnqueueResult<T> {
        const id = this.generateId();

        // 计算当前位置（始终按排队长度 + 1，避免有空位时返回 0 导致前端显示混乱）
        const position = this.queue.length + 1;

        const promise = new Promise<T>((resolve, reject) => {
            // 队列长度保护：超出上限时直接拒绝，避免内存无限增长
            if (this.queue.length >= this.maxQueueLength) {
                aiLogger.warn("Queue is full, rejecting request", {
                    type,
                    userId: userId || "anonymous",
                    queueLength: this.queue.length,
                    maxQueueLength: this.maxQueueLength,
                });
                reject(new Error(`Server busy: queue is full (max ${this.maxQueueLength})`));
                return;
            }

            const item: QueueItem<T> = {
                id,
                type,
                userId,
                execute,
                resolve: resolve as (value: unknown) => void,
                reject,
                enqueuedAt: Date.now(),
            };

            this.queue.push(item as QueueItem<unknown>);

            aiLogger.info("Request enqueued", {
                id,
                type,
                userId: userId || "anonymous",
                position: position || "executing",
                queueLength: this.queue.length,
                runningCount: this.runningCount,
            });

            // 尝试处理队列
            this.processQueue();
        });

        return {
            requestId: id,
            position,
            estimatedWaitSeconds: this.estimateWaitTime(position),
            promise,
        };
    }

    /**
     * 兼容旧版 acquire/release 模式的包装器
     * 通过 enqueue 一个挂起的任务来占用并发槽位
     *
     * @param options - timeoutMs: 队列等待超时（默认 60s）; signal: 外部 abort signal
     */
    async acquire(options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<void> {
        const timeoutMs = options?.timeoutMs ?? 60000;
        const signal = options?.signal;

        this.acquireCount++;
        return new Promise<void>((headerResolve, headerReject) => {
            let timeout: ReturnType<typeof setTimeout> | null = null;
            let resolved = false;
            let abortedOrTimedOut = false;

            const cleanup = () => {
                if (timeout) clearTimeout(timeout);
                if (signal) signal.removeEventListener('abort', onAbort);
            };

            const onAbort = () => {
                cleanup();
                // 只有在任务尚未开始执行时才减计数并拒绝；
                // 若已开始执行，由调用方的 finally / release() 负责清理
                if (!resolved) {
                    abortedOrTimedOut = true;
                    this.acquireCount = Math.max(0, this.acquireCount - 1);
                    headerReject(new Error("Queue acquire aborted by signal"));
                }
            };

            if (signal) signal.addEventListener('abort', onAbort);

            timeout = setTimeout(() => {
                cleanup();
                if (!resolved) {
                    abortedOrTimedOut = true;
                    this.acquireCount = Math.max(0, this.acquireCount - 1);
                    headerReject(new Error(`Queue acquire timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);

            this.enqueue("legacy-acquire", () => {
                // 这个 Promise 会在任务开始执行时被创建，并一直挂起直到 release() 被调用
                return new Promise<void>((done) => {
                    cleanup();

                    // 如果调用方在排队期间已经 abort/timeout，立即结束任务释放槽位，
                    // 否则 releaseResolvers 中的 done 将永远等待，导致 runningCount 泄漏。
                    if (abortedOrTimedOut || signal?.aborted) {
                        done();
                        return;
                    }

                    resolved = true;
                    // 1. 任务已开始执行，通知 acquire 调用者可以继续了
                    headerResolve();

                    // 2. 将结束任务的控制权(done)暴露给 release 方法
                    this.releaseResolvers.push(done);
                });
            }).promise.catch(err => {
                // 如果入队或执行出错
                cleanup();
                if (!resolved) {
                    this.acquireCount = Math.max(0, this.acquireCount - 1);
                    headerReject(err);
                }
            });
        });
    }

    release() {
        if (this.acquireCount <= 0) {
            aiLogger.warn("[AIQueue] release() called without matching acquire() — ignored");
            return;
        }
        this.acquireCount--;

        const done = this.releaseResolvers.shift();
        if (done) {
            done();
        } else {
            this.runningCount = Math.max(0, this.runningCount - 1);
            this.processQueue();
        }

        // 防止 releaseResolvers 泄漏：超过 100 个未消费则清理最旧的
        if (this.releaseResolvers.length > 100) {
            aiLogger.warn(`[AIQueue] releaseResolvers leak detected (${this.releaseResolvers.length}), trimming`);
            const overflow = this.releaseResolvers.splice(0, this.releaseResolvers.length - 100);
            overflow.forEach(d => d()); // 释放所有泄漏的 resolver
        }
    }

    /**
     * 处理队列
     */
    private async processQueue() {
        // 如果已达到全局并发上限或队列为空，不处理
        if (this.runningCount >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        // 查找满足用户并发限制的下一个请求
        let itemIdx = -1;
        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            const userRunning = item.userId ? (this.userRunningCount.get(item.userId) || 0) : 0;
            if (userRunning < this.maxConcurrentPerUser) {
                itemIdx = i;
                break;
            }
        }

        // 所有排队的用户都已达单用户并发上限
        if (itemIdx === -1) return;

        // 取出该请求
        const item = this.queue.splice(itemIdx, 1)[0];
        if (!item) return;

        this.runningCount++;
        if (item.userId) {
            this.userRunningCount.set(item.userId, (this.userRunningCount.get(item.userId) || 0) + 1);
        }
        item.startedAt = Date.now();

        aiLogger.info("Request started", {
            id: item.id,
            type: item.type,
            userId: item.userId || "anonymous",
            waitedMs: item.startedAt - item.enqueuedAt,
            runningCount: this.runningCount,
            userRunningCount: item.userId ? this.userRunningCount.get(item.userId) : undefined,
            queueRemaining: this.queue.length,
        });

        // 异步执行，不阻塞 processQueue 继续分发其他任务（如果有空闲槽位）
        (async () => {
            // 安全网：任务最大执行时间 (AI 调用通常 <30s，120s 留有充足余量)
            const taskTimeoutMs = item.type === 'legacy-acquire' ? 60_000 : 120_000;
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Queue task timeout after ${taskTimeoutMs}ms`)), taskTimeoutMs);
            });
            timeoutPromise.catch(() => {}); // 防止输掉的 Promise 触发 unhandled rejection

            try {
                const result = await Promise.race([item.execute(), timeoutPromise]);
                clearTimeout(timeoutId);
                const durationMs = Date.now() - (item.startedAt || 0);

                // 更新平均执行时间
                this.updateAvgExecutionTime(durationMs);

                aiLogger.info("Request completed", {
                    id: item.id,
                    type: item.type,
                    durationMs,
                    avgExecutionTimeMs: Math.round(this.avgExecutionTimeMs),
                });

                item.resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                aiLogger.error("Request failed", {
                    id: item.id,
                    type: item.type,
                    error: error instanceof Error ? error.message : "Unknown error",
                });

                item.reject(error instanceof Error ? error : new Error(String(error)));
            } finally {
                this.runningCount--;
                if (item.userId) {
                    const current = this.userRunningCount.get(item.userId) || 1;
                    if (current <= 1) {
                        this.userRunningCount.delete(item.userId);
                    } else {
                        this.userRunningCount.set(item.userId, current - 1);
                    }
                }
                // 继续处理队列中的下一个请求
                this.processQueue();
            }
        })();
    }

    /**
     * 获取请求在队列中的位置
     * @returns 位置（从 1 开始），0 表示正在执行或不在队列中
     */
    getPosition(requestId: string): number {
        const index = this.queue.findIndex(item => item.id === requestId);
        return index === -1 ? 0 : index + 1;
    }

    /**
     * 获取队列统计信息
     */
    getStats(): QueueStats {
        const queueLength = this.queue.length;
        const isBusy = this.runningCount >= this.maxConcurrent || queueLength > 0;

        return {
            queueLength,
            runningCount: this.runningCount,
            maxConcurrent: this.maxConcurrent,
            estimatedWaitSeconds: this.estimateWaitTime(queueLength),
            isBusy,
        };
    }

    /**
     * 设置最大并发数（运行时动态调整）
     */
    setMaxConcurrent(value: number) {
        if (typeof value !== 'number' || isNaN(value) || value < 1) {
            aiLogger.warn(`[AIQueue] Invalid maxConcurrent: ${value}, ignoring update.`);
            return;
        }
        this.maxConcurrent = Math.floor(value);
        aiLogger.info("Max concurrent updated", { maxConcurrent: this.maxConcurrent });
        // 尝试处理更多请求
        this.processQueue();
    }
}

// 全局单例 — 配置集中管理在 @/config/ai.ts
export const aiQueue = new AIRequestQueue(
    AI_QUEUE_MAX_CONCURRENT,
    AI_MAX_CONCURRENT_PER_USER,
    AI_QUEUE_MAX_LENGTH
); // 通用 AI 队列（check-config 等监控使用）
export const visionQueue = new AIRequestQueue(
    AI_VISION_QUEUE_MAX_CONCURRENT,
    AI_MAX_CONCURRENT_PER_USER,
    AI_VISION_QUEUE_MAX_LENGTH
); // 视觉分析并发
export const analysisQueue = new AIRequestQueue(
    AI_ANALYSIS_QUEUE_MAX_CONCURRENT,
    AI_MAX_CONCURRENT_PER_USER,
    AI_QUEUE_MAX_LENGTH
); // 综合分析并发（LLM 长文本）

// 导出类型供测试使用
export { AIRequestQueue };
