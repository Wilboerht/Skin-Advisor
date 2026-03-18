
import { useState, useCallback, useEffect } from 'react';
import { useAdvisorAnalytics } from './useAdvisorAnalytics';
import { useAuth } from './useAuth';
import { preprocessFaceImage } from '@/lib/image-processing';
import { useRouter } from 'next/navigation';

export interface AsyncAnalysisState {
    status: 'idle' | 'preparing' | 'analyzing_face' | 'analyzing_skin' | 'completed' | 'error';
    progress: number;
    error: string | null;
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
    } catch (err: any) {
        // Do NOT retry usage-limit errors (429)
        if (err.message?.includes('测试次数上限') || err.message?.includes('测试上限')) {
            throw err;
        }
        if (retries > 0) {
            console.log(`Retrying ${url}... (${retries} attempts left)`);
            await new Promise(r => setTimeout(r, backoff));
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

    const runAnalysis = useCallback(async () => {
        setAnalysisState({ status: 'preparing', progress: 2, error: null });
        trackAnalysisStart();

        const timeoutPromise = new Promise<{ result: any, faceAnalysis: any, sessionId: string }>((_, reject) => {
            setTimeout(() => {
                reject(new Error("分析超时 (120秒)。请检查网络连接后重试。"));
            }, 120 * 1000); // 2 minutes
        });

        const analysisPromise = async () => {
            const answersStr = localStorage.getItem("advisor_answers");


            if (!answersStr) {
                throw new Error("Missing answer data");
            }
            const answers = JSON.parse(answersStr);

            // 1. Face Analysis
            let faceAnalysis = null;
            let frontPhotoForAvatar: string | null = null;

            // Use advisorStorage to get images (supports IndexedDB)
            const { advisorStorage } = await import("@/lib/advisor-storage");
            const images = await advisorStorage.getFaceImages();

            // if (imagesStr) { -> Handled by checking if images is not null
            if (images) {
                // Slower stage transition: avoid manual jump, just update status
                setAnalysisState(prev => ({ ...prev, status: 'analyzing_face' }));
                
                if (images && images.front) {
                    const visionImages = [];
                    // Preprocess
                    try {
                        let finalData = images.front;
                        // Only preprocess if not already a URL (local data)
                        if (finalData.startsWith('data:')) {
                            const processed = await preprocessFaceImage(images.front);
                            finalData = processed.imageData;

                            try {
                                // Upload to cloud storage (only for logged-in users)
                                if (user) {
                                    const { uploadImage } = await import("@/lib/upload-client");
                                    const blob = await (await fetch(finalData)).blob();
                                    const url = await uploadImage(blob, "face-front.jpg");
                                    if (url) {
                                        finalData = url;
                                        console.log("Uploaded to cloud storage:", url);
                                    }
                                } else {
                                    console.log("Guest user, skipping cloud upload");
                                }
                            } catch (uploadError) {
                                console.warn("Cloud upload failed, using base64", uploadError);
                            }
                        }
                        visionImages.push({ data: finalData, angle: 'front' });
                        frontPhotoForAvatar = finalData;
                    } catch (e) {
                        console.warn("Preprocessing failed", e);
                        visionImages.push({ data: images.front, angle: 'front' });
                        frontPhotoForAvatar = images.front;
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
                        } catch (e: any) {
                            console.error("Face analysis fetch failed", e);
                            // Check if the error is from fetchWithRetry's specific message
                            if (e.message.includes("Request failed: 429")) {
                                throw new Error("请求过于频繁，请稍后重试");
                            }
                            if (e.message.includes("Request failed: 5") || e.message.includes("Failed to fetch")) {
                                throw new Error("AI 服务暂时繁忙，请稍后重试");
                            }
                            throw e; // Rethrow to stop the process and show error state
                        }
                    }
                }
            }

            // Bump to next major phase smoothly: avoid manual jump
            setAnalysisState(prev => ({ ...prev, status: 'analyzing_skin' }));

            // 2. Comprehensive Analysis (Text)
            const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

            // Get user nickname from localStorage
            const nickname = localStorage.getItem("advisor_nickname") || "护肤达人";

            // Check if this is a free retry (gender mismatch retry — won't consume quota)
            const isFreeRetry = localStorage.getItem("advisor_free_retry") === "true";
            // Clear immediately so it can only be used once
            if (isFreeRetry) {
                localStorage.removeItem("advisor_free_retry");
            }

            const analyzeRes = await fetchWithRetry("/api/advisor/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    answers,
                    faceAnalysis: faceAnalysis || undefined,
                    sessionId: sessionId,
                    nickname: nickname,
                    ...(isFreeRetry ? { freeRetry: true } : {})
                })
            });

            if (!analyzeRes.ok) throw new Error("Analysis failed");

            const result = await analyzeRes.json();

            if (faceAnalysis && !result.faceAnalysis) {
                result.faceAnalysis = faceAnalysis;
            }

            // Save Result (include sessionId for sharing recovery)
            result.sessionId = sessionId;
            localStorage.setItem("advisor_result", JSON.stringify(result));
            trackAnalysisComplete(result.dataSource === "comprehensive" ? "ai" : "fallback");

            // Trigger background avatar generation (Fire and Forget)
            const storedGender = localStorage.getItem("advisor_gender") || answers?.gender || 'female';
            fetch("/api/advisor/avatar/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sessionId,
                    nickname: nickname,
                    frontPhoto: frontPhotoForAvatar,
                    characteristics: {
                        age: result.skinProfile?.skinAge || 25,
                        gender: storedGender,
                        skinTone: 'healthy',
                        hairStyle: ''
                    }
                })
            }).catch(err => console.error("Background avatar generation trigger failed", err));

            setAnalysisState({ status: 'completed', progress: 100, error: null });

            // Return data to caller
            return { result, faceAnalysis, sessionId };
        };

        try {
            return await Promise.race([analysisPromise(), timeoutPromise]);
        } catch (e: any) {
            console.error("Analysis failed:", e);
            setAnalysisState({ status: 'error', progress: 0, error: e.message || "Unknown error" });
            throw e;
        }
    }, [trackAnalysisStart, trackAnalysisComplete, user]);

    // Fake progress animation to fill the gaps between milestones
    useEffect(() => {
        let interval: any;

        if (['preparing', 'analyzing_face', 'analyzing_skin'].includes(analysisState.status)) {
            interval = setInterval(() => {
                setAnalysisState(prev => {
                    let target = 0;
                    let increment = 0;

                    // Configure simulated progress speed for each stage
                    // This creates a perceived smooth movement even when APIs take time
                    if (prev.status === 'preparing') {
                        target = 14;
                        increment = 0.12; // Slower start
                    } else if (prev.status === 'analyzing_face') {
                        target = 39;
                        increment = 0.08; // Even more gradual
                    } else if (prev.status === 'analyzing_skin') {
                        target = 99;
                        // Logarithmic-like slowdown for long waits (LLM phase)
                        const remaining = target - prev.progress;
                        if (remaining > 50) increment = 0.15; // Faster if we are still far (skipped earlier phases)
                        else if (remaining > 20) increment = 0.06;
                        else if (remaining > 5) increment = 0.02;
                        else increment = 0.005; // Crawl slowly at the end
                    }

                    if (prev.progress >= target) return prev;

                    return {
                        ...prev,
                        progress: Math.min(prev.progress + increment, target)
                    };
                });
            }, 60); // Slightly slower tick
        }

        return () => clearInterval(interval);
    }, [analysisState.status]);

    return { runAnalysis, analysisState };
}
