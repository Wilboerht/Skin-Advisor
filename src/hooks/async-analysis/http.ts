/**
 * 分析链路 HTTP 包装（从 useAsyncAnalysis 拆出）：
 * - 统一解析服务端错误文案；
 * - AI 调用默认不在 5xx 时重试，避免单次失败放大为多次扣费。
 */

import { fetchWithCsrf } from "@/lib/fetch-client";

interface FetchWithRetryOptions {
    retries?: number;
    backoff?: number;
    /** 是否允许在 5xx 服务端错误时重试；AI 调用应设为 false，避免单次失败放大为多次 AI 扣费 */
    retryOnServerError?: boolean;
}

// 统一解析服务端错误响应（兼容扁平 { error: string } 与官网 { error: { code, message } } 格式）
export function getServerErrorMessage(errorData: Record<string, unknown>, fallback: string): string {
    if (typeof errorData.message === 'string') return errorData.message;
    if (typeof errorData.error === 'string') return errorData.error;
    if (errorData.error && typeof errorData.error === 'object') {
        const nested = errorData.error as Record<string, unknown>;
        if (typeof nested.message === 'string') {
            if (typeof nested.details === 'string' && nested.details.length > 0) {
                return `${nested.message}：${nested.details}`;
            }
            return nested.message;
        }
        return JSON.stringify(errorData.error);
    }
    if (Object.keys(errorData).length > 0) return JSON.stringify(errorData);
    return fallback;
}

/** 标记"绝不重试"错误的哨兵属性（配额/5xx 透传文案后无法再用 message 前缀判定） */
type NoRetryError = Error & { noRetry?: boolean };

function throwNoRetry(message: string): never {
    const error = new Error(message) as NoRetryError;
    error.noRetry = true;
    throw error;
}

export async function fetchWithRetry(
    url: string,
    options: RequestInit,
    { retries = 1, backoff = 1000, retryOnServerError = false }: FetchWithRetryOptions = {}
): Promise<Response> {
    try {
        const res = await fetchWithCsrf(url, options);
        // 429 is a business logic rejection (usage limit), do NOT retry
        if (!res.ok && res.status === 429) {
            const errorData = await res.json().catch(() => ({}));
            throwNoRetry(getServerErrorMessage(errorData, '您已达到测试次数上限'));
        }
        // 默认不在 5xx 时重试；调用方可显式开启（仅用于幂等、非 AI 调用）
        if (!res.ok && res.status >= 500) {
            if (retryOnServerError) {
                throw new Error(`Request failed: ${res.status}`);
            }
            // 不重试时优先透传服务端错误文案（如"报告生成失败，请点击重试"），
            // 避免用户只看到 "Request failed: 503"；文案透传后必须用哨兵标记禁止重试
            const errorData = await res.json().catch(() => ({}));
            throwNoRetry(getServerErrorMessage(errorData, `服务暂时不可用（${res.status}），请稍后重试`));
        }
        return res;
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (error.name === 'AbortError' || options.signal?.aborted) {
            throw error;
        }
        if ((error as NoRetryError).noRetry) {
            throw error;
        }
        if (error.message?.includes('测试次数上限') || error.message?.includes('测试上限')) {
            throw error;
        }
        if (error.message?.includes('Request failed: 5') && !retryOnServerError) {
            throw error;
        }
        if (retries > 0) {
            console.log(`Retrying ${url}... (${retries} attempts left)`);
            await new Promise(r => setTimeout(r, backoff));
            if (options.signal?.aborted) {
                throw new Error('Request aborted');
            }
            return fetchWithRetry(url, options, { retries: retries - 1, backoff: backoff * 1.5, retryOnServerError });
        }
        throw err;
    }
}
