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
import { getRankPercentile, getCharacterImage } from "@/lib/result-utils";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { computeLabAnalysis } from "@/lib/analysis-lab";

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

// Types
export interface ComprehensiveResult {
    skinProfile: {
        type: string;
        typeLabel: string;
        concerns: string[];
        skinAge?: number;
    };
    analysis: {
        summary: string;
        details: string[];
    };
    products?: Array<{
        id: string;
        name: string;
        nameEn?: string;
        category: string;
        reason: string;
        image: string;
        price?: string;
        keyIngredients?: string[];
        benefits?: string[];
        affiliateLinks?: Record<string, string> | null;
        howToUse?: string | null;
    }>;
    dataSource: "comprehensive" | "questionnaire";
}

interface ResultClientProps {
    id?: string;
    initialData?: {
        result: ComprehensiveResult;
        faceAnalysis: FaceAnalysisResult | null;
    } | null;
}

/**
 * 标准化 analysisResult 数据结构，兼容新旧两种格式：
 * - 新格式: { skinProfile, analysis, products, dataSource }
 * - 旧格式: { skinAnalysis, faceAnalysis, products, ... }
 */
function normalizeAnalysisResult(raw: unknown): ComprehensiveResult | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;

    const skinProfile = (record.skinProfile as Record<string, unknown> | undefined) || (record.skinAnalysis as Record<string, unknown> | undefined);
    const analysis = (record.analysis as Record<string, unknown> | undefined) || (record.skinAnalysis as Record<string, unknown> | undefined);

    return {
        skinProfile: {
            type: (skinProfile?.type as string | undefined) || (skinProfile?.skinType as string | undefined) || "combination",
            typeLabel: (skinProfile?.typeLabel as string | undefined) || (skinProfile?.skinTypeLabel as string | undefined) || "混合性肌肤",
            concerns: (skinProfile?.concerns as string[] | undefined) || [],
            skinAge: skinProfile?.skinAge as number | undefined,
        },
        analysis: {
            summary: (analysis?.summary as string | undefined) || "分析完成。",
            details: (analysis?.details as string[] | undefined) || [],
        },
        dataSource: (record.dataSource as ComprehensiveResult["dataSource"] | undefined) || (record.source === "ai" ? "comprehensive" : "questionnaire"),
        products: (record.products as ComprehensiveResult["products"]) || [],
    };
}

