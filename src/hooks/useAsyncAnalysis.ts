
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAdvisorAnalytics } from './useAdvisorAnalytics';
import { useAuth } from './useAuth';
import { preprocessFaceImage } from '@/lib/image-processing';
import { useToast } from '@/components/ui/Toast';

import { getPrivacyConsentPayload } from '@/lib/consent-storage';
import { ensureClientConsent } from '@/lib/consent-client';
import { STORAGE_KEYS, ANALYZING_SESSION_TTL_MS } from '@/lib/storage-keys';
import { localDateStr } from '@/lib/local-date';
import {
    fingerprintAnswers,
    canReuseFailedAnalysis,
} from '@/lib/failed-analysis-retry';
import { fetchWithRetry, getServerErrorMessage } from './async-analysis/http';
import {
    checkSessionStatus,
    pollSessionResult,
    waitForFaceCompleted,
    SessionRecoveryError,
} from './async-analysis/session';
import {
    acquireAnalysisLock,
    clearAnalyzingSessionMarkers,
    clearFailedAnalysisRetry,
    readFailedAnalysisRetry,
    releaseAnalysisLock,
    writeFailedAnalysisRetry,
} from './async-analysis/storage';

export type { SessionStatusResponse } from './async-analysis/session';
export { getAnalysisLock } from './async-analysis/storage';

export interface AsyncAnalysisState {
    status: 'idle' | 'preparing' | 'analyzing_face' | 'analyzing_skin' | 'completed' | 'error';
    progress: number;
    error: string | null;
    queuePosition?: number;
    queueWaitSeconds?: number;
}



