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

export interface ServerErrorInfo {
    message: string;
    code?: string;
    details?: string;
    requireLogin?: boolean;
}

/** 统一解析服务端错误响应（兼容扁平 { error: string } 与 { error: { code, message, details } }） */
export function getServerErrorInfo(errorData: Record<string, unknown>, fallback: string): ServerErrorInfo {
    const topCode = typeof errorData.code === 'string' ? errorData.code : undefined;
    const requireLogin = errorData.requireLogin === true;

    if (typeof errorData.message === 'string') {
        return { message: errorData.message, code: topCode, requireLogin };
    }
    if (typeof errorData.error === 'string') {
        return { message: errorData.error, code: topCode, requireLogin };
    }
    if (errorData.error && typeof errorData.error === 'object') {
        const nested = errorData.error as Record<string, unknown>;
        const code = typeof nested.code === 'string' ? nested.code : topCode;
        const details = typeof nested.details === 'string' ? nested.details : undefined;
        if (typeof nested.message === 'string') {
            return {
                message: details ? `${nested.message}：${details}` : nested.message,
                code,
                details,
                requireLogin: requireLogin || nested.requireLogin === true,
            };
        }
        return { message: JSON.stringify(errorData.error), code, requireLogin };
    }
    if (Object.keys(errorData).length > 0) {
        return { message: JSON.stringify(errorData), code: topCode, requireLogin };
    }
    return { message: fallback, code: topCode, requireLogin };
}

export function getServerErrorMessage(errorData: Record<string, unknown>, fallback: string): string {
    return getServerErrorInfo(errorData, fallback).message;
}

/** 标记"绝不重试"错误的哨兵属性（配额/5xx 透传文案后无法再用 message 前缀判定） */
type NoRetryError = Error & { noRetry?: boolean; status?: number; code?: string };

function throwNoRetry(message: string, status?: number, code?: string): never {
    const error = new Error(message) as NoRetryError;
    error.noRetry = true;
    error.status = status;
    error.code = code;
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
            const info = getServerErrorInfo(errorData, '您已达到测试次数上限');
            throwNoRetry(info.message, res.status, info.code);
        }
        // 默认不在 5xx 时重试；调用方可显式开启（仅用于幂等、非 AI 调用）
        if (!res.ok && res.status >= 500) {
            if (retryOnServerError) {
                throw new Error(`Request failed: ${res.status}`);
            }
            // 不重试时优先透传服务端错误文案（如"报告生成失败，请点击重试"），
            // 避免用户只看到 "Request failed: 503"；文案透传后必须用哨兵标记禁止重试
            const errorData = await res.json().catch(() => ({}));
            const info = getServerErrorInfo(errorData, `服务暂时不可用（${res.status}），请稍后重试`);
            throwNoRetry(info.message, res.status, info.code);
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
