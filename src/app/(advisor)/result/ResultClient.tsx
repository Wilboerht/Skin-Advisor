"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { House, MessageCircle } from "lucide-react";
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
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

import { ScientificRadarChart } from "@/components/advisor/ScientificRadarChart";


import { useAuthModal } from "@/components/auth/AuthModalContext";

import { FloatingToolbar } from "@/components/advisor/FloatingToolbar";
import { SharePoster } from "@/components/advisor/poster/SharePoster";
import { ShareModal } from "@/components/advisor/ShareModal";
import html2canvas from "html2canvas";
import { ContactAdvisorModal } from "@/components/advisor/ContactAdvisorModal";
import ReportCards from "@/components/advisor/ReportCards";

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
    const toast = useToast();
    const { trackResultView, trackResultShare, trackProductClick } = useAdvisorAnalytics();
    const { user, loading: authLoading, isInitialized: authInitialized } = useAuth();
    const { openAuthModal } = useAuthModal();
    const searchParams = useSearchParams();
    const { runAnalysis, analysisState } = useAsyncAnalysis();

    // Data State
    const [result, setResult] = useState<ComprehensiveResult | null>(initialData?.result || null);
    const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(initialData?.faceAnalysis || null);
    const [userImage, setUserImage] = useState<string | undefined>(undefined);
    const [sideImages, setSideImages] = useState<Record<string, string>>({});
    const initialAvatar = (initialData?.result as any)?.generatedAvatar || null;

    const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(initialAvatar);
    const [isAvatarLoading, setIsAvatarLoading] = useState(!initialAvatar);
    const [avatarQueueStatus, setAvatarQueueStatus] = useState<{
        position?: number;
        estimatedWaitTime?: number;
        message?: string;
    } | null>(null);
    const [userLocation, setUserLocation] = useState<{ province?: string; city?: string; lat?: number; lon?: number } | null>(null);
    const [userNickname, setUserNickname] = useState<string>("您");
    // Session ID for sharing - initialized from props or will be set after analysis
    const [sessionId, setSessionId] = useState<string | undefined>(id);
    const [socialGender, setSocialGender] = useState<string>(''); // Initialize empty to avoid flash mismatch

    // UI State
    const [loading, setLoading] = useState(!initialData);
    const hasTrackedView = useRef(false);

    const [isRedirecting, setIsRedirecting] = useState(false);

    // Gender Mismatch State
    const [showGenderMismatchModal, setShowGenderMismatchModal] = useState(false);

    // New State for interactivity

    const [showLabData, setShowLabData] = useState(false);
    const [showContactAdvisor, setShowContactAdvisor] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
    const [dismissValidationWarning, setDismissValidationWarning] = useState(false);
    const posterRef = useRef<HTMLDivElement>(null);


    const rankPercentile = useMemo(() => {
        const score = faceAnalysis?.overallScore ?? 0;
        const scoreToPercentile: { min: number; max: number; percentile: number }[] = [
            { min: 90, max: 99, percentile: 95 },
            { min: 80, max: 89, percentile: 90 },
            { min: 75, max: 79, percentile: 85 },
            { min: 70, max: 74, percentile: 80 },
            { min: 65, max: 69, percentile: 74 },
            { min: 60, max: 64, percentile: 68 },
            { min: 55, max: 59, percentile: 62 },
            { min: 0, max: 54, percentile: 55 },
        ];
        const match = scoreToPercentile.find((r) => score >= r.min && score <= r.max);
        return match ? match.percentile : 75;
    }, [faceAnalysis?.overallScore]);

    const isGenderMismatch = useMemo(() => {
        if (!faceAnalysis || !socialGender) return false;
        const faGenderVal = (faceAnalysis as any)?.gender?.value;
        const faGenderConf = (faceAnalysis as any)?.gender?.confidence || 0;

        // Normalize confidence (handle both 0-1 and 0-100)
        const normalizedConf = faGenderConf > 1 ? faGenderConf / 100 : faGenderConf;

        // Mismatch = questionnaire gender differs from detected gender with high confidence
        return faGenderVal && normalizedConf > 0.85 && faGenderVal !== socialGender;
    }, [faceAnalysis, socialGender]);

    useEffect(() => {
        if (!loading && result && faceAnalysis && isGenderMismatch) {
            // Check if user already acknowledged the mismatch (prevents modal reappearing on refresh)
            const acked = typeof window !== 'undefined' && localStorage.getItem('advisor_gender_mismatch_ack') === 'true';
            if (!acked) {
                setShowGenderMismatchModal(true);
            }
        }
    }, [loading, result, faceAnalysis, isGenderMismatch, socialGender]);

    const handleMismatchRetry = () => {
        // Clear previous answers to force a fresh start
        localStorage.removeItem("advisor_answers");
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_result");
        localStorage.removeItem("advisor_step");

        // Set a flag for "Free Retry" bypass - recognized by the question/analyze flow
        // Note: The backend must support this, or we assume a frontend check
        localStorage.setItem("advisor_free_retry", "true");

        // Mark as acknowledged so we don't loop if they come back to this same result (unlikely if cleared)
        localStorage.setItem('advisor_gender_mismatch_ack', 'true');

        router.push("/questions");
    };

    const handleMismatchContinue = () => {
        setShowGenderMismatchModal(false);
        localStorage.setItem('advisor_gender_mismatch_ack', 'true');
        toast.success("确认成功");
    };




    // Helper for Lab Report
    const renderLabRow = (param: string, value: string, ref: string, status: string) => {
        // Determine status color based on keywords
        const goodKeywords = ['正常', 'Normal', '紧致', '细腻', '均匀', '透亮', 'Type I', '少', 'Balanced'];
        const isGood = goodKeywords.some(k => status.includes(k));

        return (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-2.5 border-b border-dashed border-[#3d2f25]/10 last:border-0 items-center hover:bg-[#3d2f25]/5 transition-colors">
                <div className="sm:col-span-5 text-[12px] text-[#8c7a6b] font-mono tracking-tight uppercase">
                    {param}
                </div>
                <div className="sm:col-span-3 text-left sm:text-right font-mono text-[13px] font-semibold text-[#3d2f25]">
                    {value}
                </div>
                <div className="sm:col-span-2 text-left sm:text-right font-mono text-[11px] text-[#a89582]">
                    <span className="sm:hidden mr-2 text-[#a89582]">Ref:</span>
                    {ref}
                </div>
                <div className="sm:col-span-2 text-left sm:text-right font-mono text-[11px] font-bold">
                    <span className={isGood ? 'text-[#8c7a6b]' : 'text-[#c45a4a]'}>
                        {status} {isGood ? '' : '▲'}
                    </span>
                </div>
            </div>
        );
    };


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
                    const imgStr = localStorage.getItem("advisor_face_images");
                    if (imgStr) {
                        const legacyImages = JSON.parse(imgStr);
                        if (legacyImages.front) setUserImage(legacyImages.front);
                        setSideImages(legacyImages);
                    }
                }

                const locationStr = localStorage.getItem("userRegion");
                if (locationStr) {
                    try {
                        // Attempt to parse if it's JSON, otherwise treat as string
                        const loc = JSON.parse(locationStr);
                        setUserLocation(loc);
                    } catch {
                        setUserLocation({ province: locationStr });
                    }
                }

                // Restore Nickname
                const storedNickname = localStorage.getItem("advisor_nickname");
                if (storedNickname) setUserNickname(storedNickname);

                // Restore Gender
                const storedGender = localStorage.getItem("advisor_gender");
                if (storedGender) setSocialGender(storedGender);
            } catch (e) {
                console.error("Storage load error:", e);
            }

            // 2. If no initialData (Client-side nav), recover from LS
            if (!initialData) {
                try {
                    setLoading(true);
                    const advisorResultStr = localStorage.getItem("advisor_result");

                    if (advisorResultStr) {
                        try {
                            const advisorResult = JSON.parse(advisorResultStr);

                            // Validate if the result is "fresh" (optional, but good for UX)
                            const urlSessionId = searchParams.get('id');
                            if (urlSessionId && advisorResult.sessionId && advisorResult.sessionId !== urlSessionId) {
                                // Session ID mismatch in storage, ignoring cached result
                            } else {
                                // Reconstruct ComprehensiveResult
                                const skinProfile = advisorResult.skinProfile || advisorResult.skinAnalysis;
                                const analysis = advisorResult.analysis || advisorResult.skinAnalysis;

                                setResult({
                                    skinProfile: {
                                        type: skinProfile?.type || skinProfile?.skinType || "combination",
                                        typeLabel: skinProfile?.typeLabel || skinProfile?.skinTypeLabel || "混合性肌肤",
                                        concerns: skinProfile?.concerns || [],
                                        skinAge: skinProfile?.skinAge,
                                    },
                                    analysis: {
                                        summary: analysis?.summary || "分析完成。",
                                        details: analysis?.details || [],
                                    },
                                    dataSource: advisorResult.dataSource || (advisorResult.source === "ai" ? "comprehensive" : "questionnaire"),
                                    products: advisorResult.products || []
                                });

                                if (advisorResult.faceAnalysis) {
                                    setFaceAnalysis(advisorResult.faceAnalysis);
                                }

                                if (advisorResult.sessionId) {
                                    setSessionId(advisorResult.sessionId);
                                }

                                // Handle session management logic (formerly at lines 313+)
                                const previousSessionId = sessionId;
                                if (advisorResult.sessionId && advisorResult.sessionId !== previousSessionId) {
                                    localStorage.removeItem('advisor_gender_mismatch_ack');
                                }

                                // If we successfully recovered data, remove 'analyzing' status from URL to stop re-analysis
                                if (searchParams.get('status') === 'analyzing') {
                                    const params = new URLSearchParams(searchParams.toString());
                                    params.delete('status');
                                    if (advisorResult.sessionId) params.set('id', advisorResult.sessionId);
                                    router.replace(`/result?${params.toString()}`, { scroll: false });
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
                    toast.error("数据加载失败");
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
    }, [initialData, router, trackResultView, toast]);

    // --- Avatar Polling ---
    // Poll for avatar generation if we don't have one yet
    // For guests: also check localStorage first
    // Improved robustness: error handling, retry logic, timeout feedback
    const avatarPollRef = useRef({ failureCount: 0, hasStarted: false });

    useEffect(() => {
        if (!sessionId || generatedAvatar || !isAvatarLoading) {
            avatarPollRef.current.hasStarted = false;
            return;
        }

        // For guests: try to get avatar from localStorage first
        if (!user) {
            try {
                const guestAvatarUrl = localStorage.getItem(`guest_avatar_${sessionId}`);

                if (guestAvatarUrl && (guestAvatarUrl.startsWith('http') || guestAvatarUrl.startsWith('data:'))) {

                    setGeneratedAvatar(guestAvatarUrl);
                    setIsAvatarLoading(false);
                    return;
                }
            } catch (e) {
                // ignore localStorage read errors
            }
        }

        // Prevent multiple simultaneous polls
        if (avatarPollRef.current.hasStarted) {
            return;
        }

        avatarPollRef.current.hasStarted = true;
        avatarPollRef.current.failureCount = 0;

        const pollAvatar = async () => {
            // 页面在后台标签页时不发起网络请求，节省电池和流量
            if (typeof document !== "undefined" && document.hidden) return;

            try {
                const response = await fetch(`/api/advisor/avatar/status?sessionId=${sessionId}&t=${Date.now()}`);
                
                if (response.ok) {
                    const data = await response.json();

                    
                    // 更新队列状态
                    if (data.queueStatus && data.queueStatus !== 'completed') {
                        setAvatarQueueStatus({
                            position: data.queuePosition,
                            estimatedWaitTime: data.estimatedWaitTime,
                            message: data.message
                        });
                    }
                    
                    // Validate avatar URL format

                    if (data.generatedAvatar && typeof data.generatedAvatar === 'string') {
                        // Basic URL validation
                        if (data.generatedAvatar.startsWith('http') || data.generatedAvatar.startsWith('data:')) {

                            setGeneratedAvatar(data.generatedAvatar);
                            setIsAvatarLoading(false);
                            setAvatarQueueStatus(null);

                            return;
                        } else {

                        }
                    } else {

                    }
                    
                    // Reset error count on successful connection
                    avatarPollRef.current.failureCount = 0;
                } else if (response.status === 404) {
                    // SessionID not found (shouldn't happen in normal flow)
                    avatarPollRef.current.failureCount = 999; // Force timeout
                } else if (response.status >= 500) {
                    // Server error, increment failure counter
                    avatarPollRef.current.failureCount++;
                    console.warn(`Avatar API server error (${response.status}), failures: ${avatarPollRef.current.failureCount}`);
                } else {
                    // Other HTTP errors
                    avatarPollRef.current.failureCount++;
                    console.warn(`Avatar API error (${response.status})`);
                }
            } catch (err) {
                avatarPollRef.current.failureCount++;
                console.error(`Failed to poll avatar (attempt ${avatarPollRef.current.failureCount}):`, err);
            }

            // Stop after 5 consecutive failures
            if (avatarPollRef.current.failureCount >= 5) {
                console.warn("Avatar polling stopped after 5 failures - using fallback");
                setIsAvatarLoading(false);
            }
        };

        // 动态轮询间隔：队列中时 3s，已处理时 2.5s，避免压垮数据库连接池
        const pollInterval = setInterval(pollAvatar, avatarQueueStatus ? 3000 : 2500);
        const pollTimeout = setTimeout(() => {
            clearInterval(pollInterval);
            if (isAvatarLoading) {
                console.warn("Avatar generation timeout (120s) - using original photo");
                setIsAvatarLoading(false);
                setAvatarQueueStatus(null);
            }
        }, 120000); // 增加到 120 秒，因为可能需要排队
        
        // Immediate first poll to catch avatar if already available
        pollAvatar();

        return () => {
            clearInterval(pollInterval);
            clearTimeout(pollTimeout);
            avatarPollRef.current.hasStarted = false;
        };
    }, [sessionId, generatedAvatar, isAvatarLoading, avatarQueueStatus]);

    // --- Guest Protection Guard ---
    // Prevent direct access to full report by guests via URL
    useEffect(() => {
        // Skip if still loading auth/data or essential data missing
        if (loading || authLoading || !authInitialized || !result || !sessionId) return;

        // Skip if currently running analysis (handled by specific analysis effect)
        if (searchParams.get('status') === 'analyzing') return;

        // Skip if result was loaded from this device's localStorage
        // (same device = session owner, no need to restrict even if auth fails)
        if (!initialData && localStorage.getItem("advisor_result")) return;

        // If Guest accessing full report via URL -> Redirect to Share Page (Simplified)
        if (!user) {
            setIsRedirecting(true);
            router.replace(`/report/guest?id=${sessionId}`);
        }
    }, [user, authLoading, authInitialized, loading, result, sessionId, searchParams, router, initialData]);

    // --- Guest Avatar Migration ---
    // When a guest user logs in, migrate their guest avatar from localStorage to user account
    const avatarMigrationRef = useRef(false);

    useEffect(() => {
        if (!sessionId || !user || avatarMigrationRef.current) {
            return;
        }

        // Only migrate if we were previously a guest (no user) but now logged in
        const previousWasGuest = userRef.current === null || userRef.current === undefined;
        if (!previousWasGuest) {
            return;
        }

        // Mark as migration started to prevent duplicate calls
        avatarMigrationRef.current = true;

        (async () => {
            try {
                // Check if there's a guest avatar in localStorage
                const guestAvatarUrl = localStorage.getItem(`guest_avatar_${sessionId}`);
                
                if (guestAvatarUrl) {
                    const response = await fetch("/api/advisor/avatar/migrate-guest", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            sessionId,
                            avatarUrl: guestAvatarUrl
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && !data.skipped) {
                            // Remove from localStorage since it's now stored on server
                            localStorage.removeItem(`guest_avatar_${sessionId}`);
                        }
                    } else {
                        console.warn("Avatar migration failed:", response.status);
                    }
                } else {
                    // No guest avatar found to migrate
                }
            } catch (err) {
                console.error("❌ Failed to migrate guest avatar:", err);
                // Non-blocking error - don't show to user, just log
            }
        })();
    }, [sessionId, user]);

    // --- Environment Data Integration ---
    // REMOVED: Weather component has been disabled per user request

    // Recover Bio-Factors from LocalStorage (Questionnaire Answers)
    // Extracted outside useMemo so handleDownload can reuse the same data for PDF consistency
    const bioFactors = useMemo(() => {
        const factors: any = {};
        if (typeof window !== 'undefined') {
            try {
                const answersStr = localStorage.getItem("advisor_answers");
                if (answersStr) {
                    const answers = JSON.parse(answersStr);
                    const stressVal = JSON.stringify(answers.stressLevel || "").toLowerCase();
                    const sleepVal = JSON.stringify(answers.sleepQuality || "").toLowerCase();

                    if (stressVal.includes("high") || stressVal.includes("大") || stressVal.includes("强")) factors.stressLevel = "high";
                    else if (stressVal.includes("low") || stressVal.includes("小")) factors.stressLevel = "low";
                    else factors.stressLevel = "medium";

                    if (sleepVal.includes("poor") || sleepVal.includes("差") || sleepVal.includes("less")) factors.sleepQuality = "poor";
                    else if (sleepVal.includes("good") || sleepVal.includes("好")) factors.sleepQuality = "good";
                    else factors.sleepQuality = "fair";

                    if (answers.menstrualCycle === "luteal") factors.menstrualPhase = "luteal";
                    if (answers.gender) factors.gender = answers.gender;
                }
            } catch (e) {
                console.error("Failed to parse bio-factors", e);
            }
        }
        return factors;
    }, []);

    // Actions
    // Save result as image for sharing (image generation in progress)


    const handleDownload = async () => {
        if (!result) return;

        // PDF 下载限制为登录功能 — 作为注册钩子
        if (!user) {
            toast.info("注册后即可下载完整 PDF 报告");
            openAuthModal("register");
            return;
        }

        toast.info("正在生成 PDF 报告...");
        try {
            const response = await fetch("/api/advisor/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    skinProfile: result.skinProfile,
                    analysis: result.analysis,
                    faceAnalysis: faceAnalysis,
                    location: userLocation,
                    bioFactors: bioFactors
                })
            });

            if (!response.ok) throw new Error("PDF generation failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SkinAnalysis_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("PDF 下载成功");
        } catch (e) {
            console.error(e);
            toast.error("生成失败，请稍后重试");
        }
    };

    const handleRetake = async () => {
        localStorage.removeItem("advisor_answers");
        localStorage.removeItem("advisor_gender");
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_result");

        localStorage.removeItem("advisor_step");
        localStorage.removeItem("advisor_gender_mismatch_ack");
        localStorage.removeItem("advisor_free_retry");

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
            toast.info("正在生成分享海报...");
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
            const canvas = await html2canvas(posterRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                logging: false,
            });
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = `NIHPLOD-肌肤报告-${userNickname || "用户"}-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            toast.success("海报已保存到相册");
        } catch (error) {
            console.error("海报生成失败:", error);
            toast.error("海报生成失败，请重试");
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
                const claimedKey = `claimed_${sessionId}`;
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

    // Track user state for async access
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

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
                    const { result: newResult, faceAnalysis: newFace, sessionId: newSessionId } = await runAnalysis();

                    // Save sessionId for sharing
                    if (newSessionId) {
                        setSessionId(newSessionId);
                    }

                    // CHECK GUEST STATUS: Redirect to simplified report
                    // Use ref to get fresh state (closure might have stale user)
                    if (!userRef.current) {
                        setIsRedirecting(true);
                        // Ensure overlay stays while redirecting
                        router.replace(`/report/guest?id=${newSessionId}`);
                        return;
                    }

                    // Clear previous ack so mismatch modal can re-appear for new analysis
                    localStorage.removeItem('advisor_gender_mismatch_ack');
                    
                    // IMPORTANT: Set result state FIRST before updating URL
                    setResult(newResult);
                    if (newFace) setFaceAnalysis(newFace);

                    // Small delay to ensure state update is processed before potential route change logic
                    setTimeout(() => {
                        // Update URL with sessionId for bookmark/refresh support
                        router.replace(`/result?id=${newSessionId}`, { scroll: false });
                    }, 50);

                } catch (e: any) {
                    console.error("Async analysis error caught in component:", e);
                    // Reset ref so user can retry if they want (though they'd need to re-trigger the effect)
                    analysisStartedRef.current = false;
                }
            };
            execute();
        }
    }, [searchParams, result, analysisState.status, runAnalysis, router]);

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
                            <img
                                src="/NIHPLOD-logo.svg"
                                alt="NIHPLOD"
                                className="h-[34px] object-contain"
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
                                onClick={() => router.push('/questions')}
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
    // 分析完成后，如果头像还在生成，继续显示 loading（前端轮询最多 120 秒超时，不会无限等待）
    const isWaitingForAvatar = !!result && isAvatarLoading && !generatedAvatar;
    const showLoading = loading || (!result && isAsyncAnalyzing) || isRedirecting || isWaitingForAvatar;

    // Fallback if truly nothing to show (not loading, no result)
    if (!result && !showLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
                <div className="text-center">
                    <ScanFace className="w-12 h-12 text-[#D4B78F] mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-[#5c4937] mb-2">报告加载失败</h3>
                    <p className="text-sm text-[#8c7a6b] mb-6">数据可能已过期或不存在</p>
                    <button
                        onClick={() => router.push("/questions")}
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
                        progress={isWaitingForAvatar ? 99 : analysisState.progress}
                        onCancel={() => router.push('/questions')}
                        waitingForAvatar={isWaitingForAvatar}
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
                                        为了确保报告建议的严谨性，智能识别引擎对多维数据进行了对冲校验，发现当前的<span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">底层算法数据模型</span>
                                        与您在问卷中选择的<span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">性别选项 ({socialGender === 'male' ? '男' : '女'})</span> 存在一定程度的不一致。
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
                    {/* Logo */}
                    <div className="w-full flex justify-center pt-14 pb-3">
                        <img
                            src="/images/NIHPLOD-logo.svg"
                            alt="NIHPLOD MONACO"
                            className="h-8 sm:h-10 object-contain"
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
                        <ReportCards
                            score={faceAnalysis?.overallScore || 0}
                            skinAge={result?.skinProfile?.skinAge || 25}
                            dimensions={faceAnalysis?.dimensions || {}}
                            nickname={userNickname}
                            generatedAvatar={generatedAvatar}
                            isAvatarLoading={isAvatarLoading}
                            summary={result?.analysis?.summary}
                            onShare={() => setShowShareModal(true)}
                            isLoggedIn={!!user}
                            onLoginClick={() => openAuthModal('register')}

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
                                                    // @ts-ignore
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

                            {/* VIP Analysis Section removed per user request */}

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
                                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowLabData(false)}
                                    />
                                    <m.div
                                        className="relative z-10 w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[#3d2f25]/10 shadow-2xl flex flex-col"
                                        style={{ background: 'linear-gradient(180deg, #F5EDE2 0%, #EDE4D6 100%)' }}
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                    >
                                        <button
                                            onClick={() => setShowLabData(false)}
                                            className="absolute top-4 right-4 z-20 text-[#3d2f25]/40 hover:text-[#3d2f25] transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 flex-shrink-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Activity className="w-5 h-5 text-[#8c7a6b]" />
                                                <h3 className="text-lg font-bold text-[#3d2f25]">定制化专业分析数据详情</h3>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto custom-scrollbar px-6 sm:px-8 pb-6 sm:pb-8 flex-1 text-sm leading-6">
                                            <div className="grid grid-cols-1 gap-y-6">

                                                {/* 十维分析条形图 */}
                                                {faceAnalysis?.dimensions && (
                                                    <div className="mb-2">
                                                        <ScientificRadarChart
                                                            dimensions={faceAnalysis.dimensions}
                                                        />
                                                    </div>
                                                )}

                                                {/* Table Header Row (Desktop only) */}
                                                <div className="hidden md:grid grid-cols-12 text-[11px] text-[#8c7a6b] border-b border-[#3d2f25]/10 pb-2 mb-2 font-mono uppercase tracking-wider">
                                                    <div className="col-span-5">检测指标 (Parameter)</div>
                                                    <div className="col-span-3 text-right">测定值 (Value)*</div>
                                                    <div className="col-span-2 text-right">参考范围 (Range)</div>
                                                    <div className="col-span-2 text-right">状态 (Status)</div>
                                                </div>

                                                {/* Group 1: Biophysical Profile */}
                                                <div>
                                                    <h5 className="text-[12px] font-bold font-mono text-[#8c7a6b] tracking-wide uppercase mb-3 px-2 py-1 bg-[#3d2f25]/8 border-l-[3px] border-[#3d2f25]/20">
                                                        I. 生物物理特性 (Biophysical Profile)
                                                    </h5>
                                                    <div className="space-y-1">
                                                        {renderLabRow("皮肤 pH 值 (Est. pH)",
                                                            faceAnalysis?.labAnalysis?.skinPh?.value ? `${faceAnalysis.labAnalysis.skinPh.value}` :
                                                                (faceAnalysis?.dimensions ? (5.5 + (faceAnalysis.dimensions.waterOil.score < 60 ? 0.4 : -0.2) + ((faceAnalysis.dimensions.waterOil.score % 100) / 1000 * 3)).toFixed(1) : '?'),
                                                            faceAnalysis?.labAnalysis?.skinPh?.range || "4.5 - 5.5",
                                                            faceAnalysis?.labAnalysis?.skinPh?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.waterOil.score < 60 ? '偏碱' : '正常') : '-'))}

                                                        {renderLabRow("经表皮失水率 (TEWL)",
                                                            faceAnalysis?.labAnalysis?.tewl?.value ? `${faceAnalysis.labAnalysis.tewl.value} ${faceAnalysis.labAnalysis.tewl.unit || 'g/m²/h'}` :
                                                                (faceAnalysis?.dimensions ? `${(20 - (faceAnalysis.dimensions.sensitivity.score / 100) * 12).toFixed(1)} g/m²/h` : '?'),
                                                            "< 10.0 g/m²/h",
                                                            faceAnalysis?.labAnalysis?.tewl?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.sensitivity.score > 80 ? '正常' : '偏高') : '-'))}

                                                        {renderLabRow("角质层含水量 (Hydration)",
                                                            faceAnalysis?.hydration?.level ? (faceAnalysis.hydration.percent ? `${faceAnalysis.hydration.percent} AU` :
                                                                (faceAnalysis.dimensions ? `${(20 + (faceAnalysis.dimensions.waterOil.score / 100) * 40).toFixed(1)} AU` : '?')) : '?',
                                                            "> 35.0 AU",
                                                            faceAnalysis?.hydration?.level ? (faceAnalysis.hydration.level === 'low' ? '偏低' : '正常') : '-')}

                                                        {renderLabRow("真皮层弹性 (Elasticity R2)",
                                                            faceAnalysis?.labAnalysis?.elasticity?.value ? `${faceAnalysis.labAnalysis.elasticity.value}` :
                                                                (faceAnalysis?.dimensions ? `${(0.4 + (faceAnalysis.dimensions.firmness.score / 100) * 0.5).toFixed(2)}` : '?'),
                                                            "> 0.70",
                                                            faceAnalysis?.labAnalysis?.elasticity?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.firmness.score > 60 ? '紧致' : '松弛') : '-'))}
                                                    </div>
                                                </div>

                                                {/* Group 2: Pigmentation & Vascularity */}
                                                <div>
                                                    <h5 className="text-[12px] font-bold font-mono text-[#8c7a6b] tracking-wide uppercase mb-3 px-2 py-1 bg-[#3d2f25]/8 border-l-[3px] border-[#3d2f25]/20">
                                                        II. 色基分布分析 (Chromophore Map)
                                                    </h5>
                                                    <div className="space-y-1">
                                                        {renderLabRow("黑色素指数 (Melanin Index)",
                                                            faceAnalysis?.labAnalysis?.melanin?.value ? `${faceAnalysis.labAnalysis.melanin.value} MI` :
                                                                (faceAnalysis?.dimensions ? `${Math.round(220 - (faceAnalysis.dimensions.spots.score * 1.5))} MI` : '?'),
                                                            "< 150 MI",
                                                            faceAnalysis?.labAnalysis?.melanin?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.spots.score < 60 ? '偏高' : '正常') : '-'))}

                                                        {renderLabRow("红斑指数 (Erythema Index)",
                                                            faceAnalysis?.labAnalysis?.erythema?.value ? `${faceAnalysis.labAnalysis.erythema.value} EI` :
                                                                (faceAnalysis?.dimensions ? `${Math.round(350 - (faceAnalysis.dimensions.sensitivity.score * 2.2))} EI` : '?'),
                                                            "< 200 EI",
                                                            faceAnalysis?.labAnalysis?.erythema?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.sensitivity.score < 60 ? '偏高' : '正常') : '-'))}

                                                        {renderLabRow("光老化等级 (Glogau Scale)",
                                                            faceAnalysis?.labAnalysis?.glogau?.value ? `${faceAnalysis.labAnalysis.glogau.value}` : (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.uvDamage.score > 40 ? 'III 型' : faceAnalysis.dimensions.uvDamage.score > 30 ? 'II 型' : 'I 型') : '?'),
                                                            "Age Dependent",
                                                            faceAnalysis?.labAnalysis?.glogau?.status || "-")}

                                                        {renderLabRow("肤色均匀度 (Homogeneity)",
                                                            faceAnalysis?.labAnalysis?.homogeneity?.value ? `${faceAnalysis.labAnalysis.homogeneity.value}${faceAnalysis.labAnalysis.homogeneity.unit || '%'}` :
                                                                (faceAnalysis?.dimensions ? `${(8 + (100 - faceAnalysis.dimensions.skinTone.score) * 0.15).toFixed(1)}% C.V.` : '?'),
                                                            "< 15% C.V.",
                                                            faceAnalysis?.labAnalysis?.homogeneity?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.skinTone.score > 80 ? '均匀' : '不均') : '-'))}

                                                        {renderLabRow("眼周色素对比度 (Periorbital Contrast)",
                                                            (faceAnalysis?.dimensions?.darkCircles) ?
                                                                `${(1.2 + (100 - faceAnalysis.dimensions.darkCircles.score) * 0.05).toFixed(1)} Delta E` : '?',
                                                            "< 3.0 Delta E",
                                                            (faceAnalysis?.dimensions?.darkCircles) ? (faceAnalysis.dimensions.darkCircles.score > 80 ? '正常' : '明显') : '-')}
                                                    </div>
                                                </div>

                                                {/* Group 3: Surface & Microbiome */}
                                                <div>
                                                    <h5 className="text-[12px] font-bold font-mono text-[#8c7a6b] tracking-wide uppercase mb-3 px-2 py-1 bg-[#3d2f25]/8 border-l-[3px] border-[#3d2f25]/20">
                                                        III. 表面与微生态 (Surface & Microbiome)
                                                    </h5>
                                                    <div className="space-y-1">
                                                        {renderLabRow("卟啉计数 (Porphyrins)",
                                                            faceAnalysis?.labAnalysis?.porphyrins?.value ? `${faceAnalysis.labAnalysis.porphyrins.value}` :
                                                                (faceAnalysis?.dimensions ? `${Math.round(40 - (faceAnalysis.dimensions.acne.score * 0.35))}` : '?'),
                                                            "Low Risk",
                                                            faceAnalysis?.labAnalysis?.porphyrins?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.acne.score < 60 ? '偏多' : faceAnalysis.dimensions.acne.score < 80 ? '中等' : '少') : '-'))}

                                                        {renderLabRow("皮脂分泌率 (Sebum Rate)",
                                                            faceAnalysis?.labAnalysis?.sebum?.value ? `${faceAnalysis.labAnalysis.sebum.value}` :
                                                                (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.waterOil.score < 60 ? 'High' : 'Normal') : '?'),
                                                            "Balanced",
                                                            faceAnalysis?.labAnalysis?.sebum?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.waterOil.score < 60 ? '旺盛' : '正常') : '-'))}

                                                        {renderLabRow("皮肤平滑度 (Roughness Ra)",
                                                            faceAnalysis?.labAnalysis?.roughness?.value ? `${faceAnalysis.labAnalysis.roughness.value} ${faceAnalysis.labAnalysis.roughness.unit || 'µm'}` :
                                                                (faceAnalysis?.dimensions ? `${(5 + (100 - faceAnalysis.dimensions.firmness.score) * 0.15).toFixed(1)} µm` : '?'),
                                                            "< 10.0 µm",
                                                            faceAnalysis?.labAnalysis?.roughness?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.firmness.score < 70 ? '粗糙' : '细腻') : '-'))}

                                                        {renderLabRow("光泽度指数 (Glossiness GU)",
                                                            faceAnalysis?.labAnalysis?.glossiness?.value ? `${faceAnalysis.labAnalysis.glossiness.value} ${faceAnalysis.labAnalysis.glossiness.unit || 'GU'}` :
                                                                (faceAnalysis?.dimensions ? `${(faceAnalysis.dimensions.radiance.score * 0.1).toFixed(1)} GU` : '?'),
                                                            "> 6.0 GU",
                                                            faceAnalysis?.labAnalysis?.glossiness?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.radiance.score > 60 ? '透亮' : '暗沉') : '-'))}

                                                        {renderLabRow("皱纹严重度分级 (Wrinkle Severity)",
                                                            faceAnalysis?.labAnalysis?.wrinkleGrade?.value ? `${faceAnalysis.labAnalysis.wrinkleGrade.value}` : (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.wrinkles.score > 80 ? 'Grade 1 (None)' : faceAnalysis.dimensions.wrinkles.score > 60 ? 'Grade 2 (Fine)' : 'Grade 3 (Deep)') : '?'),
                                                            "Grade 1",
                                                            faceAnalysis?.labAnalysis?.wrinkleGrade?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.wrinkles.score > 60 ? '正常' : '明显') : '-'))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-dashed border-[#3d2f25]/15">
                                                <div className="flex gap-2.5 items-start text-[11px] leading-relaxed text-[#8c7a6b] font-mono">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#a89582]" />
                                                    <div className="space-y-2">
                                                        <p className="font-bold text-[#3d2f25] uppercase tracking-wide">数据说明 (Data Disclaimer)</p>
                                                        <p>
                                                            <span className="font-semibold text-[#5c4937]">* AI ESTIMATE:</span> 上述数值均由 AI 算法基于您的面部图像特征（纹理、色泽、对比度）反演推算得出，<span className="border-b border-[#3d2f25]/20 text-[#5c4937]">并非物理探头实测数据</span>。
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
                                    className="glass-premium-primary animate-float-premium group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 sm:px-10 rounded-full text-[14px] sm:text-[15px] tracking-[0.15em] font-medium disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    <span>联系顾问</span>
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="glass-premium-primary animate-float-premium group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 sm:px-10 rounded-full text-[14px] sm:text-[15px] tracking-[0.15em] font-medium disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                                >
                                    <House className="w-5 h-5" />
                                    <span>回到首页</span>
                                </button>
                            </div>

                            {/* Minimal Footer Text */}
                            <div className="text-center">
                                <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-6 text-xs mb-3">
                                    <span className="opacity-90" style={{ color: '#5c4937' }}>© 2026 NIHPLOD. All Rights Reserved.</span>
                                    <span className="hidden md:inline" style={{ color: '#5c4937', opacity: 0.4 }}>•</span>
                                    <div className="flex gap-4 font-medium">
                                        <a
                                            href="https://nihplod.cn/terms"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors"
                                            style={{ color: '#5c4937', opacity: 0.8 }}
                                        >
                                            服务条款
                                        </a>
                                        <a
                                            href="https://nihplod.cn/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors"
                                            style={{ color: '#5c4937', opacity: 0.8 }}
                                        >
                                            隐私政策
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs" style={{ color: '#5c4937', opacity: 0.7 }}>
                                    *AI 分析结果受图像质量影响仅供参考，不构成医疗诊断建议
                                </p>
                            </div>
                        </div>
                    </footer>

                    {/* Save Report Banner for unauthenticated users */}
                    <SaveReportBanner />

                    {/* Floating Toolbar */}
                    <FloatingToolbar
                        onSharePoster={() => setShowShareModal(true)}
                        onRetake={() => router.push("/questions")}
                        onChat={() => setShowContactAdvisor(true)}
                        onHome={() => router.push("/")}
                    />

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
                                            skinAge={result?.skinProfile?.skinAge || 25}
                                            percentile={rankPercentile}
                                            avatar={generatedAvatar}
                                            posterTemplate="/images/poster-template.svg"
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
