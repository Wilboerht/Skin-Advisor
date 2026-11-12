/**
 * 分析会话状态轮询/恢复（从 useAsyncAnalysis 拆出）。
 * 纯异步函数，不依赖 React；调用方传入 AbortSignal 与进度回调。
 */

export interface SessionStatusResponse {
    status: 'pending' | 'analyzing' | 'completed' | 'not_found' | 'forbidden' | 'unauthorized' | 'rate_limited' | 'transient_error';
    /** 服务端阶段：决定恢复时是否只需续跑文本分析 */
    phase?: 'pending' | 'face_analyzing' | 'face_completed' | 'text_analyzing' | 'completed';
    sessionId: string;
    result?: Record<string, unknown> | null;
    rawResult?: Record<string, unknown> | null;
    error?: string;
    /** 429 时服务端 Retry-After 的毫秒值（未提供则用默认退避） */
    retryAfterMs?: number;
}

/** 会话恢复的确定性失败（区别于 429/5xx/网络抖动等可重试错误） */
export class SessionRecoveryError extends Error {
    constructor(
        public readonly reason: 'not_found' | 'forbidden' | 'unauthorized' | 'timeout',
        message: string
    ) {
        super(message);
        this.name = 'SessionRecoveryError';
    }
}

function parseRetryAfterMs(res: Response): number | undefined {
    const raw = res.headers.get('retry-after');
    if (!raw) return undefined;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    return undefined;
}

export async function checkSessionStatus(
    sessionId: string,
    signal?: AbortSignal
): Promise<SessionStatusResponse> {
    // 单次状态查询 10s 超时：网络挂起时不能把整条恢复链路无限拖住
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener('abort', onOuterAbort, { once: true });

    try {
        const res = await fetch(`/api/advisor/session/status?sessionId=${encodeURIComponent(sessionId)}`, {
            cache: 'no-store',
            signal: controller.signal,
        });
        if (res.status === 404) {
            const data = await res.json().catch(() => ({}));
            const message = typeof data.error === 'string'
                ? data.error
                : data.error?.message || data.message || '会话不存在';
            return { status: 'not_found', sessionId, error: message };
        }
        if (res.status === 401) {
            return { status: 'unauthorized', sessionId, error: '登录状态已失效' };
        }
        if (res.status === 403) {
            return { status: 'forbidden', sessionId, error: '无权访问该会话' };
        }
        if (res.status === 429) {
            return {
                status: 'rate_limited',
                sessionId,
                retryAfterMs: parseRetryAfterMs(res),
                error: '请求过于频繁',
            };
        }
        if (!res.ok) {
            return { status: 'transient_error', sessionId, error: `HTTP ${res.status}` };
        }
        return await res.json();
    } catch (e: unknown) {
        // 调用方主动取消（页面卸载/用户离开）：向上抛，避免被误判为瞬时故障
        if (signal?.aborted) throw e;
        const err = e instanceof Error ? e : new Error(String(e));
        return { status: 'transient_error', sessionId, error: err.message };
    } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onOuterAbort);
    }
}

export async function pollSessionResult(
    sessionId: string,
    options?: {
        intervalMs?: number;
        maxAttempts?: number;
        onProgress?: (attempt: number) => void;
        signal?: AbortSignal;
    }
): Promise<SessionStatusResponse> {
    // 60 × 3s = 180s 总轮询时长，与客户端 fetch 180s 超时对齐
    const { intervalMs = 3000, maxAttempts = 60 } = options || {};
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (options?.signal?.aborted) {
            throw new Error('已取消等待');
        }
        const status = await checkSessionStatus(sessionId, options?.signal);

        if (status.status === 'completed') {
            return status;
        }
        if (status.status === 'not_found') {
            // 确定性不存在：交给调用方决定是否重建会话。不要在这里静默新建。
            throw new SessionRecoveryError('not_found', status.error || '会话不存在');
        }
        if (status.status === 'forbidden') {
            throw new SessionRecoveryError('forbidden', status.error || '无权访问该会话');
        }
        if (status.status === 'unauthorized') {
            throw new SessionRecoveryError('unauthorized', status.error || '登录状态已失效');
        }

        // pending / analyzing / rate_limited / transient_error：继续等待。
        // 429/5xx/网络抖动不能当成"会话不存在"，否则会触发重复分析/重复扣次。
        if (attempt < maxAttempts - 1) {
            options?.onProgress?.(attempt + 1);
            const waitMs = status.status === 'rate_limited'
                ? Math.max(intervalMs, status.retryAfterMs ?? intervalMs)
                : intervalMs;
            await new Promise<void>(resolve => {
                if (options?.signal?.aborted) {
                    resolve();
                    return;
                }
                const cleanup = () => {
                    options?.signal?.removeEventListener('abort', onAbort);
                };
                const onAbort = () => {
                    clearTimeout(timeoutId);
                    cleanup();
                    resolve();
                };
                const timeoutId = setTimeout(() => {
                    cleanup();
                    resolve();
                }, waitMs);
                options?.signal?.addEventListener('abort', onAbort, { once: true });
            });
        }
    }
    throw new SessionRecoveryError('timeout', '分析结果准备时间有点长，请稍后重试。');
}

/**
 * face-analyze 返回 202 时，等待面部阶段完成（不等到整份报告完成）。
 * 随后 analyze 会用服务端已持久化的 faceAnalysis 继续文本阶段。
 */
export async function waitForFaceCompleted(
    sessionId: string,
    signal?: AbortSignal
): Promise<{ completedResult?: Record<string, unknown>; faceReady: boolean }> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        if (signal?.aborted) throw new Error('已取消等待');
        const status = await checkSessionStatus(sessionId, signal);
        if (status.status === 'completed' && status.rawResult) {
            return { completedResult: status.rawResult, faceReady: true };
        }
        if (status.phase === 'face_completed' || status.phase === 'text_analyzing') {
            return { faceReady: true };
        }
        if (status.status === 'not_found') {
            // face-analyze 会 upsert 会话占位行；短暂 not_found 多为请求尚未落库，继续等。
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
        }
        if (status.status === 'forbidden' || status.status === 'unauthorized') {
            throw new Error(status.status === 'unauthorized' ? '登录状态已失效，请重新登录。' : '无权访问该会话。');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('面部分析时间较长，请稍后重试。');
}
