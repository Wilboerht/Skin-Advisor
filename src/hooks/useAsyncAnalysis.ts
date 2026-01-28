
import { useState, useCallback } from 'react';
import { useAdvisorAnalytics } from './useAdvisorAnalytics';
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
        // Retry on Server Errors (5xx) or Rate Limit (429)
        if (!res.ok && (res.status >= 500 || res.status === 429)) {
            throw new Error(`Request failed: ${res.status}`);
        }
        return res;
    } catch (err) {
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
    const router = useRouter();

    const runAnalysis = useCallback(async () => {
        setAnalysisState({ status: 'preparing', progress: 10, error: null });
        trackAnalysisStart();

        try {
            const answersStr = localStorage.getItem("advisor_answers");
            const imagesStr = localStorage.getItem("advisor_face_images");

            if (!answersStr) {
                throw new Error("Missing answer data");
            }
            const answers = JSON.parse(answersStr);

            // 1. Face Analysis
            let faceAnalysis = null;
            if (imagesStr) {
                setAnalysisState({ status: 'analyzing_face', progress: 30, error: null });
                let images: any = {};
                try {
                    images = JSON.parse(imagesStr);
                } catch (e) { console.error(e); }

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
                                // Upload to OSS if available
                                const { uploadImageToOSS } = await import("@/lib/oss-upload-client");
                                const blob = await (await fetch(finalData)).blob();
                                const url = await uploadImageToOSS(blob, "face-front.jpg");
                                if (url) {
                                    finalData = url;
                                    console.log("Uploaded to OSS:", url);
                                }
                            } catch (ossError) {
                                console.warn("OSS Upload failed, using base64", ossError);
                            }
                        }
                        visionImages.push({ data: finalData, angle: 'front' });
                    } catch (e) {
                        console.warn("Preprocessing failed", e);
                        visionImages.push({ data: images.front, angle: 'front' });
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
                                throw new Error(errorData.error || errorData.message || "面部分析失败");
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

            setAnalysisState({ status: 'analyzing_skin', progress: 60, error: null });

            // 2. Comprehensive Analysis (Text)
            const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

            const analyzeRes = await fetchWithRetry("/api/advisor/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    answers,
                    faceAnalysis: faceAnalysis || undefined,
                    sessionId: sessionId
                })
            });

            if (!analyzeRes.ok) throw new Error("Analysis failed");

            const result = await analyzeRes.json();

            if (faceAnalysis && !result.faceAnalysis) {
                result.faceAnalysis = faceAnalysis;
            }

            // Save Result
            localStorage.setItem("advisor_result", JSON.stringify(result));
            trackAnalysisComplete(result.dataSource === "comprehensive" ? "ai" : "fallback");

            setAnalysisState({ status: 'completed', progress: 100, error: null });

            // Return data to caller
            return { result, faceAnalysis, sessionId };

        } catch (e: any) {
            console.error("Analysis failed", e);
            setAnalysisState({ status: 'error', progress: 0, error: e.message || "Unknown error" });
            throw e;
        }
    }, [trackAnalysisStart, trackAnalysisComplete]);

    return { runAnalysis, analysisState };
}
