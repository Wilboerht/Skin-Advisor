
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAdvisorAnalytics } from './useAdvisorAnalytics';
import { useAuth } from './useAuth';
import { preprocessFaceImage, getBase64Size } from '@/lib/image-processing';
import { useRouter } from 'next/navigation';
import { getPrivacyConsentPayload } from '@/components/advisor/PrivacyConsent';

export interface AsyncAnalysisState {
    status: 'idle' | 'preparing' | 'analyzing_face' | 'analyzing_skin' | 'completed' | 'error';
    progress: number;
    error: string | null;
    queuePosition?: number;
    queueWaitSeconds?: number;
}

// Helper for auto-retry
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> {
    try {
        const res = await fetch(url, options);
        // 429 is a business logic rejection (usage limit), do NOT retry
        if (!res.ok && res.status === 429) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || '您已达到测试次数上限');
        }
        // Retry only on Server Errors (5xx)
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
        if (retries > 0) {
            console.log(`Retrying ${url}... (${retries} attempts left)`);
            await new Promise(r => setTimeout(r, backoff));
            // Check again before retry in case signal was aborted during backoff
            if (options.signal?.aborted) {
                throw new Error('Request aborted');
            }
            return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
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
    const router = useRouter();

    const isRunningRef = useRef(false);

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
                    reject(new Error("分析超时 (180秒)。请检查网络连接后重试。"));
                }, 180 * 1000); // 3 minutes
            });
            return { promise, cancel: () => clearTimeout(timeoutId) };
        };

        const { promise: timeoutPromise, cancel: cancelTimeout } = createTimeoutPromise();

        const analysisPromise = async () => {
            let answersStr: string | null = null;
            let nickname = "您";
            try {
                answersStr = localStorage.getItem("advisor_answers");
                nickname = localStorage.getItem("advisor_nickname") || "您";
            } catch (e) {
                console.warn("localStorage access failed", e);
            }

            if (!answersStr) {
                throw new Error("Missing answer data");
            }
            const answers = JSON.parse(answersStr);

            // Pre-generate sessionId and nickname (needed for both avatar and analysis)
            const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

            // 1. Face Analysis
            let faceAnalysis = null;
            let frontPhotoForAvatar: string | null = null;

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
                // Slower stage transition: avoid manual jump, just update status
                setAnalysisState(prev => ({ ...prev, status: 'analyzing_face' }));
                
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
                                // Only preprocess if base64 and larger than 300KB
                                if (finalData.startsWith('data:')) {
                                    const base64Size = getBase64Size(finalData);
                                    if (base64Size < 300 * 1024) {
                                        console.log(`[Preprocess] ${label} already small (${Math.round(base64Size / 1024)}KB), skipping`);
                                    } else {
                                        const processed = await preprocessFaceImage(imgData);
                                        finalData = processed.imageData;
                                    }
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
                    for (const result of uploadResults) {
                        visionImages.push({ data: result.finalData, angle: result.label });
                        if (result.key === 'front') {
                            frontPhotoForAvatar = result.finalData;
                        }
                    }

                    // Trigger background avatar generation in PARALLEL with face analysis
                    // Non-blocking: failures are silently logged, don't affect result display
                    const storedGender = localStorage.getItem("advisor_gender") || answers?.gender || 'female';
                    if (frontPhotoForAvatar) {
                        console.log("[Avatar] Starting background generation (parallel with face analysis)...");
                        const avatarAbortController = new AbortController();
                        // 主流程取消时同步取消 avatar 请求
                        abortController.signal.addEventListener('abort', () => avatarAbortController.abort());

                        (async () => {
                            let retries = 0;
                            const maxRetries = 2;
                            
                            while (retries <= maxRetries) {
                                let avatarTimeout: ReturnType<typeof setTimeout> | undefined;
                                try {
                                    avatarTimeout = setTimeout(() => avatarAbortController.abort(), 60000);

                                const response = await fetch("/api/advisor/avatar/generate", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        sessionId: sessionId,
                                        nickname: nickname,
                                        frontPhoto: frontPhotoForAvatar,
                                        characteristics: {
                                            // 年龄、肤色、发型由后端从 AI 分析结果中读取真实数据
                                            // 此处仅传入用户明确填写的性别作为最终 fallback
                                            gender: storedGender
                                        }
                                    }),
                                    signal: avatarAbortController.signal
                                });

                                clearTimeout(avatarTimeout);
                                    
                                if (response.ok) {
                                        const data = await response.json();

                                        if (data.success && data.queued) {
                                            if (data.generatedUrl) {
                                                try {
                                                    // 带过期时间的 localStorage 存储（24小时）
                                                    const payload = JSON.stringify({
                                                        url: data.generatedUrl,
                                                        expiresAt: Date.now() + 24 * 60 * 60 * 1000
                                                    });
                                                    // 大小检查：localStorage 通常限制 5MB
                                                    if (payload.length > 4 * 1024 * 1024) {
                                                        console.warn("[Avatar] ⚠️  Avatar URL too large for localStorage, skipping");
                                                    } else {
                                                        localStorage.setItem(`guest_avatar_${sessionId}`, payload);
                                                        console.log(`[Avatar] ✅ Avatar already generated, stored in localStorage`);
                                                    }
                                                } catch (e) {
                                                    console.warn("[Avatar] ⚠️  Failed to store avatar in localStorage:", e);
                                                }
                                            } else {
                                                console.log(`[Avatar] ✅ Enqueued for generation (position: #${data.position})`);
                                            }
                                            break;
                                        }

                                        if (data.success && data.url && typeof data.url === 'string') {
                                            if (data.isGuest) {
                                                try {
                                                    const payload = JSON.stringify({
                                                        url: data.url,
                                                        expiresAt: Date.now() + 24 * 60 * 60 * 1000
                                                    });
                                                    if (payload.length > 4 * 1024 * 1024) {
                                                        console.warn("[Avatar] ⚠️  Avatar URL too large for localStorage, skipping");
                                                    } else {
                                                        localStorage.setItem(`guest_avatar_${sessionId}`, payload);
                                                        console.log(`[Avatar] ✅ Guest avatar stored in localStorage from ${data.source}`);
                                                    }
                                                } catch (e) {
                                                    console.warn("[Avatar] ⚠️  Failed to store guest avatar in localStorage:", e);
                                                }
                                            } else {
                                                console.log(`[Avatar] ✅ User avatar generation succeeded from ${data.source}`);
                                            }
                                            break;
                                        }

                                        console.warn("[Avatar] ❌ Unexpected response format:", data);
                                        if (retries < maxRetries) {
                                            retries++;
                                            await new Promise(r => setTimeout(r, 1000));
                                            continue;
                                        } else {
                                            break;
                                        }
                                    } else if (response.status >= 500) {
                                        console.warn(`[Avatar] ⚠️  Server error (${response.status}), retrying...`);
                                        if (retries < maxRetries) {
                                            retries++;
                                            await new Promise(r => setTimeout(r, 2000 * Math.pow(1.5, retries)));
                                            continue;
                                        } else {
                                            break;
                                        }
                                    } else {
                                        console.error(`[Avatar] ❌ API error (${response.status})`);
                                        break;
                                    }
                                } catch (err) {
                                    if (avatarTimeout) clearTimeout(avatarTimeout);
                                    if (err instanceof Error && err.name === 'AbortError') {
                                        console.warn("[Avatar] ⚠️  Request cancelled or timeout");
                                    } else {
                                        console.error("[Avatar] ❌ Generation failed:", err);
                                    }
                                    
                                    if (retries < maxRetries) {
                                        retries++;
                                        await new Promise(r => setTimeout(r, 2000));
                                        continue;
                                    } else {
                                        break;
                                    }
                                }
                            }
                            
                            console.log("[Avatar] Background process complete (frontend will poll for results)");
                        })();
                    }

                    if (visionImages.length > 0) {
                        try {
                            const faceRes = await fetchWithRetry("/api/advisor/face-analyze", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ images: visionImages })
                            });

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
                                    throw new Error("请求过于频繁，请稍后重试");
                                }
                                if (faceRes.status === 503 || faceRes.status === 504) { // This case should ideally be caught by fetchWithRetry
                                    throw new Error("AI 服务暂时繁忙，请稍后重试");
                                }
                                throw new Error(errorData.message || errorData.error || "面部分析失败");
                            }
                        } catch (e: unknown) {
                            const err = e as Error;
                            console.error("Face analysis fetch failed", e);
                            // Check if the error is from fetchWithRetry's specific message
                            if (err.message.includes("Request failed: 429")) {
                                throw new Error("请求过于频繁，请稍后重试");
                            }
                            if (err.message.includes("Request failed: 5") || err.message.includes("Failed to fetch")) {
                                throw new Error("AI 服务暂时繁忙，请稍后重试");
                            }
                            throw e; // Rethrow to stop the process and show error state
                        }
                    }
                }
            }

            // Bump to next major phase smoothly
            setAnalysisState(prev => ({ ...prev, status: 'analyzing_skin', progress: Math.max(prev.progress, 45) }));

            // 2. Comprehensive Analysis (Text)

            // Check if this is a free retry (gender mismatch retry — won't consume quota)
            let isFreeRetry = false;
            try {
                isFreeRetry = localStorage.getItem("advisor_free_retry") === "true";
            } catch (e) {
                console.warn("localStorage access failed", e);
            }
            // NOTE: Do NOT clear localStorage here — only clear after server confirms success

            const privacyConsent = getPrivacyConsentPayload();
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
                })
            });

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

            if (!analyzeRes.ok) throw new Error("Analysis failed");

            const result = await analyzeRes.json();

            if (faceAnalysis && !result.faceAnalysis) {
                result.faceAnalysis = faceAnalysis;
            }

            // Save Result (include sessionId for sharing recovery)
            result.sessionId = sessionId;
            try {
                localStorage.setItem("advisor_result", JSON.stringify(result));
            } catch (e) {
                console.warn("Failed to save result to localStorage", e);
            }
            trackAnalysisComplete(result.dataSource === "comprehensive" ? "ai" : "fallback");

            // Only clear freeRetry flag after successful server response
            if (isFreeRetry) {
                try {
                    localStorage.removeItem("advisor_free_retry");
                } catch (e) {
                    console.warn("Failed to clear freeRetry flag", e);
                }
            }

            setAnalysisState({ status: 'completed', progress: 100, error: null, queuePosition: undefined, queueWaitSeconds: undefined });

            // Return data to caller
            return { result, faceAnalysis, sessionId };
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
        }
    }, [trackAnalysisStart, trackAnalysisComplete, user]);

    // Fake progress animation to fill the gaps between milestones
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;

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
                        target = 45;
                        increment = 0.12; // Moderate pace
                    } else if (prev.status === 'analyzing_skin') {
                        target = 75; // Stop at 75% while waiting for LLM
                        const remaining = target - prev.progress;
                        if (remaining > 20) increment = 0.18;
                        else if (remaining > 10) increment = 0.10;
                        else if (remaining > 3) increment = 0.04;
                        else increment = 0.015; // Much faster than before, won't feel stuck
                    }

                    if (prev.progress >= target) return prev;

                    return {
                        ...prev,
                        progress: Math.min(prev.progress + increment, target)
                    };
                });
            }, 60);
        }

        return () => clearInterval(interval);
    }, [analysisState.status]);

    return { runAnalysis, analysisState };
}
