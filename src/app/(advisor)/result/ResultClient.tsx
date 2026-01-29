"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAsyncAnalysis } from "@/hooks/useAsyncAnalysis";
import { Link } from "next-view-transitions";
import { motion as m, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
    Download,
    Share2,
    RotateCcw,
    ChevronRight,
    ScanFace,
    Activity,
    Search,
    Sun,
    Moon,
    Gift, // Import Gift icon
    ClipboardList,
    AlertCircle,
    FlaskConical,
    Link as LinkIcon,
    X,
    MapPin,
    Droplets,
    Play // Import Play icon
} from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";
import type { FaceAnalysisResult, ZoneAnalysis } from "@/lib/advisor-utils";
import { DIMENSION_LABELS, SkinDimensionKey, getDefaultFaceAnalysisResult } from "@/lib/advisor-utils";
import { getDimensionAdvice } from "@/lib/advice-utils";
import { ScientificRadarChart } from "@/components/advisor/ScientificRadarChart";
import { generateSkincareRoutines, getClimateByRegion } from "@/lib/skincare-dosage";
import { copyToClipboard, generateShareUrl } from "@/lib/share";
import { AIChatWindow } from "@/components/advisor/AIChatWindow";
import { ShareRewardBanner } from "@/components/advisor/ShareRewardBanner";

// Import the new CSS Module
import styles from "./result.module.css";
import sidebarStyles from "./sidebar.module.css";
import { SkincareDashboard } from "@/components/advisor/SkincareDashboard";
import { ProductRecommendationSection } from "@/components/advisor/ProductRecommendationSection";
import type { ProductCardData } from "@/components/advisor/ProductCard";
import { addProductToRoutine } from "@/lib/routine-products";
import { WishlistNavButton } from "@/components/advisor/WishlistNavButton";
import { SaveReportBanner } from "@/components/advisor/SaveReportBanner";

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