export function useAsyncAnalysis() {
    const [analysisState, setAnalysisState] = useState<AsyncAnalysisState>({
        status: 'idle',
        progress: 0,
        error: null
    });
    const { trackAnalysisStart, trackAnalysisComplete } = useAdvisorAnalytics();
    const { user } = useAuth();
    const toast = useToast();

    const isRunningRef = useRef(false);
    const activeAnalysisAbortRef = useRef<AbortController | null>(null);

    const cancelAnalysis = useCallback(() => {
        activeAnalysisAbortRef.current?.abort();
        activeAnalysisAbortRef.current = null;
    }, []);

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
        activeAnalysisAbortRef.current = abortController;

        const createTimeoutPromise = () => {
            let timeoutId: ReturnType<typeof setTimeout>;
            const promise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    abortController.abort();
                    reject(new Error("分析时间较长，请检查网络后重试。"));
                }, 240 * 1000); // 视觉 95s + 文本 85s + 队列/网络开销，180s 会误杀最坏链路
            });
            return { promise, cancel: () => clearTimeout(timeoutId) };
        };

        const { promise: timeoutPromise, cancel: cancelTimeout } = createTimeoutPromise();

        // 记录本次调用是否持有全局分析锁：未持有（其他会话在分析）时 finally 不得释放锁
        let lockAcquired = false;

        // 会话 ID / 问卷指纹 / 成功标记需在异常路径可见：失败时暂存供免费重试，成功时清理恢复标记
        let activeSessionId: string | null = null;
        let activeAnswersFingerprint: string | null = null;
        let analysisSucceeded = false;

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
                        if (parsed.sessionId && (Date.now() - parsed.startedAt) < ANALYZING_SESSION_TTL_MS) {
                            analyzingSessionId = parsed.sessionId;
                            analyzingStartedAt = parsed.startedAt;
                        }
                    }
                } catch {
                    // localStorage parse failed, ignore
                }
            }
            const isAnalyzingSessionValid = analyzingSessionId && (Date.now() - analyzingStartedAt) < ANALYZING_SESSION_TTL_MS;

            // 本次问卷指纹：失败暂存只在"同一份问卷的重试"时复用，
            // 用户改过问卷/开始全新测试不会再被旧失败会话免费劫持
            const answersFingerprint = fingerprintAnswers(answersStr);

            // 上一次分析失败后的会话：仅当问卷指纹一致时复用（服务端预占幂等，重试不再扣次）
            const failedRetry = readFailedAnalysisRetry();
            const reusableFailedSessionId =
                canReuseFailedAnalysis(failedRetry, answersFingerprint) ? failedRetry!.sessionId : null;
            if (failedRetry && !reusableFailedSessionId) {
                // 问卷已变化：旧暂存不再适用，清掉避免残留
                clearFailedAnalysisRetry();
            }

            const sessionId = freeRetrySessionId
                || reusableFailedSessionId
                || (isAnalyzingSessionValid ? analyzingSessionId : null)
                || crypto.randomUUID();
            activeSessionId = sessionId;
            activeAnswersFingerprint = answersFingerprint;

            // 获取全局分析锁，防止组件 unmount/remount 或 StrictMode 双 mount 导致重复分析
            if (!acquireAnalysisLock(sessionId)) {
                console.warn(`[useAsyncAnalysis] Analysis lock already held for another session, skipping`);
                // 设置错误状态让 ResultClient 感知并显示重试按钮，而非永久停留在 preparing 状态
                setAnalysisState({ status: 'error', progress: 0, error: '上一次分析还在进行中，请稍等片刻后点击重试查看结果。' });
                return;
            }
            lockAcquired = true;

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

            if (user?.id) {
                const consentOk = await ensureClientConsent();
                if (!consentOk) {
                    throw new Error("测肤授权未完成，请重新阅读并同意隐私政策后再试。");
                }
            }

            // 1. Face Analysis
            let faceAnalysis = null;
            // 免费重试直接复用服务端已存的面部结果；正常流程必须等到面部阶段成功
            let faceReady = isFreeRetryEarly;

            // 拍摄时肌肤状态（扫脸引导弹窗选择）：随分析请求透传，用于视觉/文本 prompt 条件化
            let skinState: string | undefined;
            try {
                skinState = localStorage.getItem(STORAGE_KEYS.ADVISOR_SKIN_STATE) || undefined;
            } catch { /* ignore */ }

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

            // 扫脸照片已过本地保留期被清除：用户做过扫脸（IndexedDB 标记仍在）但取不到照片时，
            // 分析会静默降级为纯问卷——显式提示，避免用户误以为本次报告使用了扫脸数据
            if (!images?.front) {
                let hadSavedFaceImages = false;
                try {
                    hadSavedFaceImages = localStorage.getItem(STORAGE_KEYS.ADVISOR_FACE_IMAGES_IDB) === "true";
                } catch { /* ignore */ }
                if (hadSavedFaceImages) {
                    toast.warning("扫脸照片已超过保留期限，请重新拍摄后再生成报告");
                }
                // 产品决策：不允许跳过扫脸，纯问卷报告不再生成。
                if (!isFreeRetryEarly) {
                    throw new Error("请先完成扫脸拍摄后再生成报告");
                }
            }

            // 免费重试复用服务端已存的面部结果，跳过视觉 AI；普通流程仍走 face-analyze。
            // if (imagesStr) { -> Handled by checking if images is not null
            if (images && !isFreeRetryEarly) {
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
                                // 已经足够小（约 300KB 以内 base64）就跳过重编码，避免把纹理压糊。
                                if (finalData.startsWith('data:') && finalData.length > 420_000) {
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

                    const uploadResults = validResults;

                    // 3. Assemble vision images —— 只传正脸给 AI（2026-10 产品决策）：
                    //    侧脸/下巴不参与视觉分析，减少上传体积、视觉编码与生成耗时；
                    //    其余角度照常拍摄/上传，仅供报告页展示
                    const MAX_VISION_IMAGES = 1;
                    // 与服务端 FaceAnalyzeRequestSchema 保持一致（1.5M base64 字符）
                    const MAX_IMAGE_BASE64_CHARS = 1_500_000;
                    for (const result of uploadResults) {
                        if (result.key !== "front") continue;
                        // 跳过过大的图片（前端预处理应已将单张控制在 300KB 以内，此处为兜底）
                        if (result.finalData.length > MAX_IMAGE_BASE64_CHARS) {
                            console.warn(`[useAsyncAnalysis] Skipping oversized image for ${result.label}`);
                            continue;
                        }
                        visionImages.push({ data: result.finalData, angle: result.label });
                        if (visionImages.length >= MAX_VISION_IMAGES) break;
                    }

                    if (visionImages.length > 0) {
                        // 面部分析服务端超时 90s，客户端单独设置 95s 超时，避免服务端已放弃后客户端空等
                        //（qwen3-vl-plus 实测 >55s；Cloudflare 免费版 100s 返回 524，客户端必须压在 100s 内）
                        const faceAnalyzeAbort = new AbortController();
                        const faceAnalyzeTimeout = setTimeout(() => faceAnalyzeAbort.abort(), 95 * 1000);
                        const onTotalAbort = () => faceAnalyzeAbort.abort();
                        abortController.signal.addEventListener('abort', onTotalAbort);

                        try {
                            // AI 视觉调用：不在 5xx 时自动重试，避免单次失败放大为多次扣费
                            const faceRes = await fetchWithRetry("/api/advisor/face-analyze", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    sessionId,
                                    images: visionImages,
                                    skinState,
                                    // 四角度仅用于拍摄引导；进入 AI 的只有正脸单图
                                    imageUsage: "front_only",
                                }),
                                signal: faceAnalyzeAbort.signal
                            }, { retries: 0 });

                            if (faceRes.status === 202) {
                                // 面部仍在分析：只等面部阶段完成，再交给 analyze 续跑文本。
                                const wait = await waitForFaceCompleted(sessionId, abortController.signal);
                                faceReady = wait.faceReady;
                                if (wait.completedResult) {
                                    faceAnalysis = (wait.completedResult.faceAnalysis as typeof faceAnalysis) ?? null;
                                }
                            } else if (faceRes.ok) {
                                faceAnalysis = await faceRes.json();
                                faceReady = true;
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

            // 强制扫脸：面部阶段未成功时不得进入文本分析（不再降级为纯问卷报告）。
            if (!faceReady && !isFreeRetryEarly) {
                throw new Error("面部分析未完成，请重新拍摄或稍后重试。");
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
            const analyzePayload = {
                answers,
                faceAnalysis: faceAnalysis || undefined,
                sessionId: sessionId,
                nickname: nickname,
                privacyConsent,
                clientDate: localDateStr(new Date()),
                skinState,
                ...(isFreeRetry ? { freeRetry: true } : {})
            };
            // AI 综合分析调用：不在 5xx 时自动重试，避免单次失败放大为多次扣费
            const doAnalyze = () => fetchWithRetry("/api/advisor/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(analyzePayload),
                signal: abortController.signal
            }, { retries: 0 });

            let analyzeRes = await doAnalyze();

            // analyze 可能因面部阶段仍在进行返回 202：等面部完成后再续跑一次，
            // 不能直接进入 pollSessionResult（没有文本请求在跑，会空等至超时）。
            if (analyzeRes.status === 202) {
                const statusData = await analyzeRes.json().catch(() => ({})) as { phase?: string };
                if (statusData.phase === "face_analyzing") {
                    await waitForFaceCompleted(sessionId, abortController.signal);
                    analyzeRes = await doAnalyze();
                }
            }

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
            // 绑定报告所属用户：共享设备换账号后，ResultClient 据此拒绝展示上一账号的报告
            result.userId = user?.id ?? null;
            try {
                localStorage.setItem(STORAGE_KEYS.ADVISOR_RESULT, JSON.stringify(result));
            } catch (e) {
                console.warn("Failed to save full result to localStorage, attempting stripped save", e);
                // 配额满了：只保留关键字段（移除大体积的 labAnalysis），保证基本展示可用
                try {
                    const stripped = {
                        ...result,
                        faceAnalysis: result.faceAnalysis ? {
                            ...(result.faceAnalysis as Record<string, unknown>),
                            labAnalysis: undefined,
                        } : undefined,
                    };
                    localStorage.setItem(STORAGE_KEYS.ADVISOR_RESULT, JSON.stringify(stripped));
                } catch (e2) {
                    console.warn("Failed to save even stripped result to localStorage", e2);
                }
            }
            trackAnalysisComplete("ai");

            // 分析成功后立即清理本地人脸照片（服务端也已在 face-analyze 后删除上传文件）。
            // 旧实现只在 startNewTest/登出时清理，UI 承诺的“分析后删除”没有兑现。
            try {
                await advisorStorage.clearFaceImages();
            } catch (clearErr) {
                console.warn("Failed to clear local face images after analysis", clearErr);
            }

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

            analysisSucceeded = true;
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
            // 失败会话暂存：同问卷重试时复用 sessionId（服务端预占幂等，不额外扣次）
            if (activeSessionId && activeAnswersFingerprint) {
                writeFailedAnalysisRetry(activeSessionId, activeAnswersFingerprint);
            }
            setAnalysisState({ status: 'error', progress: 0, error: error.message || "Unknown error", queuePosition: undefined, queueWaitSeconds: undefined });
            throw error;
        } finally {
            isRunningRef.current = false;
            if (activeAnalysisAbortRef.current === abortController) {
                activeAnalysisAbortRef.current = null;
            }
            // 仅在本次调用持有锁时释放并清理恢复标记，避免误删其他会话持有的锁。
            // 失败时保留 ANALYZING_* 标记（配合失败暂存），供用户点击重试时复用同一会话
            if (lockAcquired) {
                releaseAnalysisLock();
                if (analysisSucceeded) {
                    clearFailedAnalysisRetry();
                    clearAnalyzingSessionMarkers(activeSessionId ?? undefined);
                }
            }
        }
    }, [trackAnalysisStart, trackAnalysisComplete, user, toast]);

    // Fake progress animation to fill the gaps between milestones
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;

        // 400ms 更新一次进度足够平滑，同时避免频繁 setState 导致低端机掉帧
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
                        else increment = 0.045; // 400ms 间隔下约 0.11%/s，仍不会感觉卡住
                    }

                    if (prev.progress >= target) return prev;

                    return {
                        ...prev,
                        progress: Math.min(prev.progress + increment, target)
                    };
                });
            }, 400);
        }

        return () => clearInterval(interval);
    }, [analysisState.status]);

    // --- Session recovery helpers ---

    const recoverSession = useCallback(async (
        sessionId: string,
        signal?: AbortSignal
    ): Promise<
        | { status: 'completed'; result: Record<string, unknown>; sessionId: string }
        | { status: 'not_found' }
        | { status: 'error'; message: string }
    > => {
        if (isRunningRef.current) {
            const message = '上一次分析还在进行中，请稍后重试。';
            setAnalysisState({ status: 'error', progress: 0, error: message });
            return { status: 'error', message };
        }
        if (!acquireAnalysisLock(sessionId)) {
            console.warn(`[useAsyncAnalysis] Analysis lock already held for another session, skipping recovery`);
            const message = '上一次分析还在进行中，请稍后重试。';
            setAnalysisState({ status: 'error', progress: 0, error: message });
            return { status: 'error', message };
        }
        isRunningRef.current = true;

        setAnalysisState({ status: 'analyzing_skin', progress: 55, error: null, queuePosition: undefined, queueWaitSeconds: undefined });

        const sleep = (ms: number) => new Promise<void>((resolve, reject) => {
            if (signal?.aborted) {
                reject(new Error('已取消等待'));
                return;
            }
            const timeoutId = setTimeout(resolve, ms);
            signal?.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(new Error('已取消等待'));
            }, { once: true });
        });

        // 面部结果已由服务端持久化时，恢复流程只需补跑文本阶段。
        // 返回 null 表示服务端已有其它请求在分析（202），由下方轮询等待。
        const launchTextAnalysis = async (): Promise<Record<string, unknown> | null> => {
            let answersStr: string | null = null;
            let nickname = "您";
            try {
                answersStr = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
                nickname = localStorage.getItem(STORAGE_KEYS.ADVISOR_NICKNAME) || user?.name || "您";
            } catch { /* ignore */ }
            if (!answersStr) throw new Error("答题数据缺失，请重新填写问卷");
            const answers = JSON.parse(answersStr);
            let skinState: string | undefined;
            try { skinState = localStorage.getItem(STORAGE_KEYS.ADVISOR_SKIN_STATE) || undefined; } catch { /* ignore */ }
            let isFreeRetry = false;
            try {
                isFreeRetry = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY) === "true"
                    && localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID) === sessionId;
            } catch { /* ignore */ }

            const res = await fetchWithRetry("/api/advisor/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    answers,
                    sessionId,
                    nickname,
                    privacyConsent: getPrivacyConsentPayload(),
                    clientDate: localDateStr(new Date()),
                    skinState,
                    ...(isFreeRetry ? { freeRetry: true } : {}),
                }),
                signal,
            }, { retries: 0 });

            if (res.status === 202) return null;
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(getServerErrorMessage(errorData, "报告生成未完成，请重试。"));
            }
            return await res.json();
        };

        try {
            let statusRes = await checkSessionStatus(sessionId, signal);

            // 视觉阶段（analyze 尚未创建 AdvisorSession 行）时可能短暂 not_found。
            // 在判定"会话不存在"前多等几秒，避免刷新时把仍在跑的面部分析误判为失败并重复调用。
            for (let attempt = 0; statusRes.status === 'not_found' && attempt < 4; attempt++) {
                await sleep(2000);
                statusRes = await checkSessionStatus(sessionId, signal);
            }

            if (statusRes.status === 'completed' && statusRes.rawResult) {
                // 免费重试：服务端在重试开始前会保留旧报告，只有 freeRetryUsed 才是本次重试结果。
                // 否则直接展示旧报告会让免费重试“看起来没发生”，必须交给调用方启动重试。
                let freeRetryForSession = false;
                try {
                    freeRetryForSession = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY) === "true"
                        && localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID) === sessionId;
                } catch { /* ignore */ }
                if (freeRetryForSession && statusRes.rawResult.freeRetryUsed !== true) {
                    return { status: 'not_found' };
                }
                clearAnalyzingSessionMarkers(sessionId);
                setAnalysisState({ status: 'completed', progress: 100, error: null });
                return { status: 'completed', result: statusRes.rawResult, sessionId };
            }

            if (statusRes.status === 'not_found') {
                // 确定性不存在：由调用方决定是否启动全新分析（保持同一 sessionId）
                return { status: 'not_found' };
            }

            if (statusRes.status === 'forbidden' || statusRes.status === 'unauthorized') {
                const message = statusRes.status === 'unauthorized'
                    ? '登录状态已失效，请重新登录后查看报告。'
                    : '该报告不属于当前账号，或无权访问。';
                setAnalysisState({ status: 'error', progress: 0, error: message });
                return { status: 'error', message };
            }

            // 阶段感知恢复：
            // - face_analyzing：只等面部阶段完成，再补跑文本；
            // - face_completed：直接补跑文本；
            // - text_analyzing / 老服务端 analyzing：继续轮询；
            // - pending：服务端尚无扫脸记录（埋点建行或上次失败释放了 claim），
            //   回退到全新分析，由 runAnalysis 带着本地照片重走 face-analyze。
            if (statusRes.phase === 'face_analyzing') {
                const wait = await waitForFaceCompleted(sessionId, signal);
                if (wait.completedResult) {
                    clearAnalyzingSessionMarkers(sessionId);
                    setAnalysisState({ status: 'completed', progress: 100, error: null });
                    return { status: 'completed', result: wait.completedResult, sessionId };
                }
                const result = await launchTextAnalysis();
                if (result) {
                    clearAnalyzingSessionMarkers(sessionId);
                    setAnalysisState({ status: 'completed', progress: 100, error: null });
                    return { status: 'completed', result, sessionId };
                }
            } else if (statusRes.phase === 'face_completed') {
                const result = await launchTextAnalysis();
                if (result) {
                    clearAnalyzingSessionMarkers(sessionId);
                    setAnalysisState({ status: 'completed', progress: 100, error: null });
                    return { status: 'completed', result, sessionId };
                }
            } else if (statusRes.phase === 'pending') {
                // pending 只表示服务端没有扫脸分析记录，不代表用户没拍摄：
                // 会话行可能先由埋点（session_start / questionnaire_complete）创建，
                // 也可能是上次面部阶段失败后释放了 claim；照片仍只存在于浏览器本地。
                // 因此回退到全新分析（复用同一 sessionId），由 runAnalysis 带着本地照片
                // 重新走 face-analyze；本地确实没有照片时会给出“请先完成扫脸拍摄”的提示。
                return { status: 'not_found' };
            }

            // text_analyzing / rate_limited / transient_error / 老服务端无 phase：统一轮询。
            // 轮询内部会把瞬时错误当作可重试状态，不会新建会话。
            const pollResult = await pollSessionResult(sessionId, {
                onProgress: (attempt) => {
                    setAnalysisState(prev => ({ ...prev, progress: Math.max(prev.progress, Math.min(85, 55 + attempt * 1)) }));
                },
                signal
            });
            if (pollResult.status === 'completed' && pollResult.rawResult) {
                clearAnalyzingSessionMarkers(sessionId);
                setAnalysisState({ status: 'completed', progress: 100, error: null });
                return { status: 'completed', result: pollResult.rawResult, sessionId };
            }

            const message = '分析结果准备时间有点长，请稍后重试。';
            setAnalysisState({ status: 'error', progress: 0, error: message });
            return { status: 'error', message };
        } catch (e: unknown) {
            if (signal?.aborted) {
                // 页面卸载/用户离开：不写状态，交给调用方直接返回
                return { status: 'error', message: '已取消等待' };
            }
            console.error('Recover session failed:', e);
            const isDefinitive = e instanceof SessionRecoveryError && e.reason === 'not_found';
            if (isDefinitive) {
                return { status: 'not_found' };
            }
            // 超时/网络等可重试失败：暂存本次会话，供错误页“重试分析”复用同一 sessionId。
            // 否则重试会新建会话，既有 TestRecord 预占被浪费，用户可能被重复扣次。
            const isAuthFailure = e instanceof SessionRecoveryError
                && (e.reason === 'forbidden' || e.reason === 'unauthorized');
            if (!isAuthFailure) {
                try {
                    const answersStr = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
                    if (answersStr) writeFailedAnalysisRetry(sessionId, fingerprintAnswers(answersStr));
                } catch { /* ignore */ }
            }
            const message = e instanceof SessionRecoveryError && e.reason === 'timeout'
                ? '分析结果准备时间有点长，请稍后重试。'
                : e instanceof Error ? e.message : '恢复分析状态失败，请稍后重试。';
            setAnalysisState({ status: 'error', progress: 0, error: message });
            return { status: 'error', message };
        } finally {
            isRunningRef.current = false;
            releaseAnalysisLock();
        }
    }, [user]);

    // Mock 模式：纯前端模拟进度，不调用任何 API，用于本地预览 AnalyzingOverlay / 结果页 UI
    const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const reset = useCallback(() => {
        setAnalysisState({ status: 'idle', progress: 0, error: null, queuePosition: undefined, queueWaitSeconds: undefined });
        isRunningRef.current = false;
        releaseAnalysisLock();
        if (mockTimerRef.current) {
            clearInterval(mockTimerRef.current);
            mockTimerRef.current = null;
        }
    }, []);

    // 卸载时清理 mock 定时器，避免卸载后 setState
    useEffect(() => () => {
        if (mockTimerRef.current) {
            clearInterval(mockTimerRef.current);
            mockTimerRef.current = null;
        }
    }, []);
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

    return { runAnalysis, analysisState, reset, recoverSession, startMock, cancelAnalysis };
}
