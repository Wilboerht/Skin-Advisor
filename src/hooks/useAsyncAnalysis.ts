
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAdvisorAnalytics } from './useAdvisorAnalytics';
import { useAuth } from './useAuth';
import { fetchWithCsrf } from '@/lib/fetch-client';
import { preprocessFaceImage } from '@/lib/image-processing';

import { getPrivacyConsentPayload } from '@/components/advisor/PrivacyConsent';
import { STORAGE_KEYS } from '@/lib/storage-keys';

export interface AsyncAnalysisState {
    status: 'idle' | 'preparing' | 'analyzing_face' | 'analyzing_skin' | 'completed' | 'error';
    progress: number;
    error: string | null;
    queuePosition?: number;
    queueWaitSeconds?: number;
}

export interface SessionStatusResponse {
    status: 'pending' | 'analyzing' | 'completed' | 'not_found' | 'forbidden';
    sessionId: string;
    result?: Record<string, unknown> | null;
    rawResult?: Record<string, unknown> | null;
    error?: string;
}

const ANALYSIS_LOCK_TTL_MS = 90 * 1000;

function acquireAnalysisLock(sessionId: string): boolean {
    try {
        const existing = sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
        const existingData = existing ? JSON.parse(existing) as { sessionId: string; startedAt: number } : null;
        if (existingData && existingData.sessionId !== sessionId && (Date.now() - existingData.startedAt) < ANALYSIS_LOCK_TTL_MS) {
            return false;
        }
        sessionStorage.setItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK, JSON.stringify({ sessionId, startedAt: Date.now() }));
        return true;
    } catch (e) {
        console.warn('sessionStorage access failed', e);
        return true; // 若无法写入锁，不阻塞分析流程
    }
}

function releaseAnalysisLock(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
    } catch (e) {
        console.warn('sessionStorage access failed', e);
    }
}

export function getAnalysisLock(): { sessionId: string; startedAt: number } | null {
    try {
        const existing = sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
        if (!existing) return null;
        const data = JSON.parse(existing) as { sessionId: string; startedAt: number };
        if (Date.now() - data.startedAt >= ANALYSIS_LOCK_TTL_MS) {
            sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('sessionStorage access failed', e);
        return null;
    }
}

interface FetchWithRetryOptions {
    retries?: number;
    backoff?: number;
    /** 是否允许在 5xx 服务端错误时重试；AI 调用应设为 false，避免单次失败放大为多次 AI 扣费 */
    retryOnServerError?: boolean;
}

// 统一解析服务端错误响应（兼容扁平 { error: string } 与官网 { error: { code, message } } 格式）
function getServerErrorMessage(errorData: Record<string, unknown>, fallback: string): string {
    if (typeof errorData.message === 'string') return errorData.message;
    if (typeof errorData.error === 'string') return errorData.error;
    if (errorData.error && typeof errorData.error === 'object') {
        const nested = errorData.error as Record<string, unknown>;
        if (typeof nested.message === 'string') return nested.message;
        return JSON.stringify(errorData.error);
    }
    if (Object.keys(errorData).length > 0) return JSON.stringify(errorData);
    return fallback;
}

// Helper for auto-retry
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    { retries = 1, backoff = 1000, retryOnServerError = false }: FetchWithRetryOptions = {}
): Promise<Response> {
    try {
        const res = await fetchWithCsrf(url, options);
        // 429 is a business logic rejection (usage limit), do NOT retry
        if (!res.ok && res.status === 429) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(getServerErrorMessage(errorData, '您已达到测试次数上限'));
        }
        // 默认不在 5xx 时重试；调用方可显式开启（仅用于幂等、非 AI 调用）
        if (!res.ok && res.status >= 500) {
            throw new Error(`Request failed: ${res.status}`);
        }
        return res;
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        // Do NOT retry on AbortError (user cancelled or timeout)
        if (error.name === 'AbortError' || options.signal?.aborted) {
            throw error;
        }
        // Do NOT retry usage-limit errors (429)
        if (error.message?.includes('测试次数上限') || error.message?.includes('测试上限')) {
            throw error;
        }
        // 5xx 错误且未开启 retryOnServerError 时直接抛出
        if (error.message?.includes('Request failed: 5') && !retryOnServerError) {
            throw error;
        }
        if (retries > 0) {
            console.log(`Retrying ${url}... (${retries} attempts left)`);
            await new Promise(r => setTimeout(r, backoff));
            // Check again before retry in case signal was aborted during backoff
            if (options.signal?.aborted) {
                throw new Error('Request aborted');
            }
            return fetchWithRetry(url, options, { retries: retries - 1, backoff: backoff * 1.5, retryOnServerError });
        }
        throw err;
    }
}