export default function ResultClient({ id, initialData }: ResultClientProps) {
    const router = useRouter();
    const toast = useToast();
    const { trackResultView, trackResultShare, trackProductClick } = useAdvisorAnalytics();

    // Data State
    const [result, setResult] = useState<ComprehensiveResult | null>(initialData?.result || null);
    const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(initialData?.faceAnalysis || null);
    const [userImage, setUserImage] = useState<string | undefined>(undefined);
    const [sideImages, setSideImages] = useState<Record<string, string>>({});
    const [userLocation, setUserLocation] = useState<{ province?: string; city?: string; lat?: number; lon?: number } | null>(null);

    // UI State
    const [activeRoutineTab, setActiveRoutineTab] = useState<'morning' | 'evening'>('morning');
    const [loading, setLoading] = useState(!initialData);
    const hasTrackedView = useRef(false);

    // New State for interactivity
    const [activeDimension, setActiveDimension] = useState<SkinDimensionKey | null>(null);
    const [showLabData, setShowLabData] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(0);
    const [selectedCycleDay, setSelectedCycleDay] = useState<number>(1);
    const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);

    // Set default active dimension once data is loaded
    useEffect(() => {
        if (faceAnalysis?.dimensions && !activeDimension) {
            // Find lowest score to focus on first, or default to 'spots'
            // @ts-ignore
            const lowest = Object.entries(faceAnalysis.dimensions).sort((a, b) => a[1].score - b[1].score)[0];
            setActiveDimension((lowest?.[0] as SkinDimensionKey) || 'spots');
        }
    }, [faceAnalysis]);

    // Helper for Lab Report
    // Helper for Lab Report
    const renderLabRow = (param: string, value: string, ref: string, status: string) => {
        // Determine status color based on keywords
        const goodKeywords = ['正常', 'Normal', '紧致', '细腻', '均匀', '透亮', 'Type I', '少', 'Balanced'];
        const isGood = goodKeywords.some(k => status.includes(k));

        return (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0 items-center hover:bg-gray-50 transition-colors">
                <div className="sm:col-span-5 text-[12px] text-gray-500 font-mono tracking-tight uppercase">
                    {param}
                </div>
                <div className="sm:col-span-3 text-left sm:text-right font-mono text-[13px] font-semibold text-gray-900">
                    {value}
                </div>
                <div className="sm:col-span-2 text-left sm:text-right font-mono text-[11px] text-gray-400">
                    <span className="sm:hidden mr-2 text-gray-300">Ref:</span>
                    {ref}
                </div>
                <div className="sm:col-span-2 text-left sm:text-right font-mono text-[11px] font-bold">
                    <span className={isGood ? 'text-gray-400' : 'text-gray-900'}>
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
            } catch (e) {
                console.error("Storage load error:", e);
            }

            // 2. If no initialData (Client-side nav), recover from LS
            if (!initialData) {
                try {
                    setLoading(true);
                    const advisorResultStr = localStorage.getItem("advisor_result");

                    if (!advisorResultStr) {
                        // If we are in async analyzing mode, don't redirect yet
                        if (searchParams.get('status') === 'analyzing') {
                            return;
                        }
                        router.replace("/questions");
                        return;
                    }

                    const advisorResult = JSON.parse(advisorResultStr);

                    // Reconstruct ComprehensiveResult
                    // Handle both new flat structure (route.ts) and legacy nested structure
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

    // --- Mock Environment Data (Phase 3 Simulation) ---
    // In production, this would fetch from a weather API based on lat/long
    // --- Real Environment Data Integration ---
    const [envData, setEnvData] = useState({
        uvIndex: 0,
        humidity: 50,
        aqi: 50, // Added AQI
        temperature: 20,
        location: "定位中...",
        isRealData: false
    });

    // Prevent infinite loop by tracking the last fetched query
    const lastFetchedQuery = useRef<string>("");

    useEffect(() => {
        // Fetch Weather Data
        const fetchWeather = async () => {
            let query = "";

            if (userLocation?.lat && userLocation?.lon) {
                // Round to 2 decimals for API (QWeather recommends this for caching and lookup)
                const latFixed = Number(userLocation.lat).toFixed(2);
                const lonFixed = Number(userLocation.lon).toFixed(2);
                query = `${lonFixed},${latFixed}`;
            } else if (userLocation?.city) {
                query = `${userLocation.province || ''}${userLocation.city}`;
            } else if (userLocation?.province) {
                // If only province (e.g. manual select might be loose), try it
                query = userLocation.province;
            } else if (typeof userLocation === 'string') {
                // Handle legacy string case
                query = userLocation;
            } else {
                // No location available, use generic fallback immediately
                setEnvData({
                    uvIndex: 5,
                    humidity: 45,
                    aqi: 75, // Default AQI
                    temperature: 22,
                    location: "通用环境",
                    isRealData: false
                });
                return;
            }

            // Prevent duplicate fetches
            if (query === lastFetchedQuery.current) return;
            lastFetchedQuery.current = query;

            try {
                const res = await fetch(`/api/weather?city=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setEnvData(data);

                    // Update location display name if we got a real one from coordinates
                    // Only update if it's a real location name (not fallback) and different from current
                    if (data.isRealData && data.location && data.location !== "通用环境" && userLocation?.city !== data.location) {
                        setUserLocation(prev => {
                            if (!prev || typeof prev === 'string') return { city: data.location };
                            return { ...prev, city: data.location };
                        });
                    }
                }
            } catch (e) {
                console.error("Weather fetch failed", e);
                setEnvData(prev => ({ ...prev, location: "暂无数据", isRealData: false }));
            }
        };

        if (userLocation !== undefined) {
            // Only fetch if userLocation is at least processed (null or object)
            fetchWeather();
        }
    }, [userLocation]);

    // Derived Routine Data
    const routineData = useMemo(() => {
        if (!result || !result.skinProfile) return null;
        const climate = getClimateByRegion(userLocation?.province, userLocation?.city);

        // Recover Bio-Factors from LocalStorage (Questionnaire Answers)
        let bioFactors: any = {};
        if (typeof window !== 'undefined') {
            try {
                const answersStr = localStorage.getItem("advisor_answers");
                if (answersStr) {
                    const answers = JSON.parse(answersStr);
                    const stressVal = JSON.stringify(answers.stressLevel || "").toLowerCase();
                    const sleepVal = JSON.stringify(answers.sleepQuality || "").toLowerCase();

                    if (stressVal.includes("high") || stressVal.includes("大") || stressVal.includes("强")) bioFactors.stressLevel = "high";
                    else if (stressVal.includes("low") || stressVal.includes("小")) bioFactors.stressLevel = "low";
                    else bioFactors.stressLevel = "medium";

                    if (sleepVal.includes("poor") || sleepVal.includes("差") || sleepVal.includes("less")) bioFactors.sleepQuality = "poor";
                    else if (sleepVal.includes("good") || sleepVal.includes("好")) bioFactors.sleepQuality = "good";
                    else bioFactors.sleepQuality = "fair";

                    // Check for menstrual cycle answer if added
                    // Assuming key logic similar to above
                    if (answers.menstrualCycle === "luteal") bioFactors.menstrualPhase = "luteal";
                }
            } catch (e) {
                console.error("Failed to parse bio-factors", e);
            }
        }

        // Pass EnvData to generator
        const allRoutines = generateSkincareRoutines(result.skinProfile.type, climate, faceAnalysis || undefined, bioFactors, envData);
        return allRoutines['professional'];
    }, [result, userLocation, faceAnalysis, envData]);

    // Actions
    const handleShare = async () => {
        console.log("Handle share clicked");
        try {
            // Point to the PUBLIC share landing page
            const url = generateShareUrl("/share/result", {
                id: id || "",
                ref: "social_share"
            });
            console.log("Generated share URL:", url);
            const success = await copyToClipboard(url);

            if (success) {
                toast.success("分享链接已复制！");
                trackResultShare("link");
            } else {
                toast.error("复制失败，请尝试手动复制");
            }
        } catch (e) {
            console.error("Share error:", e);
            toast.error("分享功能出现异常");
        }
    };

    const handleSaveLink = async () => {
        try {
            // "Save Link" keeps the PRIVATE result page link (for self)
            const url = generateShareUrl("/result", {
                id: id || "",
                ref: "save_link"
            });
            const success = await copyToClipboard(url);
            if (success) {
                toast.success("私密结果链接已保存（有效期30天）");
            } else {
                toast.error("保存失败，请重试");
            }
        } catch (e) {
            console.error("Save link error:", e);
            toast.error("保存功能异常");
        }
    };

    const handleDownload = async () => {
        if (!result) return;
        toast.info("正在生成 PDF 报告...");
        try {
            const response = await fetch("/api/advisor/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    skinProfile: result.skinProfile,
                    analysis: result.analysis,
                    faceAnalysis: faceAnalysis,
                    location: userLocation
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

    const handleRetake = () => {
        localStorage.removeItem("advisor_answers");
        localStorage.removeItem("advisor_gender");
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_result");
        router.push("/questions");
    };



    // --- Async Analysis Integration ---
    const searchParams = useSearchParams(); // Needs wrapping in Suspense boundary in parent, but Next.js 15+ allows it in client components usually
    const { runAnalysis, analysisState } = useAsyncAnalysis();

    // Trigger Async Analysis
    // Trigger Async Analysis
    useEffect(() => {
        const status = searchParams.get('status');
        // Only trigger if we are in 'analyzing' mode, no result yet, and not already running/error
        if (status === 'analyzing' && !result && analysisState.status === 'idle') {
            const execute = async () => {
                try {
                    const { result: newResult, faceAnalysis: newFace } = await runAnalysis();
                    setResult(newResult);
                    if (newFace) setFaceAnalysis(newFace);
                    // Clear param
                    router.replace('/result', { scroll: false });
                } catch (e: any) {
                    console.error("Async analysis error caught in component:", e);
                    // We do NOT redirect here anymore. We let the UI show the error state.
                    // toast.error(e.message || "分析失败，请重试"); 
                }
            };
            execute();
        }
    }, [searchParams, result, analysisState.status, runAnalysis, router]);

    // Error State
    if (analysisState.status === 'error') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAFAFA] p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">分析遇到了一些问题</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        {analysisState.error || "服务器暂时无法响应，请稍后再试。"}
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                        >
                            重试分析
                        </button>
                        <button
                            onClick={() => router.push('/questions')}
                            className="w-full py-3 bg-transparent text-gray-500 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            返回重新测试
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Enhanced Loading State
    // Enhanced Loading State
    const isAsyncAnalyzing = searchParams.get('status') === 'analyzing' || analysisState.status !== 'idle';
    const showLoading = loading || (!result && isAsyncAnalyzing);

    // Determine detailed status message based on progress
    let detailStatus = "正在初始化分析引擎...";
    if (analysisState.progress < 30) {
        detailStatus = "正在扫描面部特征点...";
    } else if (analysisState.progress < 60) {
        detailStatus = "正在分析皮肤纹理与光泽...";
    } else if (analysisState.progress < 85) {
        detailStatus = "正在识别关键区域问题...";
    } else {
        detailStatus = "正在生成专业护肤报告...";
    }

    // Fallback if truly nothing to show (not loading, no result)
    if (!result && !showLoading) return null;

    return (
        <>
            <AnimatePresence mode="wait">
                {showLoading && (
                    <m.div
                        key="loading-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
                        className="fixed inset-0 z-[200] bg-[#FDFBF7] flex flex-col items-center justify-center overflow-hidden"
                    >
                        {/* Background Decor */}
                        <div className="absolute inset-0 bg-[url('/grid-pattern.png')] opacity-[0.03] pointer-events-none" style={{ backgroundSize: '40px 40px' }} />
                        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#E8DCC6] opacity-30 blur-[120px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#D4B78F] opacity-20 blur-[100px] rounded-full pointer-events-none" />

                        {/* Main Scanner Container */}
                        <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6">

                            {/* Scanner Visual */}
                            <div className="relative w-80 h-80 mb-14">
                                {/* Outer Rotating Rings */}
                                <m.div
                                    className="absolute inset-0 border border-dashed border-[#D4B78F]/60 rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                                />
                                <m.div
                                    className="absolute inset-6 border border-[#D4B78F]/30 rounded-full"
                                    animate={{ scale: [1, 1.05, 1], rotate: -180 }}
                                    transition={{
                                        scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                                        rotate: { duration: 20, repeat: Infinity, ease: "linear" }
                                    }}
                                />
                                <m.div
                                    className="absolute inset-[-12px] border border-[#D4B78F]/10 rounded-full"
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                                />

                                {/* Profile Image / Center */}
                                <div className="absolute inset-8 rounded-full overflow-hidden bg-white shadow-[0_8px_30px_rgba(212,183,143,0.15)] border-4 border-white flex items-center justify-center relative z-20">
                                    {userImage ? (
                                        <div className="relative w-full h-full">
                                            <Image
                                                src={userImage}
                                                alt="Analyzing"
                                                fill
                                                className="object-cover opacity-95 scale-105"
                                            />
                                            {/* Scan Overlay - "Sonar" effect */}
                                            <div className="absolute inset-0 bg-[#D4B78F]/10 mix-blend-overlay" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full bg-[#FAFAFA] flex items-center justify-center">
                                            <ScanFace className="w-28 h-28 text-[#D4B78F]/40" strokeWidth={1} />
                                        </div>
                                    )}

                                    {/* Scanning Light Beam */}
                                    <m.div
                                        className="absolute w-full h-[40%] bg-gradient-to-b from-transparent via-[#D4B78F]/20 to-transparent"
                                        animate={{ top: ['-100%', '200%'] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                        style={{ transform: 'skewY(-10deg)', filter: 'blur(4px)' }}
                                    />

                                    {/* Tech Grid Overlay */}
                                    <div className="absolute inset-0 bg-[url('/grid-pattern.png')] opacity-10 mix-blend-multiply" style={{ backgroundSize: '20px 20px' }} />
                                </div>

                                {/* Floating Badges - Left */}
                                <m.div
                                    className="absolute -left-8 bottom-16 bg-white/95 backdrop-blur-md shadow-lg border border-white/50 px-4 py-2 rounded-2xl flex items-center gap-2.5 z-30"
                                    initial={{ x: -30, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1, y: [0, -5, 0] }}
                                    transition={{
                                        x: { delay: 0.2, duration: 0.5 },
                                        y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#FFF8F0] flex items-center justify-center">
                                        <Search className="w-4 h-4 text-[#C19F70]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Features</span>
                                        <span className="text-xs font-bold text-gray-700">150+ 特征点</span>
                                    </div>
                                </m.div>

                                {/* Floating Badges - Right */}
                                <m.div
                                    className="absolute -right-6 top-16 bg-white/95 backdrop-blur-md shadow-lg border border-white/50 px-4 py-2 rounded-2xl flex items-center gap-2.5 z-30"
                                    initial={{ x: 30, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1, y: [0, 5, 0] }}
                                    transition={{
                                        x: { delay: 0.4, duration: 0.5 },
                                        y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#FFF8F0] flex items-center justify-center">
                                        <Activity className="w-4 h-4 text-[#C19F70]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Status</span>
                                        <span className="text-xs font-bold text-gray-700">AI 分析中</span>
                                    </div>
                                </m.div>
                            </div>

                            {/* Status Text & Progress */}
                            <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                                <m.div
                                    key={detailStatus}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center"
                                >
                                    <h2 className="text-2xl font-light text-[#2C2C2C] tracking-wide mb-1">
                                        {detailStatus}
                                    </h2>
                                </m.div>

                                <div className="w-full space-y-2">
                                    <div className="w-full h-1.5 bg-[#E9E9E7] rounded-full overflow-hidden relative shadow-inner">
                                        <m.div
                                            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#D4B78F] to-[#B08D55] shadow-[0_0_10px_rgba(212,183,143,0.5)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.max(5, analysisState.progress)}%` }}
                                            transition={{ type: "spring", stiffness: 40, damping: 20 }}
                                        />
                                    </div>

                                    <div className="flex justify-between w-full text-[10px] text-gray-400 font-mono tracking-widest uppercase">
                                        <span>AI Processing</span>
                                        <span>{Math.round(analysisState.progress)}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Tip */}
                            <div className="absolute bottom-12 text-center px-6">
                                <p className="text-sm text-[#8A8A8A] font-light leading-relaxed">
                                    "您的肌肤独一无二，我们正在为您量身定制方案"
                                </p>
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            {result && (
                <div className={styles.container}>
                    {/* Global Brand Bar */}
                    <div className="w-full bg-white border-b border-[#E9E9E7] sticky top-0 z-[101]">
                        <div className="w-full max-w-[1440px] mx-auto px-4 py-1 flex items-center justify-start">
                            <div className="w-16 h-16 relative">
                                <Image
                                    src="/logo-myskin-today.svg"
                                    alt="MySkin.Today"
                                    fill
                                    className="object-contain opacity-90"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Header */}
                    <header className={styles.header}>
                        <div className={styles.headerContent}>
                            <div className={styles.headerLeft}>
                                <button onClick={() => router.push('/')} className={styles.backButton}>
                                    <ChevronRight className="w-5 h-5 rotate-180" />
                                </button>
                                <div className={styles.brandWrapper}>
                                    <h1 className={styles.brandName}>智能测肤</h1>
                                    <span className={styles.reportType}>专业分析报告</span>
                                </div>
                            </div>
                            <div className={styles.headerActions}>
                                <WishlistNavButton className="mr-2" />
                                <button onClick={handleShare} className={styles.actionBtn}>
                                    <Share2 className="w-4 h-4" />
                                    分享
                                </button>
                                <button onClick={handleSaveLink} className={styles.actionBtn}>
                                    <LinkIcon className="w-4 h-4" />
                                    保存结果链接
                                </button>
                                <button onClick={handleDownload} className={`${styles.actionBtn} ${styles.primaryActionBtn}`}>
                                    <Download className="w-4 h-4" />
                                    下载报告
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Validation Warning Banner */}
                    {faceAnalysis?.validation && !faceAnalysis.validation.isValid && (
                        <div className="w-full bg-red-50 border-b border-red-100 relative group z-[90]">
                            <div className="max-w-[1440px] mx-auto px-4 py-3 pr-10 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-red-900 mb-0.5">照片质量提示</h4>
                                    <p className="text-sm text-red-700 leading-relaxed">
                                        {faceAnalysis.validation.message}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        const el = (e.target as HTMLElement).closest('.group') as HTMLElement;
                                        if (el) el.style.display = 'none';
                                    }}
                                    className="absolute right-4 top-3 p-1 rounded-full hover:bg-red-100 text-red-500 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    <main className={styles.main}>

                        {/* Left Column: Summary */}
                        <aside className={sidebarStyles.summaryCard}>
                            {/* Icon & Title */}
                            <div className={sidebarStyles.pageIconWrapper}>
                                <img
                                    src={userImage || "/images/default-avatar.png"}
                                    alt="Front"
                                    className={sidebarStyles.pageIcon}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=User&background=random&color=fff`;
                                    }}
                                />
                                {/* Hidden Side Angles */}
                                <div className={sidebarStyles.profileExpander}>
                                    {['left', 'right', 'chin'].map((angle, idx) => (
                                        <img
                                            key={angle}
                                            // Try to get from local storage or fallback to main image/placeholder
                                            // note: real app should store these in state
                                            src={sideImages[angle] || userImage || "/images/default-avatar.png"}
                                            alt={`Angle ${angle}`}
                                            className={sidebarStyles.sideAngleIcon}
                                            style={{ transitionDelay: `${idx * 50}ms` }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <h1 className={sidebarStyles.pageTitle}>肌肤诊断报告</h1>

                            {/* Properties List */}
                            <div className={sidebarStyles.propertyList}>
                                <div className={sidebarStyles.propertyRow}>
                                    <div className={sidebarStyles.propertyLabel}>
                                        <span className={sidebarStyles.propertyIcon}>📅</span>
                                        <span>生成日期</span>
                                    </div>
                                    <div className={sidebarStyles.propertyContent}>
                                        <span className={sidebarStyles.propertyText}>{new Date().toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className={sidebarStyles.propertyRow}>
                                    <div className={sidebarStyles.propertyLabel}>
                                        <span className={sidebarStyles.propertyIcon}>📊</span>
                                        <span>综合评分</span>
                                    </div>
                                    <div className={sidebarStyles.propertyContent}>
                                        {faceAnalysis?.overallScore ? (
                                            <span className={`${sidebarStyles.propertyTag} ${faceAnalysis.overallScore >= 80 ? sidebarStyles.tagGreen :
                                                faceAnalysis.overallScore >= 60 ? sidebarStyles.tagOrange : sidebarStyles.tagRed
                                                }`}>
                                                {faceAnalysis.overallScore}
                                            </span>
                                        ) : (
                                            <span className={`${sidebarStyles.propertyTag} bg-gray-100 text-gray-400`}>-</span>
                                        )}
                                    </div>
                                </div>

                                <div className={sidebarStyles.propertyRow}>
                                    <div className={sidebarStyles.propertyLabel}>
                                        <span className={sidebarStyles.propertyIcon}>🧬</span>
                                        <span>肤质类型</span>
                                    </div>
                                    <div className={sidebarStyles.propertyContent}>
                                        <span className={`${sidebarStyles.propertyTag} ${sidebarStyles.tagBlue}`}>
                                            {result.skinProfile?.typeLabel || "分析中"}
                                        </span>
                                    </div>
                                </div>

                                <div className={sidebarStyles.propertyRow}>
                                    <div className={sidebarStyles.propertyLabel}>
                                        <span className={sidebarStyles.propertyIcon}>🎂</span>
                                        <span>肌龄检测</span>
                                    </div>
                                    <div className={sidebarStyles.propertyContent}>
                                        <span className={sidebarStyles.propertyText}>
                                            {result.skinProfile?.skinAge || 25} 岁
                                        </span>
                                    </div>
                                </div>

                                <div className={sidebarStyles.propertyRow}>
                                    <div className={sidebarStyles.propertyLabel}>
                                        <span className={sidebarStyles.propertyIcon}>💧</span>
                                        <span>水分状态</span>
                                    </div>
                                    <div className={sidebarStyles.propertyContent}>
                                        {faceAnalysis?.hydration?.level ? (
                                            <span className={`${sidebarStyles.propertyTag} ${faceAnalysis.hydration.level.toLowerCase() === 'low' ? sidebarStyles.tagRed :
                                                faceAnalysis.hydration.level.toLowerCase() === 'medium' ? sidebarStyles.tagOrange : sidebarStyles.tagGreen
                                                }`}>
                                                {faceAnalysis.hydration.level.toLowerCase() === 'low' ? '缺乏' :
                                                    faceAnalysis.hydration.level.toLowerCase() === 'medium' ? '适中' : '充足'}
                                            </span>
                                        ) : (
                                            <span className={`${sidebarStyles.propertyTag} bg-gray-100 text-gray-400`}>-</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={sidebarStyles.divider} />

                            {/* Summary Callout */}
                            <div className={sidebarStyles.calloutBlock}>

                                <div className={sidebarStyles.calloutContent}>
                                    <div className={sidebarStyles.calloutTitle}>分析摘要</div>
                                    <div className={sidebarStyles.calloutText}>
                                        {result.analysis?.summary || "暂无摘要"}
                                    </div>
                                </div>
                            </div>

                            {/* Reward Link */}
                            <Link href="/share-reward" className={sidebarStyles.linkBlock}>
                                <div className={sidebarStyles.linkIconBox}>
                                    <Gift size={18} />
                                </div>
                                <div className={sidebarStyles.linkContent}>
                                    <div className={sidebarStyles.linkTitle}>领取专属好礼</div>
                                    <div className={sidebarStyles.linkDesc}>您的评分超越了 90% 的用户</div>
                                </div>
                                <ChevronRight size={14} className="text-gray-400" />
                            </Link>
                        </aside>

                        {/* Right Column: Detailed Analysis & Routine */}
                        <div className="flex flex-col gap-6">

                            {/* --- 0. ENVIRONMENT DASHBOARD (NEW) --- */}
                            {/* --- 0. ENVIRONMENT DASHBOARD (NEW) --- */}
                            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Location - clean and simple */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">当前环境</div>
                                        <div className="font-semibold text-gray-900">{envData.location}</div>
                                    </div>
                                </div>

                                {/* Metrics */}
                                <div className="flex items-center justify-between gap-4 md:gap-8 flex-1 md:flex-none">
                                    {/* UV */}
                                    <div className="text-right flex-1 md:flex-auto">
                                        <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-end gap-1">
                                            <Sun className="w-3 h-3" /> UV指数
                                        </div>
                                        <div className="font-mono text-lg font-medium text-gray-900 leading-none">
                                            {envData.uvIndex} <span className="text-xs text-gray-400 font-sans ml-0.5">
                                                {envData.uvIndex <= 2 ? "(低)" : envData.uvIndex <= 5 ? "(中)" : envData.uvIndex <= 7 ? "(高)" : "(极强)"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Humidity */}
                                    <div className="text-right border-l border-gray-100 pl-4 md:pl-8 flex-1 md:flex-auto">
                                        <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-end gap-1">
                                            <Droplets className="w-3 h-3" /> 湿度
                                        </div>
                                        <div className="font-mono text-lg font-medium text-gray-900 leading-none">
                                            {envData.humidity}% <span className="text-xs text-gray-400 font-sans ml-0.5">
                                                {envData.humidity < 40 ? "(干燥)" : envData.humidity > 70 ? "(潮湿)" : "(适宜)"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* AQI (New) */}
                                    <div className="text-right border-l border-gray-100 pl-4 md:pl-8 flex-1 md:flex-auto">
                                        <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-end gap-1">
                                            <Activity className="w-3 h-3" /> AQI
                                        </div>
                                        <div className="font-mono text-lg font-medium text-gray-900 leading-none">
                                            {envData.aqi || '-'} <span className="text-xs text-gray-400 font-sans ml-0.5">
                                                {(envData.aqi || 0) <= 50 ? "(优)" : (envData.aqi || 0) <= 100 ? "(良)" : "(差)"}
                                            </span>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            {/* Dynamic Alerts */}
                            <div className="space-y-2">
                                {envData.uvIndex >= 8 && (
                                    <div className="flex items-start gap-2 text-xs md:text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                                        <span className="shrink-0 mt-0.5">⚠️</span>
                                        <span><b>紫外线红色预警：</b>今日UV极高，系统已将您的防晒用量调至 1.5倍，并建议每2小时补涂。</span>
                                    </div>
                                )}
                                {envData.humidity < 30 && (
                                    <div className="flex items-start gap-2 text-xs md:text-sm text-amber-800 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                                        <span className="shrink-0 mt-0.5">💧</span>
                                        <span><b>极度干燥预警：</b>空气湿度过低，系统建议在面霜中滴入护肤油以增强封闭性。</span>
                                    </div>
                                )}
                            </div>

                            {/* 1. Condition Summary (Original) */}
                            {/* 1. Radar Analysis */}
                            {/* 1. Radar Analysis (Interactive) or Fallback */}
                            {/* 1. Radar Analysis (Unified Container) */}
                            <div className={`${styles.analysisGrid} ${styles.fadeInUp}`}>
                                <div className={styles.sectionTitle}>
                                    <div className="flex items-center gap-3">
                                        <ScanFace className="w-5 h-5 text-gray-700" />
                                        <span className="text-lg font-semibold text-gray-900">十二维深度分析</span>
                                    </div>
                                </div>

                                {faceAnalysis?.dimensions && activeDimension ? (
                                    /* Flexible Container for Radar + Detail Panel */
                                    <div className="flex flex-col lg:flex-row items-stretch min-h-[400px]">

                                        {/* Left: Interactive Radar */}
                                        <div className={`${styles.radarWrapper} flex-1 border-r border-gray-100`}>
                                            <ScientificRadarChart
                                                dimensions={faceAnalysis.dimensions}
                                                activeDimension={activeDimension}
                                                onDimensionSelect={setActiveDimension}
                                            />
                                        </div>

                                        {/* Right: Dynamic Detail Panel */}
                                        <div className="flex-1 p-8 flex flex-col justify-center bg-white">
                                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">

                                                {/* Header */}
                                                <div className="flex items-center justify-between mb-6">
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-gray-900 mb-0.5">
                                                            {DIMENSION_LABELS[activeDimension]}
                                                        </h3>
                                                        <p className="text-xs text-gray-400 font-mono tracking-wide">
                                                            {activeDimension === 'spots' && 'SURFACE PIGMENTATION'}
                                                            {activeDimension === 'wrinkles' && 'FINE LINES & WRINKLES'}
                                                            {activeDimension === 'pores' && 'PORE VISIBILITY'}
                                                            {activeDimension === 'uvDamage' && 'DEEP SUN DAMAGE'}
                                                            {activeDimension === 'sensitivity' && 'REDNESS & SENSITIVITY'}
                                                            {activeDimension === 'acne' && 'ACNE & SEBUM'}
                                                            {activeDimension === 'waterOil' && 'HYDRO-LIPID BALANCE'}
                                                            {activeDimension === 'skinTone' && 'SKIN TONE EVENNESS'}
                                                            {activeDimension === 'firmness' && 'ELASTICITY & FIRMNESS'}
                                                            {activeDimension === 'radiance' && 'SKIN RADIANCE'}
                                                            {activeDimension === 'darkCircles' && 'PERIORBITAL PIGMENTATION'}
                                                            {activeDimension === 'skinTypeScore' && 'BARRIER STABILITY'}
                                                        </p>
                                                    </div>
                                                    <div className={`text-3xl font-mono font-medium ${faceAnalysis.dimensions[activeDimension].score >= 80 ? 'text-emerald-600' :
                                                        faceAnalysis.dimensions[activeDimension].score >= 60 ? 'text-amber-600' : 'text-rose-600'
                                                        }`}>
                                                        {faceAnalysis.dimensions[activeDimension].score}
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="h-2 w-full bg-gray-100 rounded-full mb-8 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${faceAnalysis.dimensions[activeDimension].score >= 80 ? 'bg-emerald-500' :
                                                            faceAnalysis.dimensions[activeDimension].score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${faceAnalysis.dimensions[activeDimension].score}%` }}
                                                    />
                                                </div>

                                                {/* Diagnosis & Advice */}
                                                <div className="mt-6">
                                                    <h4 className="text-base font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">
                                                        AI 诊断建议 (AI Analysis)
                                                    </h4>
                                                    <p className="text-[14px] leading-relaxed text-gray-700">
                                                        {getDimensionAdvice(activeDimension, faceAnalysis.dimensions[activeDimension].score)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-white">
                                        <div className="text-[14px] leading-relaxed text-gray-700">
                                            暂无面部分析数据，请完善面部扫描数据。
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 1.5 Comprehensive Analysis Details - Professional Report Style */}
                            {/* 1.5 Comprehensive Analysis Details - Professional Report Style */}
                            <div className={`${styles.analysisGrid} ${styles.fadeInUp} border-0 shadow-sm mb-6`}>
                                {/* Title */}
                                <div className={styles.sectionTitle}>
                                    <div className="flex items-center gap-3">
                                        <ClipboardList className="w-5 h-5 text-gray-700" />
                                        <span className="text-lg font-semibold text-gray-900">综合检测报告</span>
                                    </div>
                                </div>

                                <div className="p-8 bg-white text-gray-800">
                                    {/* Report Header / Summary */}
                                    <div className="mb-8">
                                        <h4 className="text-base font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">
                                            1、详细诊断报告 (Detailed Diagnosis)
                                        </h4>

                                        {/* Show Details if available, else fallback to Summary */}
                                        {result.analysis?.details && result.analysis.details.length > 0 ? (
                                            <div className="space-y-3 text-[14px] leading-relaxed text-gray-700">
                                                {result.analysis.details.map((paragraph, idx) => (
                                                    <p key={idx}>{paragraph}</p>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[14px] leading-relaxed text-gray-700">
                                                {faceAnalysis?.summary || result.analysis?.summary || "暂无详细分析摘要"}
                                            </p>
                                        )}
                                    </div>

                                    {/* Expert Advice */}
                                    {/* Expert Advice */}
                                    <div className="mb-8">
                                        <h4 className="text-base font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">
                                            2、专家护肤建议 (Expert Recommendations)
                                        </h4>
                                        {(faceAnalysis?.recommendations && faceAnalysis.recommendations.length > 0) ? (
                                            <ul className="list-disc pl-5 space-y-2 text-[14px] leading-relaxed text-gray-700">
                                                {(faceAnalysis.recommendations).map((rec, idx) => (
                                                    <li key={idx}>{rec}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-[14px] leading-relaxed text-gray-700">
                                                根据您的肤质分析，建议您：
                                                1. 每日早晚温和清洁，避免过度去脂。
                                                2. 严格做好防晒，减少紫外线损伤。
                                                3. 根据季节调整保湿产品，保持水油平衡。
                                            </p>
                                        )}
                                    </div>

                                    {/* Conditions List - Table Format */}
                                    {faceAnalysis?.skinConditions && faceAnalysis.skinConditions.length > 0 ? (
                                        <div className="mb-8">
                                            <h4 className="text-base font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">
                                                3、症状详情 (Clinical Observations)
                                            </h4>
                                            <div className="overflow-x-auto border border-gray-100 rounded-lg">
                                                <table className="w-full text-sm text-center">
                                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider font-medium">
                                                        <tr>
                                                            <th className="py-3 px-4 whitespace-nowrap">症状</th>
                                                            <th className="py-3 px-4 whitespace-nowrap">区域</th>
                                                            <th className="py-3 px-4 whitespace-nowrap">程度</th>
                                                            <th className="py-3 px-4 text-left min-w-[200px]">详情/成因</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {faceAnalysis.skinConditions.map((cond, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                                <td className="py-3 px-4 text-gray-600 text-[13px]">
                                                                    {cond.condition}
                                                                </td>
                                                                <td className="py-3 px-4 text-gray-600 text-[13px]">
                                                                    {cond.area}
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cond.severity?.toLowerCase() === 'severe' ? 'bg-red-50 text-red-600' :
                                                                        cond.severity?.toLowerCase() === 'moderate' ? 'bg-amber-50 text-amber-600' :
                                                                            'bg-slate-100 text-slate-600'
                                                                        }`}>
                                                                        {cond.severity?.toLowerCase() === 'severe' ? '严重' :
                                                                            cond.severity?.toLowerCase() === 'moderate' ? '中度' : '轻微'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4 text-left text-gray-600 leading-relaxed text-[13px]">
                                                                    {cond.description}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* 4. Zone Analysis Grid (Explicitly Added) */}
                                    {faceAnalysis?.zoneAnalysis && (
                                        <div className="mb-8">
                                            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                                                4、区域重点关注 (Area Focus)
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
                                                        <div key={key} className="bg-white border text-left border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h5 className="font-semibold text-gray-800 text-sm">{label}</h5>
                                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full max-w-[100px] truncate">
                                                                    {zoneData.condition}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mb-2 leading-snug min-h-[2.5em] line-clamp-2">
                                                                {zoneData.condition}
                                                            </p>
                                                            <div className="mt-2 pt-2 border-t border-dashed border-gray-100">
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
                                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden font-sans">
                                        <div
                                            className={`px-5 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors ${showLabData ? 'border-b border-gray-100' : ''}`}
                                            onClick={() => setShowLabData(!showLabData)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm font-medium text-gray-900">AI 实验室数据 (AI Labs)</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-gray-400 font-normal hidden sm:inline-block">
                                                    MySkin.Today™ Gold Standard
                                                </span>
                                                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showLabData ? 'rotate-90' : ''}`} />
                                            </div>
                                        </div>
                                        {showLabData && (
                                            <div className="p-5 sm:p-6 text-sm leading-6 animate-in slide-in-from-top-2 fade-in duration-200">
                                                <div className="grid grid-cols-1 gap-y-6">

                                                    {/* Table Header Row (Desktop only) */}
                                                    <div className="hidden md:grid grid-cols-12 text-[11px] text-gray-400 border-b border-gray-200 pb-2 mb-2 font-mono uppercase tracking-wider">
                                                        <div className="col-span-5">检测指标 (Parameter)</div>
                                                        <div className="col-span-3 text-right">测定值 (Value)*</div>
                                                        <div className="col-span-2 text-right">参考范围 (Range)</div>
                                                        <div className="col-span-2 text-right">状态 (Status)</div>
                                                    </div>

                                                    {/* Group 1: Biophysical Profile */}
                                                    <div>
                                                        <h5 className="text-[12px] font-bold font-mono text-gray-600 tracking-wide uppercase mb-3 px-2 py-1 bg-gray-50 border-l-[3px] border-gray-400">
                                                            I. 生物物理特性 (Biophysical Profile)
                                                        </h5>
                                                        <div className="space-y-1">
                                                            {renderLabRow("皮肤 pH 值 (Est. pH)",
                                                                faceAnalysis?.labAnalysis?.skinPh?.value ? `${faceAnalysis.labAnalysis.skinPh.value}` :
                                                                    (faceAnalysis?.dimensions ? (5.5 + (faceAnalysis.dimensions.waterOil.score < 60 ? 0.4 : -0.2) + Math.random() * 0.3).toFixed(1) : '?'),
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
                                                        <h5 className="text-[12px] font-bold font-mono text-gray-600 tracking-wide uppercase mb-3 px-2 py-1 bg-gray-50 border-l-[3px] border-gray-400">
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
                                                        <h5 className="text-[12px] font-bold font-mono text-gray-600 tracking-wide uppercase mb-3 px-2 py-1 bg-gray-50 border-l-[3px] border-gray-400">
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
                                                                    (faceAnalysis?.dimensions ? `${(5 + (100 - faceAnalysis.dimensions.pores.score) * 0.15).toFixed(1)} µm` : '?'),
                                                                "< 10.0 µm",
                                                                faceAnalysis?.labAnalysis?.roughness?.status || (faceAnalysis?.dimensions ? (faceAnalysis.dimensions.pores.score < 70 ? '粗糙' : '细腻') : '-'))}

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

                                                <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                                                    <div className="flex gap-2.5 items-start text-[11px] leading-relaxed text-gray-500 font-mono">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
                                                        <div className="space-y-2">
                                                            <p className="font-bold text-gray-900 uppercase tracking-wide">数据说明 (Data Disclaimer)</p>
                                                            <p>
                                                                <span className="font-semibold text-gray-700">* AI ESTIMATE:</span> 上述数值均由 AI 算法基于您的面部图像特征（纹理、色泽、对比度）反演推算得出，<span className="border-b border-gray-300 text-gray-700">并非物理探头实测数据</span>。
                                                            </p>
                                                            <p>
                                                                例如：TEWL（经表皮失水率）是根据皮肤屏障受损程度的视觉表现估算而来。本报告仅作护肤参考，不可替代医疗诊断。
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Conditions List - Text Only */}

                                </div>
                            </div>



                            {/* 3. Routine */}
                            {/* 3. Routine */}
                            {/* 3. Routine */}
                            {/* 3. Routine Summary Card & Modal */}
                            {/* 3. Routine Summary Card & Modal */}
                            <div className={`${styles.analysisGrid} ${styles.fadeInUp} border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group`} onClick={() => setIsRoutineModalOpen(true)}>
                                {/* Standard Header */}
                                <div className={styles.sectionTitle}>
                                    <div className="flex items-center gap-3">
                                        <FlaskConical className="w-5 h-5 text-gray-700" />
                                        <span className="text-lg font-semibold text-gray-900">科学护肤方案</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900 transition-colors">
                                            点击展开详情
                                        </span>
                                    </div>
                                </div>

                                {/* Card Body - Preview Content */}
                                <div className="p-8">
                                    <div className="flex flex-col gap-8">
                                        {/* Section 1: Theory */}
                                        <div>
                                            <h4 className="text-base font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">
                                                1、方案原理 (Mechanism)
                                            </h4>
                                            <p className="text-[14px] leading-relaxed text-gray-700">
                                                基于您的肤质，为您定制 <span className="font-semibold text-gray-900">“Skin Cycling 28天循环”</span>。
                                                通过 <span className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-xs mx-1">焕肤</span>
                                                <span className="text-gray-400">→</span>
                                                <span className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-xs mx-1">维A</span>
                                                <span className="text-gray-400">→</span>
                                                <span className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-xs mx-1">修护</span>
                                                的周期交替，平衡功效与耐受性。
                                            </p>
                                        </div>

                                        {/* Section 2: Tonight's Action - Zone Card Style */}
                                        <div>
                                            <h4 className="text-base font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">
                                                2、今晚执行 (Tonight's Action)
                                            </h4>

                                            <div className="bg-white border text-left border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group-hover:border-indigo-200 group-hover:shadow-indigo-50/50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-indigo-50 text-indigo-600 p-1 rounded-md">
                                                            <Moon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <h5 className="font-semibold text-gray-900 text-sm">
                                                            {activeRoutineTab === 'evening' ? '针对性护理' : '基础防护'}
                                                        </h5>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${activeRoutineTab === 'evening' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-green-50 text-emerald-700 border-green-100'}`}>
                                                        {activeRoutineTab === 'evening' ? 'High Impact' : 'Recovery'}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                                                    {activeRoutineTab === 'evening'
                                                        ? '今晚是功效护理的关键节点，请严格按照步骤使用活性成分，注意建立耐受。'
                                                        : '今晚重点在于屏障修护与补水，给肌肤充分的休息时间，避免叠加刺激性产品。'}
                                                </p>

                                                <div className="pt-3 border-t border-dashed border-gray-100 flex items-center justify-between">
                                                    <p className="text-xs text-gray-700 leading-snug">
                                                        <span className="font-medium mr-1 text-gray-900">核心任务:</span>
                                                        {activeRoutineTab === 'evening' ? '抗皱 / 焕肤 / 控油' : '保湿 / 舒缓 / 修红'}
                                                    </p>
                                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Routine Dashboard Modal */}
                            {isRoutineModalOpen && routineData && (
                                <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                                    <div className="bg-white w-full max-w-[1200px] h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative ring-1 ring-black/5">
                                        {/* Close Button (Absolute & Floating for style) */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsRoutineModalOpen(false); }}
                                            className="absolute top-5 right-5 z-50 p-2 bg-white/90 hover:bg-gray-100/50 text-gray-400 hover:text-gray-900 rounded-full backdrop-blur-md transition-all border border-transparent hover:border-gray-200 hover:shadow-sm"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>

                                        {/* Modal Body (Pass-through layout) */}
                                        <div className="flex-1 overflow-hidden relative flex flex-col bg-gray-50">
                                            <SkincareDashboard routineData={routineData} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 4. Products - 新版按步骤分组推荐 */}
                            <ProductRecommendationSection
                                products={(result.products || []).map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    nameEn: p.nameEn,
                                    category: p.category,
                                    image: p.image,
                                    price: p.price || '',
                                    reason: p.reason,
                                    keyIngredients: [], // 从数据库获取
                                    benefits: [], // 从数据库获取
                                } as ProductCardData))}
                                isLoading={loading}
                                envData={{
                                    uvIndex: envData.uvIndex,
                                    humidity: envData.humidity,
                                    aqi: envData.aqi
                                }}
                                faceAnalysis={faceAnalysis}
                                onAddToRoutine={(productId) => {
                                    const product = result.products?.find(p => p.id === productId);
                                    if (product) {
                                        addProductToRoutine({
                                            id: product.id,
                                            name: product.name,
                                            category: product.category,
                                            image: product.image,
                                        }, 'both');
                                        toast.success(`${product.name} 已加入今日护肤流程`);
                                    }
                                }}
                                onProductClick={(productId) => {
                                    const product = result.products?.find(p => p.id === productId);
                                    if (product) {
                                        trackProductClick(productId, product.name);
                                    }
                                    router.push(`/products/${productId}`);
                                }}
                                className={styles.fadeInUp}
                            />
                        </div>
                    </main >

                    {/* Global Footer */}
                    <footer className="w-full bg-[#FAFAFA] border-t border-gray-100 mt-0 py-12">
                        <div className="max-w-[1440px] mx-auto px-6">
                            {/* Retake Button - Centered */}
                            <div className="flex justify-center mb-10">
                                <button
                                    onClick={handleRetake}
                                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors px-8 py-3 border border-gray-200 rounded-full bg-white hover:bg-gray-50 text-sm font-medium transition-all hover:shadow-sm"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    重新测试
                                </button>
                            </div>

                            {/* Minimal Footer Text */}
                            <div className="text-center">
                                <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-6 text-xs text-gray-500 mb-3">
                                    <span className="opacity-80">© {new Date().getFullYear()} MySkin.Today™. All rights reserved.</span>
                                    <span className="hidden md:inline text-gray-300">•</span>
                                    <div className="flex gap-4 font-medium">
                                        <a href="https://demo.myskin.today/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">
                                            服务条款
                                        </a>
                                        <a href="https://demo.myskin.today/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">
                                            隐私政策
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 opacity-75">
                                    *AI 分析结果受图像质量影响仅供参考，不构成医疗诊断建议
                                </p>
                            </div>
                        </div>
                    </footer>

                    {/* AI Chat Window */}
                    {
                        result && (
                            <AIChatWindow
                                skinType={result.skinProfile?.typeLabel || '未知'}
                                concerns={result.skinProfile?.concerns || []}
                                summary={result.analysis?.summary || ''}
                                sessionId={id}
                            />
                        )
                    }

                    {/* Save Report Banner for unauthenticated users */}
                    <SaveReportBanner />
                </div>)}
        </>
    );
}