// Lab Report 行渲染（抽离到组件外部，避免每次渲染重新创建）
function renderLabRow(param: string, value: string, ref: string, status: string) {
    // Determine status color based on keywords
    const goodKeywords = ['正常', 'Normal', '紧致', '细腻', '均匀', '透亮', 'Type I', '少', 'Balanced'];
    const isGood = goodKeywords.some(k => status.includes(k));

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-4 px-4 border-b border-[#E8E2D9] last:border-0 items-center hover:bg-white/60 transition-colors">
            <div className="sm:col-span-5 text-[12px] text-[#4A4A4A] font-light tracking-tight">
                {param}
            </div>
            <div className="sm:col-span-3 text-left sm:text-right text-[14px] text-[#1A1A1A] font-normal">
                {value}
            </div>
            <div className="sm:col-span-2 text-left sm:text-right text-[12px] text-[#8A8A8A] font-light">
                <span className="sm:hidden mr-2 text-[#8A8A8A]">Ref:</span>
                {ref}
            </div>
            <div className="sm:col-span-2 text-left sm:text-right text-[11px] font-light">
                <span className={isGood ? 'text-[#4A4A4A]' : 'text-[#c45a4a]'}>
                    {status} {isGood ? '' : '▲'}
                </span>
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
    useEffect(() => {
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
    }, [router]);
    const { trackResultView, trackResultShare, trackProductClick } = useAdvisorAnalytics();
    const { user, loading: authLoading, isInitialized: authInitialized } = useAuth();
    const searchParams = useSearchParams();
    const { runAnalysis, analysisState } = useAsyncAnalysis();

    // Data State
    const normalizedResult = useMemo(() => normalizeAnalysisResult(initialData?.result || null), [initialData]);
    const [result, setResult] = useState<ComprehensiveResult | null>(normalizedResult);
    const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(initialData?.faceAnalysis || null);
    const [userImage, setUserImage] = useState<string | undefined>(undefined);
    const [sideImages, setSideImages] = useState<Record<string, string>>({});

    const [userNickname, setUserNickname] = useState<string>("您");
    // Session ID for sharing - initialized from props or will be set after analysis
    const [sessionId, setSessionId] = useState<string | undefined>(id);
    const [socialGender, setSocialGender] = useState<string>(''); // Initialize empty to avoid flash mismatch

    // UI State
    const [loading, setLoading] = useState(!initialData);
    const hasTrackedView = useRef(false);

    // Gender Mismatch State
    const [showGenderMismatchModal, setShowGenderMismatchModal] = useState(false);

    // New State for interactivity

    const [showLabData, setShowLabData] = useState(false);
    const [showContactAdvisor, setShowContactAdvisor] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
    const [dismissValidationWarning, setDismissValidationWarning] = useState(false);
    const posterRef = useRef<HTMLDivElement>(null);


    const rankPercentile = useMemo(
        () => getRankPercentile(faceAnalysis?.overallScore ?? 0),
        [faceAnalysis?.overallScore]
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

    useEffect(() => {
        if (!loading && result && faceAnalysis && isGenderMismatch) {
            // Check if user already acknowledged the mismatch (prevents modal reappearing on refresh)
            const acked = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK) === 'true';
            if (!acked) {
                setShowGenderMismatchModal(true);
            }
        }
    }, [loading, result, faceAnalysis, isGenderMismatch, socialGender]);

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

        // Mark as acknowledged so we don't loop if they come back to this same result (unlikely if cleared)
        localStorage.setItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK, 'true');

        router.push("/questions");
    };

    const handleMismatchContinue = () => {
        setShowGenderMismatchModal(false);
        localStorage.setItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK, 'true');
    };




    // renderLabRow 已抽为组件外部函数，避免每次渲染重新创建


    // Initialize & Restore Data
    useEffect(() => {
        const loadClientData = async () => {
            // 1. Recover Images & Location using hybrid storage
            try {
                // Dynamically import to avoid SSR issues
                const { advisorStorage } = await import("@/lib/advisor-storage");
                const images = await advisorStorage.getFaceImages();

                if (images) {
                    if (images.front) setUserImage(images.front);
                    setSideImages(images);
                } else {
                    // Fallback: try legacy localStorage directly
                    const imgStr = localStorage.getItem(STORAGE_KEYS.ADVISOR_FACE_IMAGES);
                    if (imgStr) {
                        const legacyImages = JSON.parse(imgStr);
                        if (legacyImages.front) setUserImage(legacyImages.front);
                        setSideImages(legacyImages);
                    }
                }

                // Restore Nickname
                const storedNickname = localStorage.getItem(STORAGE_KEYS.ADVISOR_NICKNAME);
                if (storedNickname) setUserNickname(storedNickname);

                // Restore Gender
                const storedGender = localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER);
                if (storedGender) setSocialGender(storedGender);
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

                                // Handle session management logic (formerly at lines 313+)
                                const previousSessionId = sessionId;
                                if (advisorResult.sessionId && advisorResult.sessionId !== previousSessionId) {
                                    localStorage.removeItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK);
                                }

                                // If we successfully recovered data, remove 'analyzing' status from URL to stop re-analysis
                                if (searchParams.get('status') === 'analyzing') {
                                    // 登录用户直接跳转到 /reports/:id，避免先到 /result?id=xxx 再重定向的多余一次跳转
                                    if (user && advisorResult.sessionId) {
                                        router.replace(`/reports/${advisorResult.sessionId}`, { scroll: false });
                                    } else {
                                        const params = new URLSearchParams(searchParams.toString());
                                        params.delete('status');
                                        if (advisorResult.sessionId) params.set('id', advisorResult.sessionId);
                                        router.replace(`/result?${params.toString()}`, { scroll: false });
                                    }
                                }
                                setLoading(false);
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

            // Track View
            if (!hasTrackedView.current) {
                trackResultView();
                hasTrackedView.current = true;
            }
        };

        loadClientData();
    }, [initialData, router, trackResultView, sessionId, searchParams]);

    // --- Environment Data Integration ---
    // REMOVED: Weather component has been disabled per user request

    // Actions
    // Save result as image for sharing (image generation in progress)

    const handleRetake = async () => {
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANSWERS);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_GENDER);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FACE_IMAGES);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_RESULT);

        localStorage.removeItem(STORAGE_KEYS.ADVISOR_STEP);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FREE_RETRY);

        // Clear IndexedDB face images & cached results
        try {
            const { advisorStorage } = await import("@/lib/advisor-storage");
            await advisorStorage.clearAll();
        } catch (e) {
            console.error("Failed to clear IndexedDB:", e);
        }

        router.push("/questions");
    };

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
                }
            } catch (err) {
                console.error("Failed to claim session:", err);
            }
        };

        claimSession();
    }, [user, sessionId]);


    // --- Async Analysis Integration ---
    // searchParams and useAsyncAnalysis are declared at the top of the component

    // Trigger Async Analysis
    const analysisStartedRef = useRef(false);
    useEffect(() => {
        const status = searchParams.get('status');
        // Only trigger if we are in 'analyzing' mode, no result yet, and not already running/error
        // Crucial: check 'result' state which might have been populated by loadClientData recovery
        if (status === 'analyzing' && !result && analysisState.status === 'idle') {
            if (analysisStartedRef.current) return;
            analysisStartedRef.current = true;

            const execute = async () => {
                try {
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

                    // Clear previous ack so mismatch modal can re-appear for new analysis
                    localStorage.removeItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK);

                    // IMPORTANT: Set result state FIRST before updating URL
                    setResult(newResult);
                    if (newFace) setFaceAnalysis(newFace);

                    // Small delay to ensure state update is processed before potential route change logic
                    setTimeout(() => {
                        // 登录用户的结果归档到 /reports/:id；游客只看当前结果 /result
                        const resultUrl = user
                            ? `/reports/${newSessionId}`
                            : '/result';
                        router.replace(resultUrl, { scroll: false });
                    }, 50);

                } catch (e: unknown) {
                    console.error("Async analysis error caught in component:", e);
                    // Reset ref so user can retry if they want (though they'd need to re-trigger the effect)
                    analysisStartedRef.current = false;
                }
            };
            execute();
        }
    }, [searchParams, result, analysisState.status, runAnalysis, router, user]);

    // Error State
    if (analysisState.status === 'error') {
        return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                {/* Backdrop with Blur */}
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />

                {/* Modal Content */}
                <div className="relative z-10 w-full max-w-[420px] bg-white rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="p-10 pt-14 text-center pb-1">
                        <div className="mb-7 flex justify-center">
                            <Image
                                src="/NIHPLOD-logo.svg"
                                alt="NIHPLOD"
                                width={120}
                                height={30}
                                className="h-[34px] w-auto object-contain"
                                priority
                            />
                        </div>
                        <h3 className="text-base font-bold" style={{ color: '#5c4937' }}>
                            分析遇到了一些问题
                        </h3>
                    </div>

                    {/* Content */}
                    <div className="px-10 pb-10 pt-1 flex flex-col items-center gap-6">
                        <p className="text-sm leading-relaxed text-center" style={{ color: '#5c4937', opacity: 0.8 }}>
                            {analysisState.error || "服务器暂时无法响应，请稍后再试。"}
                        </p>

                        <div className="flex flex-col gap-3 w-full">
                            <button
                                onClick={() => router.push('/face-scan')}
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#5c4937] py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95 hover:bg-[#4a3a2c]"
                            >
                                重新拍摄
                            </button>
                            <button
                                onClick={() => router.push('/questions?edit=true')}
                                className="flex w-full items-center justify-center gap-2 rounded-full border border-[#5c4937]/10 bg-white py-3 text-sm font-medium text-[#5c4937] transition-colors hover:bg-[#5c4937]/5 active:scale-95"
                            >
                                返回重新测试
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Enhanced Loading State
    const isAsyncAnalyzing = searchParams.get('status') === 'analyzing' || analysisState.status !== 'idle';
    const showLoading = loading || (!result && isAsyncAnalyzing);

    // Fallback if truly nothing to show (not loading, no result)
    if (!result && !showLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
                <div className="text-center">
                    <ScanFace className="w-12 h-12 text-[#D4B78F] mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-[#5c4937] mb-2">报告加载失败</h3>
                    <p className="text-sm text-[#8c7a6b] mb-6">数据可能已过期或不存在</p>
                    <button
                        onClick={() => router.push("/questions?edit=true")}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5c4937] px-6 py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95"
                    >
                        <RotateCcw className="w-4 h-4" />
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
                                    onClick={() => setDismissValidationWarning(true)}
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
                            score={faceAnalysis?.overallScore || 0}
                            skinAge={result?.skinProfile?.skinAge || 25}
                            dimensions={faceAnalysis?.dimensions || {}}
                            nickname={userNickname}
                            gender={socialGender}
                            summary={result?.analysis?.summary}
                            onShare={() => setShowShareModal(true)}

                            comprehensiveReport={
                                <>
                                    {/* Report Header / Summary */}
                                    <div className="mt-14 mb-6">
                                        <h4 className="text-base font-medium text-[#3d2f25] mb-3 border-b border-[#3d2f25]/20 pb-2">
                                            1、详细诊断报告 (Detailed Diagnosis)
                                        </h4>

                                        {/* Show Details if available, else fallback to Summary */}
                                        {result.analysis?.details && result.analysis.details.length > 0 ? (
                                            <div className="space-y-3 text-[14px] leading-relaxed text-[#5c4937]">
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
                                            2、专家护肤建议 (Expert Recommendations)
                                        </h4>
                                        {(faceAnalysis?.recommendations && faceAnalysis.recommendations.length > 0) ? (
                                            <ul className="list-disc pl-5 space-y-2 text-[14px] leading-relaxed text-[#5c4937]">
                                                {(faceAnalysis.recommendations).map((rec, idx) => (
                                                    <li key={idx}>{rec}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-[14px] leading-relaxed text-[#5c4937]">
                                                根据您的肤质分析，建议您：
                                                1. 每日早晚温和清洁，避免过度去脂。
                                                2. 严格做好防晒，减少紫外线损伤。
                                                3. 根据季节调整保湿产品，保持水油平衡。
                                            </p>
                                        )}
                                    </div>

                                    {/* 3. Zone Analysis Grid (Explicitly Added) */}
                                    {faceAnalysis?.zoneAnalysis && (
                                        <div className="mb-8">
                                            <h4 className="text-base font-medium text-[#3d2f25] mb-4 border-b border-[#3d2f25]/20 pb-2">
                                                3、区域重点关注 (Area Focus)
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
                                                                <span className="text-xs bg-[#3d2f25]/8 text-[#8c7a6b] px-2 py-0.5 rounded-full max-w-[100px] truncate">
                                                                    {zoneData.condition}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-[#8c7a6b] mb-2 leading-snug min-h-[2.5em] line-clamp-2">
                                                                {zoneData.condition}
                                                            </p>
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
                                            <div className="flex items-center gap-3 mb-2">
                                                <Activity className="w-5 h-5 text-[#8c7a6b]" />
                                                <h3 className="text-lg font-bold text-[#3d2f25]">定制化专业分析数据详情</h3>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto custom-scrollbar px-6 sm:px-8 py-5 sm:py-6 flex-1">
                                            <div className="grid grid-cols-1 gap-y-6">

                                                {/* 十维分析条形图 */}
                                                {faceAnalysis?.dimensions && (
                                                    <div className="mb-2">
                                                        <ScientificBarChart
                                                            dimensions={faceAnalysis.dimensions}
                                                        />
                                                    </div>
                                                )}

                                                {/* Table Header Row (Desktop only) */}
                                                <div className="hidden md:grid grid-cols-12 text-[11px] font-semibold text-[#1B3A5C] border-b border-[#D9D0C3] py-3 px-4 mb-2 tracking-wider">
                                                    <div className="col-span-5">检测指标 (Parameter)</div>
                                                    <div className="col-span-3 text-right">测定值 (Value)*</div>
                                                    <div className="col-span-2 text-right">参考范围 (Range)</div>
                                                    <div className="col-span-2 text-right">状态 (Status)</div>
                                                </div>

                                                {computeLabAnalysis(faceAnalysis).map((group) => (
                                                    <div key={group.titleEn}>
                                                        <h5 className="text-[12px] font-bold text-[#5c4937] tracking-wide mb-3 px-2 py-1.5 bg-[#3d2f25]/[0.05] border-l-[3px] border-[#C9A86C]">
                                                            {group.title} ({group.titleEn})
                                                        </h5>
                                                        <div>
                                                            {group.metrics.map((metric) => (
                                                                <div key={metric.param}>
                                                                    {renderLabRow(metric.param, metric.value, metric.ref, metric.status)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-dashed border-[#3d2f25]/15">
                                                <div className="flex gap-3 items-start text-[12px] leading-relaxed text-[#5c4937]">
                                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C9A86C]" />
                                                    <div className="space-y-2">
                                                        <p className="font-bold text-[#3d2f25] uppercase tracking-wide">数据说明 (Data Disclaimer)</p>
                                                        <p>
                                                            <span className="font-semibold text-[#3d2f25]">* AI ESTIMATE:</span> 上述数值均由 AI 算法基于您的面部图像特征（纹理、色泽、对比度）反演推算得出，<span className="border-b border-[#3d2f25]/20 text-[#3d2f25]">并非物理探头实测数据</span>。
                                                        </p>
                                                        <p>
                                                            例如：TEWL（经表皮失水率）是根据皮肤屏障受损程度的视觉表现估算而来。本报告仅作护肤参考，不可替代医疗诊断。
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

                    {/* 4. Products - 突破 main 容器限制，占页面 80% */}
                    <div className="w-[80%] mx-auto">
                        <ProductRecommendationSection
                            products={(result.products || []).map(p => ({
                                id: p.id,
                                name: p.name,
                                nameEn: p.nameEn,
                                category: p.category,
                                image: p.image,
                                price: p.price || '',
                                reason: p.reason,
                                keyIngredients: p.keyIngredients || [],
                                benefits: p.benefits || [],
                                affiliateLinks: p.affiliateLinks || null,
                                howToUse: p.howToUse || null,
                            } as ProductCardData))}
                            isLoading={loading}
                            faceAnalysis={faceAnalysis}
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
                        <div className="max-w-[1440px] mx-auto px-6">
                            {/* Retake Button - Centered */}
                            <div className="flex justify-center mb-10 gap-4">
                                <button
                                    onClick={() => setShowContactAdvisor(true)}
                                    className="glass-premium-primary group relative inline-flex items-center justify-center gap-2 sm:gap-3 px-5 py-2.5 sm:px-10 sm:py-3.5 rounded-lg text-[12px] sm:text-[15px] tracking-[0.15em] font-medium disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                                >
                                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span>联系顾问</span>
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="glass-premium-primary group relative inline-flex items-center justify-center gap-2 sm:gap-3 px-5 py-2.5 sm:px-10 sm:py-3.5 rounded-lg text-[12px] sm:text-[15px] tracking-[0.15em] font-medium disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                                >
                                    <House className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span>回到首页</span>
                                </button>
                            </div>

                            {/* 肌智派送好礼 CTA Banner */}
                            <div className="flex justify-center mb-10">
                                <button
                                    onClick={() => router.push('/gift')}
                                    className="group relative inline-flex items-center gap-3 px-6 py-3 rounded-xl border border-dashed border-[#8B7355]/30 bg-[#8B7355]/[0.03] text-[13px] tracking-[0.15em] text-[#8B7355] hover:text-[#3D4430] hover:border-[#3D4430]/30 hover:bg-[#3D4430]/5 transition-all duration-500"
                                >
                                    <Gift className="w-4 h-4" />
                                    <span>肌智派送好礼 · 参与抽奖</span>
                                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-1" />
                                </button>
                            </div>

                            {/* Minimal Footer Text */}
                            <div className="text-center">
                                <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-6 text-xs mb-3 text-[var(--result-text-primary)]">
                                    <span className="opacity-90">© 2026 NIHPLOD. All Rights Reserved.</span>
                                    <span className="hidden md:inline opacity-40">•</span>
                                    <div className="flex gap-4 font-medium">
                                        <a
                                            href="https://nihplod.cn/terms"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors opacity-80 hover:opacity-100"
                                        >
                                            服务条款
                                        </a>
                                        <a
                                            href="https://nihplod.cn/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors opacity-80 hover:opacity-100"
                                        >
                                            隐私政策
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs opacity-70 text-[var(--result-text-primary)]">
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
                                            score={faceAnalysis?.overallScore || 0}
                                            skinTone={faceAnalysis?.dimensions?.skinTone?.score || 0}
                                            waterOil={faceAnalysis?.dimensions?.waterOil?.score || 0}
                                            percentile={rankPercentile}
                                            avatar={getCharacterImage(faceAnalysis?.overallScore || 0, socialGender)}
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