export function useAsyncAnalysis() {
    const [analysisState, setAnalysisState] = useState<AsyncAnalysisState>({
        status: 'idle',
        progress: 0,
        error: null
    });
    const { trackAnalysisStart, trackAnalysisComplete } = useAdvisorAnalytics();
    const { user } = useAuth();

    const isRunningRef = useRef(false);

    // --- Session recovery helpers ---

    const checkSessionStatus = useCallback(async (sessionId: string): Promise<SessionStatusResponse> => {
        try {
            const res = await fetch(`/api/advisor/session/status?sessionId=${encodeURIComponent(sessionId)}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                return {
                    status: 'not_found',
                    sessionId,
                    error: data.error || `HTTP ${res.status}`
                };
            }
            return await res.json();
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            return { status: 'not_found', sessionId, error: err.message };
        }
    }, []);

    const pollSessionResult = useCallback(async (
        sessionId: string,
        options?: {
            intervalMs?: number;
            maxAttempts?: number;
            onProgress?: (attempt: number) => void;
            signal?: AbortSignal;
        }
    ): Promise<SessionStatusResponse> => {
        const { intervalMs = 3000, maxAttempts = 30 } = options || {};
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (options?.signal?.aborted) {
                throw new Error('已取消等待');
            }
            const status = await checkSessionStatus(sessionId);
            if (status.status === 'completed') {
                return status;
            }
            if (status.status === 'not_found' || status.status === 'forbidden') {
                throw new Error(status.error || '会话不存在或无权访问');
            }
            if (attempt < maxAttempts - 1) {
                options?.onProgress?.(attempt + 1);
                await new Promise(resolve => {
                    const timeoutId = setTimeout(resolve, intervalMs);
                    options?.signal?.addEventListener('abort', () => {
                        clearTimeout(timeoutId);
                        resolve(undefined);
                    }, { once: true });
                });
            }
        }
        throw new Error('分析结果准备时间有点长，请重试一次。');
    }, [checkSessionStatus]);

    const runAnalysis = useCallback(async () => {
        // 并发保护：防止双击或重渲染导致多个分析流程竞争
        if (isRunningRef.current) {
            console.warn('[useAsyncAnalysis] Analysis already in progress, ignoring duplicate call');
            return;
        }
        isRunningRef.current = true;

        setAnalysisState({ status: 'preparing', progress: 2, error: null, queuePosition: undefined, queueWaitSeconds: undefined });
        trackAnalysisStart();

        // 共享 AbortController：超时或组件卸载时统一取消所有未完成的请求
        const abortController = new AbortController();

        const createTimeoutPromise = () => {
            let timeoutId: ReturnType<typeof setTimeout>;
            const promise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    abortController.abort();
                    reject(new Error("分析时间较长，请检查网络后重试。"));
                }, 180 * 1000); // 180 秒，服务端 maxDuration=90s，队列场景需更充裕
            });
            return { promise, cancel: () => clearTimeout(timeoutId) };
        };

        const { promise: timeoutPromise, cancel: cancelTimeout } = createTimeoutPromise();

        const analysisPromise = async () => {
            let answersStr: string | null = null;
            let nickname = "您";
            try {
                answersStr = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
                nickname = localStorage.getItem(STORAGE_KEYS.ADVISOR_NICKNAME) || user?.name || "您";
            } catch (e) {
                console.warn("localStorage access failed", e);
            }

            if (!answersStr) {
                throw new Error("答题数据缺失，请重新填写问卷");
            }
            const answers = JSON.parse(answersStr);

            // Pre-generate sessionId and nickname for analysis
            // 性别不一致免费重试场景：复用原 sessionId，让后端识别为同一会话的免费重试
            // 仅在有免费重试标记时才读取，避免残留的旧 sessionId 被普通测试复用
            let isFreeRetryEarly = false;
            try {
                isFreeRetryEarly = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY) === "true";
            } catch (e) {
                console.warn("localStorage access failed", e);
            }
            let freeRetrySessionId: string | null = null;
            if (isFreeRetryEarly) {
                try {
                    freeRetrySessionId = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID);
                } catch (e) {
                    console.warn("localStorage access failed", e);
                }
            }

            // 刷新页面时复用正在分析中的 sessionId，避免重复扣费/重复生成新会话
            // sessionStorage（标签页内刷新）+ localStorage 持久备份（关闭标签页后重新打开可恢复）
            const ANALYZING_TTL_MS = 80 * 1000;
            let analyzingSessionId: string | null = null;
            let analyzingStartedAt = 0;
            try {
                analyzingSessionId = sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID);
                analyzingStartedAt = Number(sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT) || '0');
            } catch (e) {
                console.warn("sessionStorage access failed", e);
            }
            // sessionStorage 为空时尝试从 localStorage 恢复（关闭标签页后场景）
            if (!analyzingSessionId) {
                try {
                    const localEntry = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_LOCAL);
                    if (localEntry) {
                        const parsed = JSON.parse(localEntry);
                        if (parsed.sessionId && (Date.now() - parsed.startedAt) < ANALYZING_TTL_MS) {
                            analyzingSessionId = parsed.sessionId;
                            analyzingStartedAt = parsed.startedAt;
                        }
                    }
                } catch {
                    // localStorage parse failed, ignore
                }
            }
            const isAnalyzingSessionValid = analyzingSessionId && (Date.now() - analyzingStartedAt) < ANALYZING_TTL_MS;

            const sessionId = freeRetrySessionId
                || (isAnalyzingSessionValid ? analyzingSessionId : null)
                || crypto.randomUUID();

            // 获取全局分析锁，防止组件 unmount/remount 或 StrictMode 双 mount 导致重复分析
            if (!acquireAnalysisLock(sessionId)) {
                console.warn(`[useAsyncAnalysis] Analysis lock already held for another session, skipping`);
                // 设置错误状态让 ResultClient 感知并显示重试按钮，而非永久停留在 preparing 状态
                setAnalysisState({ status: 'error', progress: 0, error: '上一次分析还在进行中，请稍候，完成后将自动展示结果。' });
                return;
            }

            // 记录本次分析中的 sessionId，供刷新页面时复用
            if (!freeRetrySessionId) {
                try {
                    sessionStorage.setItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID, sessionId);
                    sessionStorage.setItem(STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT, String(Date.now()));
                    // 同步持久化到 localStorage（关闭标签页后仍可恢复）
                    localStorage.setItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_LOCAL, JSON.stringify({
                        sessionId,
                        startedAt: Date.now(),
                    }));
                } catch (e) {
                    console.warn("sessionStorage/localStorage access failed", e);
                }
            }

            // 1. Face Analysis
            let faceAnalysis = null;

            // Use advisorStorage to get images (supports IndexedDB)
            const { advisorStorage } = await import("@/lib/advisor-storage");
            const rawImages = await advisorStorage.getFaceImages();
            const processedImages = await advisorStorage.getProcessedImages();

            // 合并：预处理有的用预处理的，没有的用原始的
            const images = rawImages ? {
                front: processedImages?.front || rawImages.front,
                left: processedImages?.left || rawImages.left,
                right: processedImages?.right || rawImages.right,
                chin: processedImages?.chin || rawImages.chin,
            } : processedImages;

            // if (imagesStr) { -> Handled by checking if images is not null
            if (images) {
                // 阶段切换时给一个即时跳跃，让用户感知到进展
                setAnalysisState(prev => ({ ...prev, status: 'analyzing_face', progress: Math.max(prev.progress, 25) }));
                
                if (images && images.front) {
                    const visionImages = [];
                    // Preprocess all available angles
                    const angles: Array<{ key: 'front' | 'left' | 'right' | 'chin'; label: string }> = [
                        { key: 'front', label: 'front' },
                        { key: 'left', label: 'left' },
                        { key: 'right', label: 'right' },
                        { key: 'chin', label: 'chin' },
                    ];

                    // 1. Parallel preprocessing (skip already small images)
                    const preprocessResults = await Promise.all(
                        angles.map(async ({ key, label }) => {
                            const imgData = images[key];
                            if (!imgData) return null;

                            try {
                                let finalData = imgData;
                                // Always preprocess base64 images to keep payload small,
                                // even if they are already under 300KB.
                                if (finalData.startsWith('data:')) {
                                    const processed = await preprocessFaceImage(imgData);
                                    finalData = processed.imageData;
                                }
                                return { key, label, finalData, originalData: imgData, needsUpload: finalData.startsWith('data:') };
                            } catch (e) {
                                console.warn(`Preprocessing failed for ${label}`, e);
                                return { key, label, finalData: imgData, originalData: imgData, needsUpload: imgData.startsWith('data:') };
                            }
                        })
                    );

                    const validResults = preprocessResults.filter((r): r is NonNullable<typeof r> => r !== null);

                    // 2. 根据网络状况决定上传策略（弱网减少上传数量）
                    const conn = (navigator as unknown as Record<string, unknown>).connection as Record<string, unknown> | undefined;
                    const networkType = conn?.effectiveType as string | undefined;

                    const shouldUploadAngle = (key: string): boolean => {
                        if (key === 'front') return true; // 正脸始终上传
                        if (!networkType || networkType === '4g') return true; // 好网络或检测不到，全传
                        if (networkType === '3g') return key === 'left'; // 3g 只传正脸+左侧
                        return false; // 2g / slow-2g 只传正脸
                    };

                    const uploadResults = await Promise.all(
                        validResults.map(async (result) => {
                            if (!result.needsUpload) return result; // Already a URL

                            // 弱网跳过非必要角度，直接用 base64
                            if (!shouldUploadAngle(result.key)) {
                                console.log(`[Network] Skipping upload for ${result.label} (${networkType}), using base64`);
                                return result;
                            }

                            try {
                                const { uploadImage } = await import("@/lib/upload-client");
                                const blob = await (await fetch(result.finalData)).blob();
                                const url = await uploadImage(blob, `face-${result.label}.jpg`);
                                if (url) {
                                    console.log(`Uploaded ${result.label} to cloud storage:`, url);
                                    return { ...result, finalData: url };
                                }
                            } catch (uploadError) {
                                console.warn(`Cloud upload failed for ${result.label}, using base64`, uploadError);
                            }
                            return result;
                        })
                    );

                    // 3. Assemble vision images
                    const MAX_VISION_IMAGES = 4;
                    const MAX_IMAGE_BASE64_CHARS = 2_000_000; // 约 1.5MB 原始数据
                    for (const result of uploadResults) {
                        // 跳过过大的图片（前端预处理应已将单张控制在 300KB 以内，此处为兜底）
                        if (result.finalData.length > MAX_IMAGE_BASE64_CHARS) {
                            console.warn(`[useAsyncAnalysis] Skipping oversized image for ${result.label}`);
                            continue;
                        }
                        visionImages.push({ data: result.finalData, angle: result.label });
                        if (visionImages.length >= MAX_VISION_IMAGES) break;
                    }

                    if (visionImages.length > 0) {
                        // 面部分析服务端超时 55s，客户端单独设置 60s 超时，避免服务端已放弃后客户端空等 90s
                        const faceAnalyzeAbort = new AbortController();
                        const faceAnalyzeTimeout = setTimeout(() => faceAnalyzeAbort.abort(), 60 * 1000);
                        const onTotalAbort = () => faceAnalyzeAbort.abort();
                        abortController.signal.addEventListener('abort', onTotalAbort);

                        try {
                            // AI 视觉调用：不在 5xx 时自动重试，避免单次失败放大为多次扣费
                            const faceRes = await fetchWithRetry("/api/advisor/face-analyze", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ sessionId, images: visionImages }),
                                signal: faceAnalyzeAbort.signal
                            }, { retries: 0 });

                            if (faceRes.ok) {
                                faceAnalysis = await faceRes.json();
                                // 读取队列状态（如果系统繁忙，告诉用户）
                                const qp = faceRes.headers.get("X-Queue-Position");
                                const qw = faceRes.headers.get("X-Queue-Wait-Seconds");
                                if (qp) {
                                    setAnalysisState(prev => ({
                                        ...prev,
                                        queuePosition: parseInt(qp, 10) || 0,
                                        queueWaitSeconds: qw ? parseInt(qw, 10) : undefined
                                    }));
                                }
                            } else {
                                // fetchWithRetry should have handled 5xx/429, so this is for other client errors (4xx)
                                const errorData = await faceRes.json().catch(() => ({}));
                                console.warn("Face analysis API failed", faceRes.status, errorData);

                                // Specific error messages for known status codes not handled by retry
                                if (faceRes.status === 429) { // This case should ideally be caught by fetchWithRetry, but kept for explicit handling if needed
                                    throw new Error("当前排队人数较多，请稍后再试。");
                                }
                                if (faceRes.status === 503 || faceRes.status === 504) { // This case should ideally be caught by fetchWithRetry
                                    throw new Error("AI 服务暂时繁忙，请稍后重试");
                                }
                                throw new Error(getServerErrorMessage(errorData, "面部分析未完成"));
                            }
                        } catch (e: unknown) {
                            const err = e as Error;
                            console.error("Face analysis fetch failed", e);
                            if (err.name === 'AbortError') {
                                throw new Error("面部分析时间较长，请稍后重试。");
                            }
                            // Check if the error is from fetchWithRetry's specific message
                            if (err.message.includes("Request failed: 429")) {
                                throw new Error("请求过于频繁，请稍后重试");
                            }
                            if (err.message.includes("Request failed: 5")) {
                                throw new Error("AI 服务暂时繁忙，请稍后重试");
                            }
                            if (err.message.includes("Failed to fetch")) {
                                throw new Error("网络连接异常，请检查网络后重试");
                            }
                            throw e; // Rethrow to stop the process and show error state
                        } finally {
                            clearTimeout(faceAnalyzeTimeout);
                            abortController.signal.removeEventListener('abort', onTotalAbort);
                        }
                    }
                }
            }

            // 面部分析完成 → 推进进度条（同时切换到下一阶段，合并更新减少 re-render）
            if (faceAnalysis) {
                setAnalysisState(prev => ({ ...prev, status: 'analyzing_skin', progress: Math.max(prev.progress, 65) }));
            } else {
                setAnalysisState(prev => ({ ...prev, status: 'analyzing_skin', progress: Math.max(prev.progress, 55) }));
            }

            // 2. Comprehensive Analysis (Text)

            // isFreeRetry already determined above (moved before sessionId generation to avoid stale sessionId reuse)
            const isFreeRetry = isFreeRetryEarly;
            // NOTE: Do NOT clear localStorage here — only clear after server confirms success

            const privacyConsent = getPrivacyConsentPayload();
            // AI 综合分析调用：不在 5xx 时自动重试，避免单次失败放大为多次扣费
            const analyzeRes = await fetchWithRetry("/api/advisor/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    answers,
                    faceAnalysis: faceAnalysis || undefined,
                    sessionId: sessionId,
                    nickname: nickname,
                    privacyConsent,
                    ...(isFreeRetry ? { freeRetry: true } : {})
                }),
                signal: abortController.signal
            }, { retries: 0 });

            // 读取队列状态
            const qp = analyzeRes.headers.get("X-Queue-Position");
            const qw = analyzeRes.headers.get("X-Queue-Wait-Seconds");
            if (qp) {
                setAnalysisState(prev => ({
                    ...prev,
                    queuePosition: parseInt(qp, 10) || 0,
                    queueWaitSeconds: qw ? parseInt(qw, 10) : undefined
                }));
            }

            // 服务端已响应，快速推进进度让用户感知到进展
            setAnalysisState(prev => ({ ...prev, progress: 90 }));

            let result: Record<string, unknown> | undefined;

            if (analyzeRes.status === 202) {
                // 服务端提示已有其他请求在分析同一 session，进入轮询等待
                const pollResult = await pollSessionResult(sessionId, {
                    onProgress: (attempt) => {
                        setAnalysisState(prev => ({ ...prev, progress: Math.min(85, 55 + attempt * 1) }));
                    },
                    signal: abortController.signal
                });
                if (pollResult.status !== 'completed' || !pollResult.rawResult) {
                    throw new Error('分析等待超时，建议重试一次。');
                }
                result = pollResult.rawResult;
            } else {
                if (!analyzeRes.ok) {
                    // 解析服务端错误信息，透传给用户
                    let serverError = "分析未完成，请重试。";
                    try {
                        const errorData = await analyzeRes.json();
                        serverError = getServerErrorMessage(errorData, serverError);
                    } catch {
                        serverError = "当前访问人数较多，请稍后再试。";
                    }
                    throw new Error(serverError);
                }

                result = await analyzeRes.json();
            }

            if (!result) {
                throw new Error('未获取到分析结果，请重试一次。');
            }

            if (faceAnalysis && !result.faceAnalysis) {
                result.faceAnalysis = faceAnalysis;
            }

            // Save Result (include sessionId for sharing recovery)
            result.sessionId = sessionId;
            try {
                localStorage.setItem(STORAGE_KEYS.ADVISOR_RESULT, JSON.stringify(result));
            } catch (e) {
                console.warn("Failed to save full result to localStorage, attempting stripped save", e);
                // 配额满了：只保留关键字段（移除大体积的 labAnalysis 和 faceAnalysis 详情），保证基本展示可用
                try {
                    const stripped = {
                        ...result,
                        faceAnalysis: result.faceAnalysis ? {
                            skinType: (result.faceAnalysis as Record<string, unknown>)?.skinType,
                            overallScore: (result.faceAnalysis as Record<string, unknown>)?.overallScore,
                            summary: (result.faceAnalysis as Record<string, unknown>)?.summary,
                            labAnalysis: undefined,
                            zoneAnalysis: undefined,
                            recommendations: undefined,
                            dimensions: (result.faceAnalysis as Record<string, unknown>)?.dimensions,
                        } : undefined,
                    };
                    localStorage.setItem(STORAGE_KEYS.ADVISOR_RESULT, JSON.stringify(stripped));
                } catch (e2) {
                    console.warn("Failed to save even stripped result to localStorage", e2);
                }
            }
            trackAnalysisComplete(result.dataSource === "comprehensive" || result.dataSource === "hybrid" ? "ai" : "fallback");

            // Only clear freeRetry flag after successful server response
            if (isFreeRetry) {
                try {
                    localStorage.removeItem(STORAGE_KEYS.ADVISOR_FREE_RETRY);
                    localStorage.removeItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID);
                } catch (e) {
                    console.warn("Failed to clear freeRetry flag", e);
                }
            }

            setAnalysisState({ status: 'completed', progress: 100, error: null, queuePosition: undefined, queueWaitSeconds: undefined });

            // Return data to caller
            return { result: result as Record<string, unknown>, faceAnalysis, sessionId };
        };

        try {
            const result = await Promise.race([analysisPromise(), timeoutPromise]);
            cancelTimeout();
            return result;
        } catch (e: unknown) {
            cancelTimeout();
            abortController.abort(); // 确保取消所有未完成的请求
            const error = e instanceof Error ? e : new Error(String(e));
            console.error("Analysis failed:", error);
            setAnalysisState({ status: 'error', progress: 0, error: error.message || "Unknown error", queuePosition: undefined, queueWaitSeconds: undefined });
            throw error;
        } finally {
            isRunningRef.current = false;
            releaseAnalysisLock();
            // 分析流程结束（成功/失败/超时）后清除刷新复用标记
            try {
                sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID);
                sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT);
                localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_LOCAL);
            } catch (e) {
                console.warn("sessionStorage/localStorage access failed", e);
            }
        }
    }, [trackAnalysisStart, trackAnalysisComplete, pollSessionResult, user]);

    // Fake progress animation to fill the gaps between milestones
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;

        // 200ms 更新一次进度足够平滑，同时避免频繁 setState 导致低端机掉帧
        if (['preparing', 'analyzing_face', 'analyzing_skin'].includes(analysisState.status)) {
            interval = setInterval(() => {
                setAnalysisState(prev => {
                    let target = 0;
                    let increment = 0;

                    // Configure simulated progress speed for each stage
                    // Redesigned to avoid the "stuck at 99%" problem:
                    // analyzing_skin now stops at 75%, then jumps to 90% when server responds
                    if (prev.status === 'preparing') {
                        target = 20;
                        increment = 0.25; // Faster start, users feel it begins quickly
                    } else if (prev.status === 'analyzing_face') {
                        target = 60;
                        increment = 0.12; // Moderate pace
                    } else if (prev.status === 'analyzing_skin') {
                        target = 85; // Stop at 85% while waiting for LLM
                        const remaining = target - prev.progress;
                        if (remaining > 20) increment = 0.18;
                        else if (remaining > 10) increment = 0.10;
                        else if (remaining > 3) increment = 0.04;
                        else increment = 0.045; // 200ms 间隔下约 0.225%/s，仍不会感觉卡住
                    }

                    if (prev.progress >= target) return prev;

                    return {
                        ...prev,
                        progress: Math.min(prev.progress + increment, target)
                    };
                });
            }, 200);
        }

        return () => clearInterval(interval);
    }, [analysisState.status]);

    // --- Session recovery helpers ---

    const recoverSession = useCallback(async (sessionId: string, signal?: AbortSignal): Promise<{ result: Record<string, unknown>; sessionId: string } | null> => {
        if (isRunningRef.current) return null;
        if (!acquireAnalysisLock(sessionId)) {
            console.warn(`[useAsyncAnalysis] Analysis lock already held for another session, skipping recovery`);
            return null;
        }
        isRunningRef.current = true;

        setAnalysisState({ status: 'analyzing_skin', progress: 55, error: null, queuePosition: undefined, queueWaitSeconds: undefined });

        try {
            const statusRes = await checkSessionStatus(sessionId);
            if (statusRes.status === 'completed' && statusRes.rawResult) {
                setAnalysisState({ status: 'completed', progress: 100, error: null });
                return { result: statusRes.rawResult, sessionId };
            }
            if (statusRes.status === 'analyzing') {
                const pollResult = await pollSessionResult(sessionId, {
                    onProgress: (attempt) => {
                        setAnalysisState(prev => ({ ...prev, progress: Math.min(85, 55 + attempt * 1) }));
                    },
                    signal
                });
                if (pollResult.status === 'completed' && pollResult.rawResult) {
                    setAnalysisState({ status: 'completed', progress: 100, error: null });
                    return { result: pollResult.rawResult, sessionId };
                }
            }
            return null; // pending / not_found / forbidden -> caller should run fresh analysis
        } catch (e: unknown) {
            console.error('Recover session failed:', e);
            return null;
        } finally {
            isRunningRef.current = false;
            releaseAnalysisLock();
        }
    }, [checkSessionStatus, pollSessionResult]);

    const reset = useCallback(() => {
        setAnalysisState({ status: 'idle', progress: 0, error: null, queuePosition: undefined, queueWaitSeconds: undefined });
        isRunningRef.current = false;
        releaseAnalysisLock();
    }, []);

    // Mock 模式：纯前端模拟进度，不调用任何 API，用于本地预览 AnalyzingOverlay / 结果页 UI
    const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startMock = useCallback(() => {
        if (mockTimerRef.current) return;
        setAnalysisState({ status: 'preparing', progress: 2, error: null });
        mockTimerRef.current = setInterval(() => {
            setAnalysisState(prev => {
                const p = prev.progress + 0.4;
                let status = prev.status;
                if (p < 20) status = 'preparing';
                else if (p < 55) status = 'analyzing_face';
                else if (p < 100) status = 'analyzing_skin';
                if (p >= 100) {
                    if (mockTimerRef.current) clearInterval(mockTimerRef.current);
                    mockTimerRef.current = null;
                    return { status: 'completed', progress: 100, error: null };
                }
                return { ...prev, status, progress: p };
            });
        }, 100);
    }, []);

    return { runAnalysis, analysisState, reset, recoverSession, startMock };
}
