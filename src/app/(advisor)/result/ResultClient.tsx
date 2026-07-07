"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { House, MessageCircle, Gift, ArrowRight } from "lucide-react";
import { useAsyncAnalysis } from "@/hooks/useAsyncAnalysis";
import { motion as m, AnimatePresence } from "framer-motion";
import {
    RotateCcw,
    ChevronRight,
    ScanFace,
    Activity,
    AlertCircle,
    X
} from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { DIMENSION_LABELS, DIMENSION_DESCRIPTIONS } from "@/lib/advisor-utils";
import { normalizeAnalysisResult, type ComprehensiveResult } from "@/lib/analysis-result";
import { getRankPercentile, getCharacterImage } from "@/lib/result-utils";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { computeLabAnalysis } from "@/lib/analysis-lab";
import type { LabMetric } from "@/lib/analysis-lab";
import { cn } from "@/lib/utils";

import { ScientificBarChart } from "@/components/advisor/ScientificBarChart";


import { SharePoster } from "@/components/advisor/poster/SharePoster";
import { ShareModal } from "@/components/advisor/ShareModal";
import { toPng } from "html-to-image";
import { ContactAdvisorModal } from "@/components/advisor/ContactAdvisorModal";
import ResultCards from "@/components/advisor/ResultCards";

// Import the new CSS Module
import styles from "./result.module.css";
import { ProductRecommendationSection } from "@/components/advisor/ProductRecommendationSection";
import type { ProductCardData } from "@/components/advisor/ProductCard";
import { SaveReportBanner } from "@/components/advisor/SaveReportBanner";
import { AnalyzingOverlay } from "@/components/advisor/AnalyzingOverlay";
import { skinTypes } from "@/lib/result-content";

// Re-export for backward compatibility with existing imports
export { normalizeAnalysisResult, type ComprehensiveResult } from "@/lib/analysis-result";

interface ResultClientProps {
    id?: string;
    initialData?: {
        result: ComprehensiveResult;
        faceAnalysis: FaceAnalysisResult | null;
    } | null;
}

// 手机端：十维分析表单（替代 ScientificBarChart）
function MobileDimensionForm({ dimensions }: { dimensions: Record<string, { score?: number } | undefined> }) {
    const order = ['radiance', 'acne', 'firmness', 'darkCircles', 'sensitivity', 'uvDamage', 'wrinkles', 'spots', 'skinTone', 'waterOil'];

    return (
        <div className="sm:hidden mb-5">
            {order.map((key) => {
                const item = dimensions[key];
                const score = item?.score ?? 0;
                const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
                return (
                    <div key={key} className="py-3 border-b border-[#E8E2D9] last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] text-[#4A4A4A]">{DIMENSION_LABELS[key]}</span>
                            <span className="text-[13px] font-medium text-[#1A1A1A]">{score} 分</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#E8E2D9] overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                        </div>
                        <p className="mt-1.5 text-[11px] text-[#8A8A8A] leading-relaxed">{DIMENSION_DESCRIPTIONS[key]}</p>
                    </div>
                );
            })}
        </div>
    );
}

// 手机端 Lab 指标卡片
function MobileLabRow({ metric }: { metric: LabMetric }) {
    const goodKeywords = ['正常', 'Normal', '紧致', '细腻', '均匀', '透亮', 'Type I', '少', 'Balanced'];
    const isGood = goodKeywords.some(k => metric.status.includes(k));

    return (
        <div className="mb-3 rounded-xl border border-[#E8E2D9] bg-white/50 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[13px] font-medium text-[#3d2f25] leading-tight">{metric.param}</span>
                {metric.status && (
                    <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isGood ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                        {metric.status}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-[10px] text-[#8A8A8A] mb-0.5">测定值</p>
                    <p className="text-[12px] text-[#1A1A1A]">{metric.value}</p>
                </div>
                <div>
                    <p className="text-[10px] text-[#8A8A8A] mb-0.5">参考范围</p>
                    <p className="text-[12px] text-[#1A1A1A]">{metric.ref}</p>
                </div>
            </div>
        </div>
    );
}

// Lab Report 行渲染（抽离到组件外部，避免每次渲染重新创建）
function renderLabRow(param: string, value: string, ref: string, status: string) {
    // Determine status color based on keywords
    const goodKeywords = ['正常', 'Normal', '紧致', '细腻', '均匀', '透亮', 'Type I', '少', 'Balanced'];
    const isGood = goodKeywords.some(k => status.includes(k));

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-2 px-4 border-b border-[#E8E2D9] last:border-0 items-center hover:bg-white/60 transition-colors">
            <div className="sm:col-span-5 text-[12px] text-[#4A4A4A] font-light tracking-tight">
                {param}
            </div>
            <div className="sm:col-span-3 text-left sm:text-right text-[12px] text-[#1A1A1A] font-normal">
                {value}
            </div>
            <div className="sm:col-span-2 text-left sm:text-right text-[12px] text-[#8A8A8A] font-light">
                <span className="sm:hidden mr-2 text-[#8A8A8A]">Ref:</span>
                {ref}
            </div>
            <div className="sm:col-span-2 text-left sm:text-right text-[11px] font-light">
                {status ? (
                    <span className={isGood ? 'text-[#4A4A4A]' : 'text-[#c45a4a]'}>
                        {status} {isGood ? '' : '▲'}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

// Wrapper component with Suspense for useSearchParams
export default function ResultClient(props: ResultClientProps) {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
                <ScanFace className="w-12 h-12 text-[#D4B78F] animate-pulse" />
            </div>
        }>
            <ResultClientContent {...props} />
        </Suspense>
    );
}

function ResultClientContent({ id, initialData }: ResultClientProps) {
    const router = useRouter();

    // 入口守卫：必须通过首页引导弹窗后才能查看结果
    // 历史报告页面（/reports/:id）会传入 id 与 initialData，跳过此守卫
    useEffect(() => {
        if (id || initialData) return;
        try {
            const hasResult = localStorage.getItem("advisor_result");
            const hasAnswers = localStorage.getItem("advisor_answers");
            const hasConsent = localStorage.getItem("advisor_privacy_consent");
            if (!hasResult && !hasAnswers && !hasConsent) {
                router.replace("/");
            }
        } catch {
            router.replace("/");
        }
    }, [router, id, initialData]);
    const { trackResultView, trackResultShare, trackProductClick } = useAdvisorAnalytics();
    const { user, isInitialized: authInitialized } = useAuth();
    const searchParams = useSearchParams();
    const { runAnalysis, analysisState, reset: resetAnalysis, recoverSession } = useAsyncAnalysis();

    // Refs for latest auth state to avoid adding them to effect dependency arrays
    const userRef = useRef(user);
    const authInitializedRef = useRef(authInitialized);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { authInitializedRef.current = authInitialized; }, [authInitialized]);

    // Data State
    const normalizedResult = useMemo(() => normalizeAnalysisResult(initialData?.result || null), [initialData]);
    const [result, setResult] = useState<ComprehensiveResult | null>(normalizedResult);
    const resultRef = useRef(result);
    useEffect(() => {
        resultRef.current = result;
    }, [result]);
    const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(initialData?.faceAnalysis || null);

    const [userNickname, setUserNickname] = useState<string>("您");
    // Session ID for sharing - initialized from props or will be set after analysis
    const [sessionId, setSessionId] = useState<string | undefined>(id);
    const [socialGender, setSocialGender] = useState<string>(''); // Initialize empty to avoid flash mismatch

    // IP 匹配所需数据
    const [ipBudget, setIpBudget] = useState<string | undefined>(undefined);
    const [ipSkincareFrequency, setIpSkincareFrequency] = useState<string | undefined>(undefined);

    // UI State
    const [loading, setLoading] = useState(!initialData);
    const hasTrackedView = useRef(false);

    // Gender Mismatch State：存储已确认过的 sessionId，换 session 后自动重新提示
    const [ackedSessionId, setAckedSessionId] = useState<string | null>(() => {
        try { return localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK); } catch { return null; }
    });

    // New State for interactivity

    const [showLabData, setShowLabData] = useState(false);
    const [showContactAdvisor, setShowContactAdvisor] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
    const [dismissValidationWarning, setDismissValidationWarning] = useState(() => {
        try { return sessionStorage.getItem('advisor_dismiss_validation') === 'true'; } catch { return false; }
    });
    const posterRef = useRef<HTMLDivElement>(null);


    const rankPercentile = useMemo(
        () => result?.dataSource === "questionnaire" ? undefined : getRankPercentile(faceAnalysis?.overallScore ?? 0),
        [faceAnalysis?.overallScore, result?.dataSource]
    );

    const isGenderMismatch = useMemo(() => {
        if (!faceAnalysis || !socialGender) return false;
        const faGender = (faceAnalysis as unknown as Record<string, unknown>)?.gender as Record<string, unknown> | undefined;
        const faGenderVal = faGender?.value as string | undefined;
        const faGenderConf = (faGender?.confidence as number | undefined) || 0;

        // Normalize confidence (handle both 0-1 and 0-100)
        const normalizedConf = faGenderConf > 1 ? faGenderConf / 100 : faGenderConf;

        // Mismatch = questionnaire gender differs from detected gender with high confidence
        return faGenderVal && normalizedConf > 0.85 && faGenderVal !== socialGender;
    }, [faceAnalysis, socialGender]);

    const showGenderMismatchModal = useMemo(
        () => !loading && !!result && !!faceAnalysis && isGenderMismatch && ackedSessionId !== sessionId,
        [loading, result, faceAnalysis, isGenderMismatch, ackedSessionId, sessionId]
    );

    const handleMismatchRetry = () => {
        // Clear previous answers to force a fresh start
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANSWERS);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FACE_IMAGES);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_RESULT);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_STEP);

        // 保留原 sessionId，供免费重试流程复用（后端需校验该 session 已完成过分析且未使用过重试）
        const currentSessionId = sessionId;
        if (currentSessionId) {
            localStorage.setItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID, currentSessionId);
        }

        // Set a flag for "Free Retry" bypass - recognized by the question/analyze flow
        localStorage.setItem(STORAGE_KEYS.ADVISOR_FREE_RETRY, "true");

        // Mark current session as acknowledged so we don't loop if they come back
        setAckedSessionId(currentSessionId ?? null);
        try { if (currentSessionId) localStorage.setItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK, currentSessionId); } catch { /* ignore */ }

        router.push("/questions");
    };

    const handleMismatchContinue = () => {
        const currentSessionId = sessionId ?? null;
        setAckedSessionId(currentSessionId);
        try { if (currentSessionId) localStorage.setItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK, currentSessionId); } catch { /* ignore */ }
        // 用户选择继续（不重试），清除免费重试相关标记，避免后续普通测试复用旧 sessionId
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FREE_RETRY);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID);
    };




    // renderLabRow 已抽为组件外部函数，避免每次渲染重新创建


    // Initialize & Restore Data
    useEffect(() => {
        const loadClientData = async () => {
            // 已有结果且非分析中时直接短路，避免 user 变化导致重复加载/闪烁
            if (resultRef.current && searchParams.get('status') !== 'analyzing') {
                if (!hasTrackedView.current) {
                    trackResultView();
                    hasTrackedView.current = true;
                }
                return;
            }

            // 1. Recover Images & Location using hybrid storage
            try {
                // Dynamically import to avoid SSR issues
                const { advisorStorage } = await import("@/lib/advisor-storage");
                // 人脸图片仅用于 IndexedDB 恢复，不渲染到页面
                // 保留恢复逻辑但不设置不再使用的 state
                await advisorStorage.getFaceImages();

                // Restore Nickname
                const storedNickname = localStorage.getItem(STORAGE_KEYS.ADVISOR_NICKNAME);
                if (storedNickname) setUserNickname(storedNickname);

                // Restore Gender
                const storedGender = localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER);
                if (storedGender) setSocialGender(storedGender);

                // Restore budget & skincare frequency for IP matching
                const answersStr = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
                if (answersStr) {
                    try {
                        const answers = JSON.parse(answersStr);
                        if (answers.budget) setIpBudget(answers.budget);
                        if (answers.skincareFrequency) setIpSkincareFrequency(answers.skincareFrequency);
                    } catch { /* ignore parse errors */ }
                }
            } catch (e) {
                console.error("Storage load error:", e);
            }

            // 2. If no initialData (Client-side nav), recover from LS
            if (!initialData) {
                try {
                    setLoading(true);
                    const advisorResultStr = localStorage.getItem(STORAGE_KEYS.ADVISOR_RESULT);

                    if (advisorResultStr) {
                        try {
                            const advisorResult = JSON.parse(advisorResultStr);

                            // Validate if the result is "fresh" (optional, but good for UX)
                            const urlSessionId = searchParams.get('id');
                            if (urlSessionId && advisorResult.sessionId && advisorResult.sessionId !== urlSessionId) {
                                // Session ID mismatch in storage, ignoring cached result
                            } else {
                                // Reconstruct ComprehensiveResult via normalized helper
                                const normalized = normalizeAnalysisResult(advisorResult);
                                if (normalized) {
                                    setResult(normalized);
                                }

                                if (advisorResult.faceAnalysis) {
                                    setFaceAnalysis(advisorResult.faceAnalysis);
                                }

                                if (advisorResult.sessionId) {
                                    setSessionId(advisorResult.sessionId);
                                }


                                // If we successfully recovered data, remove 'analyzing' status from URL to stop re-analysis
                                if (searchParams.get('status') === 'analyzing') {
                                    // 登录用户直接跳转到 /reports/:id，避免先到 /result?id=xxx 再重定向的多余一次跳转
                                    if (userRef.current && advisorResult.sessionId) {
                                        router.replace(`/reports/${advisorResult.sessionId}`, { scroll: false });
                                    } else {
                                        const params = new URLSearchParams(searchParams.toString());
                                        params.delete('status');
                                        if (advisorResult.sessionId) params.set('id', advisorResult.sessionId);
                                        router.replace(`/result?${params.toString()}`, { scroll: false });
                                    }
                                }
                                setLoading(false);
                                // 在提前返回前也触发埋点
                                if (!hasTrackedView.current) {
                                    trackResultView();
                                    hasTrackedView.current = true;
                                }
                                return; // Successfully recovered
                            }
                        } catch (e) {
                            console.warn("Failed to parse cached result", e);
                        }
                    }

                    // If no cached result and not in analyzing mode, redirect back
                    if (searchParams.get('status') !== 'analyzing') {
                        router.replace("/questions");
                        return;
                    }

                } catch (e) {
                    console.error("Failed to restore result:", e);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }

            // Track View (for non-early-return paths)
            if (!hasTrackedView.current) {
                trackResultView();
                hasTrackedView.current = true;
            }
        };

        loadClientData();
    }, [initialData, router, trackResultView, searchParams]);

    // --- Environment Data Integration ---
    // REMOVED: Weather component has been disabled per user request

    // Actions
    // Save result as image for sharing (image generation in progress)

    const handleSavePoster = async () => {
        if (!posterRef.current || isGeneratingPoster) return;
        try {
            setIsGeneratingPoster(true);
            // 等待图片加载
            const images = Array.from(posterRef.current.getElementsByTagName("img"));
            await Promise.all(
                images.map(
                    (img) =>
                        new Promise<void>((resolve) => {
                            if (img.complete) {
                                resolve();
                                return;
                            }
                            img.onload = () => resolve();
                            img.onerror = () => resolve();
                        })
                )
            );
            const dataUrl = await toPng(posterRef.current, {
                pixelRatio: 2,
                cacheBust: true,
            });
            // data URL → Blob URL（绕过 CSP 限制，不用 fetch）
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = `NIHPLOD-肌肤报告-${userNickname || "用户"}-${Date.now()}.png`;
            link.href = blobUrl;
            link.click();
            URL.revokeObjectURL(blobUrl);
            // 保存海报成功后触发分享埋点
            trackResultShare("image");
        } catch (error) {
            console.error("海报生成失败:", error);
        } finally {
            setIsGeneratingPoster(false);
        }
    };

    // --- Auto-Claim Session ---
    // Automatically link guest-initiated session to user account once logged in
    useEffect(() => {
        if (!user || !sessionId) return;
        
        const claimSession = async () => {
            try {
                // Check if already claimed this session (to avoid redundant calls)
                const claimedKey = STORAGE_KEYS.claimedSession(sessionId);
                if (localStorage.getItem(claimedKey)) return;

                const res = await fetch("/api/advisor/session/claim", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId })
                });
                
                if (res.ok) {
                    localStorage.setItem(claimedKey, 'true');
                    // Claim 成功后跳转到 /reports/:id，登录用户不再停留在游客形态的 /result 页面
                    // 若当前已在 /reports/:id 则避免无意义重定向
                    const reportPath = `/reports/${sessionId}`;
                    if (typeof window === 'undefined' || window.location.pathname !== reportPath) {
                        router.replace(reportPath);
                    }
                }
            } catch (err) {
                console.error("Failed to claim session:", err);
            }
        };

        claimSession();
    }, [user, sessionId, router]);


    // --- Async Analysis Integration ---
    // searchParams and useAsyncAnalysis are declared at the top of the component

    // Trigger Async Analysis
    const analysisStartedRef = useRef(false);
    const pendingRedirectSessionIdRef = useRef<string | null>(null);

    // 等 auth 初始化后再执行跳转，避免登录用户在 user 为 null 时被错误留在 /result
    useEffect(() => {
        const pendingId = pendingRedirectSessionIdRef.current;
        if (!pendingId || !authInitializedRef.current) return;
        pendingRedirectSessionIdRef.current = null;
        const resultUrl = userRef.current ? `/reports/${pendingId}` : '/result';
        router.replace(resultUrl, { scroll: false });
    }, [authInitialized, user, router]);

    useEffect(() => {
        const status = searchParams.get('status');
        // Only trigger if we are in 'analyzing' mode, no result yet, and not already running/error
        // Crucial: check 'result' state which might have been populated by loadClientData recovery
        if (status !== 'analyzing' || result || analysisState.status !== 'idle') return;
        if (analysisStartedRef.current) return;
        analysisStartedRef.current = true;

        const abortController = new AbortController();

        const execute = async () => {
            try {
                // 1. Try to recover an in-progress session from this browser tab (e.g. page refresh)
                let existingSessionId: string | null = null;
                let startedAt = 0;
                try {
                    existingSessionId = sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID);
                    startedAt = Number(sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT) || '0');
                } catch (e) {
                    console.warn('sessionStorage access failed', e);
                }
                const ANALYZING_TTL_MS = 90 * 1000;
                const shouldRecover = existingSessionId && (Date.now() - startedAt) < ANALYZING_TTL_MS;

                if (shouldRecover) {
                    const recovered = await recoverSession(existingSessionId!, abortController.signal);
                    if (recovered) {
                        const { result: rawResult, sessionId: recoveredSessionId } = recovered;

                        // Save to localStorage for normal recovery
                        try {
                            localStorage.setItem(STORAGE_KEYS.ADVISOR_RESULT, JSON.stringify(rawResult));
                        } catch (e) {
                            console.warn('localStorage save failed', e);
                        }

                        const normalized = normalizeAnalysisResult(rawResult);
                        if (normalized) setResult(normalized);
                        if (rawResult.faceAnalysis) {
                            setFaceAnalysis(rawResult.faceAnalysis as FaceAnalysisResult);
                        }
                        setSessionId(recoveredSessionId);

                        if (authInitializedRef.current) {
                            const resultUrl = userRef.current ? `/reports/${recoveredSessionId}` : '/result';
                            router.replace(resultUrl, { scroll: false });
                        } else {
                            pendingRedirectSessionIdRef.current = recoveredSessionId;
                        }
                        return;
                    }
                    // If recovery returned null (pending/not_found/forbidden), fall through to fresh analysis
                }

                // 2. Normal fresh analysis flow
                const analysisResult = await runAnalysis();
                if (!analysisResult) return; // Already running, skip
                const { result: newResult, faceAnalysis: newFace, sessionId: newSessionId } = analysisResult;

                // Save sessionId for sharing
                if (newSessionId) {
                    setSessionId(newSessionId);
                }

                if (!newSessionId) {
                    throw new Error("会话 ID 丢失，请重新测试");
                }

                // IMPORTANT: Set result state FIRST before updating URL
                setResult(newResult as unknown as ComprehensiveResult);
                if (newFace) setFaceAnalysis(newFace);

                // 等 auth 初始化后再跳转，避免 user 为 null 时登录用户被错误留在 /result
                if (authInitializedRef.current) {
                    const resultUrl = userRef.current ? `/reports/${newSessionId}` : '/result';
                    router.replace(resultUrl, { scroll: false });
                } else {
                    pendingRedirectSessionIdRef.current = newSessionId;
                }

            } catch (e: unknown) {
                console.error("Async analysis error caught in component:", e);
                // Reset ref so user can retry if they want
                analysisStartedRef.current = false;
            }
        };
        execute();

        return () => {
            abortController.abort();
        };
    }, [searchParams, result, analysisState.status, runAnalysis, recoverSession, router]);

    // Error State
    if (analysisState.status === 'error') {
        return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <div className="sm:w-[60%] text-center sm:text-left">
                            <h3 className="text-lg font-serif text-[#1A1A1A] mb-3 sm:mb-2">分析遇到了一些问题</h3>
                            <p className="text-sm text-[#5E5E5E] leading-relaxed">
                                {analysisState.error || "服务器暂时无法响应，请稍后再试。"}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                            <button
                                onClick={() => router.push('/questions?edit=true')}
                                className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                            >
                                退出
                            </button>
                        </div>
                    </div>
                </div>
                <Image src="/images/watermark.png" alt="" width={200} height={200} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-auto object-contain opacity-15 pointer-events-none" unoptimized />
            </div>
        );
    }

    // Enhanced Loading State
    const isAsyncAnalyzing = searchParams.get('status') === 'analyzing' || analysisState.status !== 'idle';
    const showLoading = loading || (!result && isAsyncAnalyzing);

    // Fallback if truly nothing to show (not loading, no result)
    if (!result && !showLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F8F7F3] px-4">
                <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm text-center">
                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-2">报告加载失败</h3>
                    <p className="text-sm text-[#5E5E5E] mb-6">数据可能已过期或不存在</p>
                    <button
                        onClick={() => router.push("/questions?edit=true")}
                        className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                    >
                        重新测试
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <AnimatePresence mode="wait">
                {showLoading && (
                    <AnalyzingOverlay
                        key="analyzing-overlay"
                        progress={analysisState.progress}
                        onCancel={() => router.push('/questions?edit=true')}
                        queuePosition={analysisState.queuePosition}
                        queueWaitSeconds={analysisState.queueWaitSeconds}
                    />
                )}
            </AnimatePresence>

            {/* --- GENDER MISMATCH MODAL (Notion Style) --- */}
            <AnimatePresence>
                {showGenderMismatchModal && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] bg-[#191919]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
                    >
                        <m.div
                            initial={{ scale: 0.95, opacity: 0, y: 8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 8 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] w-full max-w-[420px] overflow-hidden border border-[#E9E9E7]"
                        >
                            <div className="p-8">
                                {/* Header with Emoji */}
                                <div className="flex flex-col items-center text-center gap-5 mb-6">
                                    <div className="text-[42px] leading-none mb-1">⚠️</div>
                                    <div className="space-y-1.5">
                                        <h3 className="text-[18px] font-bold text-[#37352F] tracking-tight">测前信息准确性提示</h3>
                                        <p className="text-[13px] text-[#787774] font-medium">Data Accuracy Verification</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <p className="text-[14px] text-[#37352F] leading-[1.8] text-justify px-1">
                                        AI 面部识别结果显示您的面部特征更接近
                                        <span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">{faceAnalysis?.gender?.value === 'male' ? '男性' : '女性'}</span>
                                        ，但您在问卷中填写的是
                                        <span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">{socialGender === 'male' ? '男' : '女'}</span>
                                        ，二者不一致。
                                    </p>

                                    {/* Notion Callout Block - Yellow */}
                                    <div className="bg-[#FBF3DB] bg-opacity-50 p-4 rounded-lg flex items-start gap-3.5 border border-[#FBF3DB]/60">
                                        <span className="text-[16px] shrink-0 mt-0.5">💡</span>
                                        <div className="space-y-2 text-[13px] text-[#37352F] leading-relaxed">
                                            <p className="opacity-90">这可能会影响为您匹配<span className="font-bold">“针对性护肤方案”</span>的精准度，导致分析结论与您的实际肤感产生偏差。</p>
                                            <div className="h-px bg-[#37352F]/5 w-full my-1"></div>
                                            <p className="opacity-90">建议核实信息以获得更准确的建议。若是填写有误？<span className="font-semibold text-[#D9730D]">本次重新填写不消耗测试次数</span>。</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-3 pt-2">
                                        <button
                                            onClick={handleMismatchContinue}
                                            className="w-full h-11 bg-[#37352F] text-white text-[14px] font-medium rounded-[6px] hover:bg-[#2C2C2C] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <span>信息无误</span>
                                        </button>

                                        <button
                                            onClick={handleMismatchRetry}
                                            className="w-full h-11 bg-transparent text-[#787774] text-[14px] font-medium rounded-[6px] hover:bg-[#F1F1EF] hover:text-[#37352F] active:bg-[#E9E9E7] transition-all flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw size={14} strokeWidth={2.5} />
                                            <span>我填错了，重新填写</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </m.div>
                    </m.div>
                )}
            </AnimatePresence>


            {result && (
                <div className={styles.container}>
                    {/* Save Report Banner for unauthenticated users */}
                    <SaveReportBanner />

                    {/* Logo */}
                    <div className="w-full flex justify-center pt-14 pb-3">
                        <Image
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD"
                            width={120}
                            height={30}
                            className="h-8 sm:h-10 w-auto object-contain"
                            priority
                        />
                    </div>

                    {/* Validation Warning Banner */}
                    {faceAnalysis?.validation && !faceAnalysis.validation.isValid && !dismissValidationWarning && (
                        <div className="w-full bg-red-50 border-b border-red-100 relative z-[90]">
                            <div className="max-w-[1440px] mx-auto px-4 py-3 pr-10 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-red-900 mb-0.5">照片质量提示</h4>
                                    <p className="text-sm text-red-700 leading-relaxed">
                                        {faceAnalysis.validation.message}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setDismissValidationWarning(true);
                                        try { sessionStorage.setItem('advisor_dismiss_validation', 'true'); } catch { /* ignore */ }
                                    }}
                                    className="absolute right-4 top-3 p-1 rounded-full hover:bg-red-100 text-red-500 transition-colors"
                                    aria-label="关闭提示"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    <main className={styles.main}>

                        {/* Report Summary Cards */}
                        <ResultCards
                            score={faceAnalysis?.overallScore ?? (result?.dataSource === "questionnaire" ? undefined : 0)}
                            skinAge={result?.skinProfile?.skinAge || 25}
                            dimensions={faceAnalysis?.dimensions || {}}
                            nickname={userNickname}
                            gender={socialGender}
                            skinType={result?.skinProfile?.type}
                            budget={ipBudget}
                            skincareFrequency={ipSkincareFrequency}
                            summary={result?.analysis?.summary}
                            onShare={() => setShowShareModal(true)}

                            comprehensiveReport={
                                <>
                                    {/* Report Header / Summary */}
                                    <div className="mt-6 lg:mt-14 mb-6">
                                        <h4 className="text-base font-medium text-[#3d2f25] mb-3 border-b border-[#3d2f25]/20 pb-2">
                                            1、详细诊断报告 <span className="text-xs lg:text-base">(Detailed Diagnosis)</span>
                                        </h4>

                                        {/* AI Summary — 突出展示 */}{result.analysis?.summary && (
                                            <p className="text-sm lg:text-[15px] leading-relaxed text-[#3d2f25] font-medium mb-4 px-4 py-3 bg-[#3d2f25]/5 rounded-lg border-l-2 border-[#3d2f25]/30">
                                                {result.analysis.summary}
                                            </p>
                                        )}

                                        {/* Show Details if available, else fallback to Summary */}
                                        {result.analysis?.details && result.analysis.details.length > 0 ? (
                                            <div className="space-y-2 lg:space-y-3 text-xs lg:text-[14px] leading-snug lg:leading-relaxed text-[#5c4937]">
                                                {result.analysis.details.map((paragraph, idx) => (
                                                    <p key={idx}>{paragraph}</p>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[14px] leading-relaxed text-[#5c4937]">
                                                {faceAnalysis?.summary || result.analysis?.summary || "暂无详细分析摘要"}
                                            </p>
                                        )}
                                    </div>

                                    {/* Expert Advice */}
                                    <div className="mb-8">
                                        <h4 className="text-base font-medium text-[#3d2f25] mb-3 border-b border-[#3d2f25]/20 pb-2">
                                            2、专家护肤建议 <span className="text-xs lg:text-base">(Expert Recommendations)</span>
                                        </h4>
                                        {(faceAnalysis?.recommendations && faceAnalysis.recommendations.length > 0) ? (
                                            <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-xs lg:text-[14px] leading-snug lg:leading-relaxed text-[#5c4937]">
                                                {(faceAnalysis.recommendations).map((rec, idx) => (
                                                    <li key={idx}>{rec}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-xs lg:text-[14px] leading-snug lg:leading-relaxed text-[#5c4937]">
                                                <li>每日早晚温和清洁，避免过度去脂。</li>
                                                <li>严格做好防晒，减少紫外线损伤。</li>
                                                <li>根据季节调整保湿产品，保持水油平衡。</li>
                                            </ul>
                                        )}
                                    </div>

                                    {/* 3. Zone Analysis Grid (Explicitly Added) */}
                                    {faceAnalysis?.zoneAnalysis && (
                                        <div className="mb-8">
                                            <h4 className="text-base font-medium text-[#3d2f25] mb-4 border-b border-[#3d2f25]/20 pb-2">
                                                3、区域重点关注 <span className="text-xs lg:text-base">(Area Focus)</span>
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {Object.entries({
                                                    forehead: "额头区域",
                                                    tZone: "T字区域",
                                                    leftCheek: "左脸颊",
                                                    rightCheek: "右脸颊",
                                                    eyeArea: "眼周",
                                                    jawline: "下颌线"
                                                }).map(([key, label]) => {
                                                    // @ts-expect-error faceAnalysis zoneAnalysis typing is dynamic
                                                    const zoneData = faceAnalysis.zoneAnalysis[key];
                                                    if (!zoneData) return null;
                                                    return (
                                                        <div key={key} className="bg-[#3d2f25]/5 border text-left border-[#3d2f25]/15 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h5 className="font-semibold text-[#3d2f25] text-sm">{label}</h5>
                                                                <span className="text-xs bg-[#3d2f25]/8 text-[#8c7a6b] px-2 py-0.5 rounded-full">
                                                                    {zoneData.condition}
                                                                </span>
                                                            </div>
                                                            {(() => {
                                                                const metrics: string[] = [];
                                                                if (zoneData.oil !== undefined) metrics.push(`油脂${zoneData.oil > 60 ? '偏高' : zoneData.oil < 30 ? '偏低' : '适中'}`);
                                                                if (zoneData.wrinkles !== undefined) metrics.push(`皱纹${zoneData.wrinkles > 60 ? '明显' : zoneData.wrinkles > 30 ? '轻度' : '轻微'}`);
                                                                if (zoneData.texture !== undefined) metrics.push(`纹理${zoneData.texture > 70 ? '细腻' : zoneData.texture > 40 ? '一般' : '粗糙'}`);
                                                                if (zoneData.spots !== undefined) metrics.push(`色斑${zoneData.spots > 60 ? '明显' : zoneData.spots > 30 ? '少量' : '无'}`);
                                                                if (zoneData.redness !== undefined) metrics.push(`泛红${zoneData.redness > 60 ? '明显' : zoneData.redness > 30 ? '轻度' : '无'}`);
                                                                if (zoneData.darkCircles !== undefined) metrics.push(`黑眼圈${zoneData.darkCircles > 60 ? '明显' : zoneData.darkCircles > 30 ? '轻度' : '无'}`);
                                                                if (zoneData.firmness !== undefined) metrics.push(`紧致${zoneData.firmness > 70 ? '良好' : zoneData.firmness > 40 ? '一般' : '松弛'}`);
                                                                if (zoneData.contour !== undefined) metrics.push(`轮廓${zoneData.contour > 70 ? '清晰' : zoneData.contour > 40 ? '一般' : '模糊'}`);
                                                                if (metrics.length === 0) return null;
                                                                return (
                                                                    <p className="text-xs text-[#8c7a6b] mb-2 leading-snug min-h-[2.5em] line-clamp-2">
                                                                        {metrics.join(' · ')}
                                                                    </p>
                                                                );
                                                            })()}
                                                            <div className="mt-2 pt-2 border-t border-dashed border-[#3d2f25]/10">
                                                                <p className="text-xs text-emerald-700 leading-snug">
                                                                    <span className="font-medium mr-1">建议:</span>
                                                                    {zoneData.advice}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lab-Grade Analysis Metrics */}
                                    {result?.dataSource !== "questionnaire" && faceAnalysis && (
                                        <div
                                            className="rounded-xl border border-[#3d2f25]/15 bg-[#3d2f25]/5 shadow-sm overflow-hidden font-sans cursor-pointer hover:bg-[#3d2f25]/[0.07] transition-colors"
                                            onClick={() => setShowLabData(true)}
                                        >
                                            <div className="px-5 py-3 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-[#8c7a6b]" />
                                                    <span className="text-sm font-medium text-[#3d2f25]">定制化专业分析数据详情</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-[#8c7a6b] font-normal hidden sm:inline-block">
                                                        MySkin.Today™ Gold Standard
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-[#8c7a6b]" />
                                                </div>
                                            </div>
                                            <div className="px-5 pb-3 pt-0">
                                                <p className="text-[11px] text-[#8c7a6b]/80 leading-relaxed pl-6">
                                                    联系您的专属护肤顾问，或咨询门店顾问获取专业分析解读
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            }
                        />

                        {/* 定制化分析数据详情 Modal - Page Level */}
                        <AnimatePresence>
                            {showLabData && (
                                <m.div
                                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <m.div
                                        className="absolute inset-0 bg-[#3d2f25]/25 backdrop-blur-sm"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowLabData(false)}
                                    />
                                    <m.div
                                        className="relative z-10 w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[#3d2f25]/10 shadow-2xl flex flex-col bg-[#F5F2ED]"
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                    >
                                        <button
                                            onClick={() => setShowLabData(false)}
                                            className="absolute top-4 right-4 z-20 text-[#8c7a6b]/60 hover:text-[#5c4937] transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 flex-shrink-0">
                                            <div className="flex items-center gap-3">
                                                <Activity className="w-5 h-5 text-[#8c7a6b]" />
                                                <h3 className="text-lg font-bold text-[#3d2f25]">定制化专业分析数据详情</h3>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto custom-scrollbar px-6 sm:px-8 py-5 sm:py-6 flex-1">
                                            <div className="grid grid-cols-1 gap-y-0">

                                                {/* 十维分析：PC 用条形图，手机端用表单 */}
                                                {faceAnalysis?.dimensions && (
                                                    <>
                                                        <div className="hidden sm:block mb-2">
                                                            <ScientificBarChart
                                                                dimensions={faceAnalysis.dimensions}
                                                            />
                                                        </div>
                                                        <MobileDimensionForm dimensions={faceAnalysis.dimensions} />
                                                    </>
                                                )}

                                                {/* Table Header Row (Desktop only) */}
                                                <div className="hidden sm:grid grid-cols-12 text-[11px] font-semibold text-[#1B3A5C] border-b border-[#D9D0C3] py-2 px-4 tracking-wider">
                                                    <div className="col-span-5">检测指标 (Parameter)</div>
                                                    <div className="col-span-3 text-right">测定值 (Value)*</div>
                                                    <div className="col-span-2 text-right">参考范围 (Range)</div>
                                                    <div className="col-span-2 text-right">状态 (Status)</div>
                                                </div>

                                                {computeLabAnalysis(faceAnalysis).flatMap((group) => (
                                                    <div key={group.title}>
                                                        <div className="hidden sm:block">
                                                            {group.metrics.map((metric) => (
                                                                <div key={metric.param}>
                                                                    {renderLabRow(metric.param, metric.value, metric.ref, metric.status)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="sm:hidden">
                                                            {group.metrics.map((metric) => (
                                                                <MobileLabRow key={metric.param} metric={metric} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-5 pt-3 border-t border-dashed border-[#3d2f25]/15">
                                                <div className="flex gap-2.5 items-start text-[11px] leading-relaxed text-[#5c4937]">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C9A86C]" />
                                                    <div className="space-y-1.5">
                                                        <p className="font-medium text-[#3d2f25]">数据说明 (Data Disclaimer)</p>
                                                        <p>
                                                            <span className="font-semibold text-[#3d2f25]">* AI ESTIMATE:</span> 上述数值均由 AI 算法基于您的面部图像特征（纹理、色泽、对比度）反演推算得出，<span className="border-b border-[#3d2f25]/20 text-[#3d2f25]">并非物理探头实测数据</span>。
                                                        </p>
                                                        <p>
                                                            例如：皱纹严重度分级（Wrinkle Severity）是根据面部纹理与阴影的视觉表现估算而来。本报告仅作护肤参考，不可替代医疗诊断。
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </m.div>
                                </m.div>
                            )}
                        </AnimatePresence>



                    </main>

                    {/* 4. Products - 与上方专业版报告卡片（含边距）宽度对齐 */}
                    <div className="w-full max-w-[900px] mx-auto px-6 lg:px-10">
                        <ProductRecommendationSection
                            products={(result.products || []).map(p => ({
                                id: p.id,
                                name: p.name,
                                category: p.category,
                                image: p.image,
                                images: p.images || null,
                                price: p.price || '',
                                reason: p.reason,
                                description: p.description || null,
                                keyIngredients: p.keyIngredients || [],
                                benefits: p.benefits || [],
                                affiliateLinks: p.affiliateLinks || null,
                                howToUse: p.howToUse || null,
                                source: p.source,
                            } satisfies ProductCardData))}
                            isLoading={loading}
                            faceAnalysis={faceAnalysis}
                            personaLabel={result?.persona ? skinTypes.find(t => t.ipKey === result.persona)?.typeName : undefined}
                            onProductClick={(productId) => {
                                const product = result.products?.find(p => p.id === productId);
                                if (product) {
                                    trackProductClick(productId, product.name);
                                }
                            }}
                            className={styles.fadeInUp}
                            centered
                        />
                    </div>

                    {/* Global Footer */}
                    <footer className="w-full bg-transparent mt-0 py-12">
                        <div className="max-w-[900px] mx-auto px-6 lg:px-10">
                            {/* Primary & secondary actions */}
                            <div className="flex flex-row justify-center gap-3 mb-4">
                                <button
                                    onClick={() => setShowContactAdvisor(true)}
                                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 rounded-full bg-[#5c4937] text-white text-[12px] sm:text-[13px] tracking-[0.1em] font-medium hover:bg-[#4a3a2c] transition-colors"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    联系顾问
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 rounded-full border border-[#5c4937]/30 text-[#5c4937] text-[12px] sm:text-[13px] tracking-[0.1em] font-medium hover:bg-[#5c4937]/5 transition-colors"
                                >
                                    <House className="w-4 h-4" />
                                    回到首页
                                </button>
                            </div>

                            {/* 肌智派送好礼 CTA */}
                            <div className="flex justify-center mb-10">
                                <button
                                    onClick={() => router.push('/gift')}
                                    className="group inline-flex items-center justify-center gap-2 w-auto sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-full border border-dashed border-[#8B7355]/40 bg-[#8B7355]/[0.04] text-[12px] sm:text-[13px] tracking-[0.1em] text-[#8B7355] hover:text-[#5c4937] hover:border-[#5c4937]/40 hover:bg-[#5c4937]/5 transition-all duration-300"
                                >
                                    <Gift className="w-4 h-4" />
                                    肌智派送好礼 · 参与抽奖
                                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                                </button>
                            </div>

                            {/* Minimal Footer Text */}
                            <div className="text-center">
                                <div className="flex flex-row justify-center items-center gap-1 sm:gap-5 text-[10px] sm:text-xs mb-2 sm:mb-3 text-[var(--result-text-primary)]">
                                    <span className="opacity-90">© 2026 NIHPLOD. All Rights Reserved.</span>
                                    <span className="opacity-40">•</span>
                                    <a
                                        href="https://nihplod.cn/terms"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="transition-colors opacity-80 hover:opacity-100 font-medium"
                                    >
                                        服务条款
                                    </a>
                                    <span className="opacity-40 sm:hidden">•</span>
                                    <a
                                        href="https://nihplod.cn/privacy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="transition-colors opacity-80 hover:opacity-100 font-medium"
                                    >
                                        隐私政策
                                    </a>
                                </div>
                                <p className="text-[10px] sm:text-xs opacity-70 text-[var(--result-text-primary)]">
                                    *AI 分析结果受图像质量影响仅供参考，不构成医疗诊断建议
                                </p>
                            </div>
                        </div>
                    </footer>

                    <ShareModal
                        isOpen={showShareModal}
                        onClose={() => setShowShareModal(false)}
                        preview={
                            <div
                                className="shrink-0 rounded-xl p-[2px] overflow-hidden shadow-sm"
                                style={{
                                    width: 241,
                                    height: 429,
                                    background: "linear-gradient(135deg, #e6d0a8 0%, #f5dfb8 50%, #d4b483 100%)",
                                }}
                            >
                                <div className="w-full h-full rounded-[10px] overflow-hidden bg-white">
                                    <div style={{ width: 360, height: 640, transform: "scale(0.67)", transformOrigin: "0 0" }}>
                                        <SharePoster
                                            ref={posterRef}
                                            nickname={userNickname || "用户"}
                                            score={faceAnalysis?.overallScore ?? (result?.dataSource === "questionnaire" ? undefined : 0)}
                                            skinTone={faceAnalysis?.dimensions?.skinTone?.score ?? (result?.dataSource === "questionnaire" ? undefined : 0)}
                                            waterOil={faceAnalysis?.dimensions?.waterOil?.score ?? (result?.dataSource === "questionnaire" ? undefined : 0)}
                                            percentile={rankPercentile}
                                            avatar={getCharacterImage({
                                                score: faceAnalysis?.overallScore || 0,
                                                skinType: result?.skinProfile?.type || 'combination',
                                                budget: ipBudget,
                                                skincareFrequency: ipSkincareFrequency,
                                                gender: socialGender,
                                            })}
                                            posterTemplate="/images/poster-template.webp"
                                        />
                                    </div>
                                </div>
                            </div>
                        }
                        onSavePoster={handleSavePoster}
                        isGeneratingPoster={isGeneratingPoster}
                    />

                    {/* Contact Advisor Modal */}
                    <ContactAdvisorModal
                        isOpen={showContactAdvisor}
                        onClose={() => setShowContactAdvisor(false)}
                    />
                </div>)}
        </>
    );
}
