"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
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
    Link as LinkIcon
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
    const { trackResultView, trackResultShare } = useAdvisorAnalytics();

    // Data State
    const [result, setResult] = useState<ComprehensiveResult | null>(initialData?.result || null);
    const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(initialData?.faceAnalysis || null);
    const [userImage, setUserImage] = useState<string | undefined>(undefined);
    const [userLocation, setUserLocation] = useState<{ province?: string; city?: string } | null>(null);

    // UI State
    const [activeRoutineTab, setActiveRoutineTab] = useState<'morning' | 'evening'>('morning');
    const [loading, setLoading] = useState(!initialData);
    const hasTrackedView = useRef(false);

    // New State for interactivity
    const [activeDimension, setActiveDimension] = useState<SkinDimensionKey | null>(null);
    const [showLabData, setShowLabData] = useState(false);

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
            // 1. Recover Images & Location from LocalStorage
            try {
                const imgStr = localStorage.getItem("advisor_face_images");
                const locationStr = localStorage.getItem("userRegion");

                if (imgStr) {
                    const images = JSON.parse(imgStr);
                    if (images.front) setUserImage(images.front);
                }

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
                console.error("Local storage error:", e);
            }

            // 2. If no initialData (Client-side nav), recover from LS
            if (!initialData) {
                try {
                    setLoading(true);
                    const advisorResultStr = localStorage.getItem("advisor_result");

                    if (!advisorResultStr) {
                        router.replace("/questions");
                        return;
                    }

                    const advisorResult = JSON.parse(advisorResultStr);

                    // Reconstruct ComprehensiveResult
                    setResult({
                        skinProfile: {
                            type: advisorResult.skinAnalysis?.skinType || "combination",
                            typeLabel: advisorResult.skinAnalysis?.skinTypeLabel || "混合性肌肤",
                            concerns: advisorResult.skinAnalysis?.concerns || [],
                            skinAge: advisorResult.skinAnalysis?.skinAge,
                        },
                        analysis: {
                            summary: advisorResult.skinAnalysis?.summary || "分析完成。",
                            details: advisorResult.skinAnalysis?.details || [],
                        },
                        dataSource: advisorResult.source === "ai" ? "comprehensive" : "questionnaire",
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

    // Derived Routine Data
    const routineData = useMemo(() => {
        if (!result) return null;
        const climate = getClimateByRegion(userLocation?.province, userLocation?.city);
        const allRoutines = generateSkincareRoutines(result.skinProfile.type, climate);
        // Default to 'professional' level routines for the report
        return allRoutines['professional'];
    }, [result, userLocation]);

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
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_result");
        router.push("/questions");
    };

    // Helper to calculate simple zone score for display
    const getZoneScore = (zoneName: keyof ZoneAnalysis, analysis?: ZoneAnalysis) => {
        if (!analysis) return { score: 80, status: '良好' };
        const data = analysis[zoneName];
        // Simplified calculation for demo
        let score = 0;
        if (zoneName === 'forehead') score = 100 - (data.wrinkles + data.oil) / 2;
        else if (zoneName === 'tZone') score = 100 - (data.oil + data.pores) / 2;
        else if (zoneName === 'leftCheek' || zoneName === 'rightCheek') score = 100 - (data.spots + data.redness) / 2;
        else if (zoneName === 'eyeArea') score = 100 - (data.wrinkles + data.darkCircles) / 2;
        else score = (data.firmness + data.contour) / 2;

        score = Math.max(0, Math.min(100, Math.round(score)));

        let status = '良好';
        if (score < 60) status = '需改善';
        else if (score < 80) status = '一般';

        return { score, status };
    };

    if (loading || !result) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#FAFAFA]">
                <div className="text-center">
                    <Activity className="w-10 h-10 text-gray-400 animate-pulse mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">正在生成您的专业报告...</p>
                </div>
            </div>
        );
    }

    return (
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
                            <h1 className={styles.brandName}>Skin Advisor</h1>
                            <span className={styles.reportType}>Professional Analysis</span>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
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
                                    src={(() => {
                                        if (typeof window !== 'undefined') {
                                            const saved = localStorage.getItem("advisor_face_images");
                                            if (saved) {
                                                const parsed = JSON.parse(saved);
                                                return parsed[angle] || userImage || "/images/default-avatar.png";
                                            }
                                        }
                                        return userImage || "/images/default-avatar.png";
                                    })()}
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
                                <span className={`${sidebarStyles.propertyTag} ${(faceAnalysis?.overallScore || 0) >= 80 ? sidebarStyles.tagGreen :
                                    (faceAnalysis?.overallScore || 0) >= 60 ? sidebarStyles.tagOrange : sidebarStyles.tagRed
                                    }`}>
                                    {faceAnalysis?.overallScore || 85}
                                </span>
                            </div>
                        </div>

                        <div className={sidebarStyles.propertyRow}>
                            <div className={sidebarStyles.propertyLabel}>
                                <span className={sidebarStyles.propertyIcon}>🧬</span>
                                <span>肤质类型</span>
                            </div>
                            <div className={sidebarStyles.propertyContent}>
                                <span className={`${sidebarStyles.propertyTag} ${sidebarStyles.tagBlue}`}>
                                    {result.skinProfile.typeLabel}
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
                                    {result.skinProfile.skinAge || 25} 岁
                                </span>
                            </div>
                        </div>

                        <div className={sidebarStyles.propertyRow}>
                            <div className={sidebarStyles.propertyLabel}>
                                <span className={sidebarStyles.propertyIcon}>💧</span>
                                <span>水分状态</span>
                            </div>
                            <div className={sidebarStyles.propertyContent}>
                                <span className={`${sidebarStyles.propertyTag} ${faceAnalysis?.hydration.level === 'low' ? sidebarStyles.tagRed :
                                    faceAnalysis?.hydration.level === 'medium' ? sidebarStyles.tagOrange : sidebarStyles.tagGreen
                                    }`}>
                                    {faceAnalysis?.hydration.level === 'low' ? '缺乏' :
                                        faceAnalysis?.hydration.level === 'medium' ? '适中' : '充足'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={sidebarStyles.divider} />

                    {/* Summary Callout */}
                    <div className={sidebarStyles.calloutBlock}>

                        <div className={sidebarStyles.calloutContent}>
                            <div className={sidebarStyles.calloutTitle}>分析摘要</div>
                            <div className={sidebarStyles.calloutText}>
                                {result.analysis.summary}
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
                <div className={styles.contentArea}>

                    {/* 1. Radar Analysis */}
                    {/* 1. Radar Analysis (Interactive) */}
                    {faceAnalysis?.dimensions && activeDimension && (
                        <div className={`${styles.analysisGrid} ${styles.fadeInUp}`}>
                            <div className={styles.sectionTitle}>
                                <div className="flex items-center gap-3">
                                    <ScanFace className="w-5 h-5 text-gray-700" />
                                    <span className="text-lg font-semibold text-gray-900">十二维深度分析</span>
                                </div>
                            </div>

                            {/* Flexible Container for Radar + Detail Panel */}
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
                        </div>
                    )}

                    {/* 1.5 Comprehensive Analysis Details - Professional Report Style */}
                    {faceAnalysis && (
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
                                    {result.analysis.details && result.analysis.details.length > 0 ? (
                                        <div className="space-y-3 text-[14px] leading-relaxed text-gray-700">
                                            {result.analysis.details.map((paragraph, idx) => (
                                                <p key={idx}>{paragraph}</p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[14px] leading-relaxed text-gray-700">
                                            {faceAnalysis.summary}
                                        </p>
                                    )}
                                </div>

                                {/* Expert Advice */}
                                {faceAnalysis.recommendations && faceAnalysis.recommendations.length > 0 && (
                                    <div className="mb-8">
                                        <h4 className="text-base font-medium text-gray-900 mb-3 border-b border-gray-200 pb-2">
                                            2、专家护肤建议 (Expert Recommendations)
                                        </h4>
                                        <div className="space-y-3 text-[14px] leading-relaxed text-gray-700">
                                            <p>
                                                {faceAnalysis.recommendations.join(" ")}
                                            </p>
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
                                                            faceAnalysis.dimensions.waterOil.score < 60 ? '5.8 - 6.2' : faceAnalysis.dimensions.waterOil.score > 80 ? '5.2 - 5.5' : '4.5 - 5.0',
                                                            "4.5 - 5.5",
                                                            faceAnalysis.dimensions.waterOil.score < 60 ? '偏碱' : '正常')}

                                                        {renderLabRow("经表皮失水率 (TEWL)",
                                                            faceAnalysis.dimensions.sensitivity.score > 80 ? 'Low (~8.5)' : 'High (>15)',
                                                            "< 10.0 g/m²/h",
                                                            faceAnalysis.dimensions.sensitivity.score > 80 ? '正常' : '偏高')}

                                                        {renderLabRow("角质层含水量 (Hydration)",
                                                            faceAnalysis.dimensions.waterOil.score < 60 ? '~18.5 AU' : '~45.2 AU',
                                                            "> 35.0 AU",
                                                            faceAnalysis.dimensions.waterOil.score < 60 ? '偏低' : '正常')}

                                                        {renderLabRow("真皮层弹性 (Elasticity R2)",
                                                            faceAnalysis.dimensions.firmness.score > 80 ? '> 0.82' : faceAnalysis.dimensions.firmness.score > 60 ? '0.65 - 0.75' : '< 0.55',
                                                            "> 0.70",
                                                            faceAnalysis.dimensions.firmness.score > 60 ? '紧致' : '松弛')}
                                                    </div>
                                                </div>

                                                {/* Group 2: Pigmentation & Vascularity */}
                                                <div>
                                                    <h5 className="text-[12px] font-bold font-mono text-gray-600 tracking-wide uppercase mb-3 px-2 py-1 bg-gray-50 border-l-[3px] border-gray-400">
                                                        II. 色基分布分析 (Chromophore Map)
                                                    </h5>
                                                    <div className="space-y-1">
                                                        {renderLabRow("黑色素指数 (Melanin Index)",
                                                            `~${Math.round((100 - faceAnalysis.dimensions.spots.score) * 2.5)} MI`,
                                                            "< 150 MI",
                                                            faceAnalysis.dimensions.spots.score < 60 ? '偏高' : '正常')}

                                                        {renderLabRow("红斑指数 (Erythema Index)",
                                                            `~${Math.round((100 - faceAnalysis.dimensions.sensitivity.score) * 3.2)} EI`,
                                                            "< 200 EI",
                                                            faceAnalysis.dimensions.sensitivity.score < 60 ? '偏高' : '正常')}

                                                        {renderLabRow("光老化等级 (Glogau Scale)",
                                                            faceAnalysis.dimensions.uvDamage.score > 40 ? 'III 型' : faceAnalysis.dimensions.uvDamage.score > 30 ? 'II 型' : 'I 型',
                                                            "Age Dependent",
                                                            "-")}

                                                        {renderLabRow("肤色均匀度 (Homogeneity)",
                                                            faceAnalysis.dimensions.skinTone.score > 80 ? '< 12% C.V.' : '< 25% C.V.',
                                                            "< 15% C.V.",
                                                            faceAnalysis.dimensions.skinTone.score > 80 ? '均匀' : '不均')}

                                                        {renderLabRow("眼周色素对比度 (Periorbital Contrast)",
                                                            faceAnalysis.dimensions.darkCircles.score > 80 ? '< 2.5 Delta E' : faceAnalysis.dimensions.darkCircles.score > 60 ? '2.5 - 5.0 Delta E' : '> 5.0 Delta E',
                                                            "< 3.0 Delta E",
                                                            faceAnalysis.dimensions.darkCircles.score > 80 ? '正常' : '明显')}
                                                    </div>
                                                </div>

                                                {/* Group 3: Surface & Microbiome */}
                                                <div>
                                                    <h5 className="text-[12px] font-bold font-mono text-gray-600 tracking-wide uppercase mb-3 px-2 py-1 bg-gray-50 border-l-[3px] border-gray-400">
                                                        III. 表面与微生态 (Surface & Microbiome)
                                                    </h5>
                                                    <div className="space-y-1">
                                                        {renderLabRow("卟啉计数 (Porphyrins)",
                                                            faceAnalysis.dimensions.acne.score < 60 ? 'High' : faceAnalysis.dimensions.acne.score < 80 ? 'Moderate' : 'Low',
                                                            "Low Risk",
                                                            faceAnalysis.dimensions.acne.score < 60 ? '偏多' : faceAnalysis.dimensions.acne.score < 80 ? '中等' : '少')}

                                                        {renderLabRow("皮脂分泌率 (Sebum Rate)",
                                                            faceAnalysis.dimensions.waterOil.score < 60 ? 'High' : 'Normal',
                                                            "Balanced",
                                                            faceAnalysis.dimensions.waterOil.score < 60 ? '旺盛' : '正常')}

                                                        {renderLabRow("皮肤平滑度 (Roughness Ra)",
                                                            faceAnalysis.dimensions.pores.score < 70 ? '> 15 µm' : '< 10 µm',
                                                            "< 10.0 µm",
                                                            faceAnalysis.dimensions.pores.score < 70 ? '粗糙' : '细腻')}

                                                        {renderLabRow("光泽度指数 (Glossiness GU)",
                                                            faceAnalysis.dimensions.radiance.score > 80 ? '> 8.5 GU' : faceAnalysis.dimensions.radiance.score > 60 ? '4.0 - 6.0 GU' : '< 3.0 GU',
                                                            "> 6.0 GU",
                                                            faceAnalysis.dimensions.radiance.score > 60 ? '透亮' : '暗沉')}

                                                        {renderLabRow("皱纹严重度分级 (Wrinkle Severity)",
                                                            faceAnalysis.dimensions.wrinkles.score > 80 ? 'Grade 1 (None)' : faceAnalysis.dimensions.wrinkles.score > 60 ? 'Grade 2 (Fine)' : 'Grade 3 (Deep)',
                                                            "Grade 1",
                                                            faceAnalysis.dimensions.wrinkles.score > 60 ? '正常' : '明显')}
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
                            </div>

                            {/* Conditions List - Text Only */}
                            {faceAnalysis.skinConditions && faceAnalysis.skinConditions.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
                                        症状详情 (Clinical Observations)
                                    </h4>
                                    <div className="space-y-4">
                                        {faceAnalysis.skinConditions.map((cond, idx) => (
                                            <div key={idx} className="flex flex-col sm:flex-row sm:gap-4 text-sm">
                                                <div className="sm:w-32 shrink-0 font-semibold text-gray-900 pt-0.5">
                                                    {cond.condition}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="mb-1">
                                                        <span className="text-gray-500 mr-2 text-xs">区域: {cond.area}</span>
                                                        <span className="text-gray-300 mr-2 text-xs">|</span>
                                                        <span className={`text-xs ${cond.severity === 'severe' ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                            程度: {cond.severity === 'severe' ? '严重' : cond.severity === 'moderate' ? '中度' : '轻微'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[13px] leading-relaxed text-gray-600">
                                                        {cond.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. Zone Analysis */}
                    {faceAnalysis?.zoneAnalysis && (
                        <div className={`${styles.analysisGrid} ${styles.fadeInUp} border-0 shadow-sm`}>
                            <div className={styles.sectionTitle}>
                                <div className="flex items-center gap-3">
                                    <Search className="w-5 h-5 text-gray-700" />
                                    <span className="text-lg font-semibold text-gray-900">区域重点关注</span>
                                </div>
                            </div>
                            <div className={styles.zoneGrid}>
                                {(['forehead', 'tZone', 'leftCheek', 'rightCheek', 'eyeArea', 'jawline'] as const).map(zone => {
                                    const { score, status } = getZoneScore(zone, faceAnalysis.zoneAnalysis);
                                    const labels: Record<string, string> = {
                                        forehead: "额头", tZone: "T区", leftCheek: "左颊",
                                        rightCheek: "右颊", eyeArea: "眼周", jawline: "下颌"
                                    };

                                    return (
                                        <div key={zone} className={styles.zoneCard}>
                                            <div className="text-sm font-semibold text-gray-900 mb-1">{labels[zone]}</div>
                                            <span className={`${styles.zoneStatus} ${status === '良好' ? styles.colorGood :
                                                status === '一般' ? styles.colorAvg : styles.colorPoor
                                                }`}>
                                                {status} {score}
                                            </span>
                                            <p className="text-[13px] text-gray-600 mt-2 leading-relaxed">
                                                {faceAnalysis.zoneAnalysis?.[zone].condition || "无明显问题"}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. Routine */}
                    {routineData && (
                        <div className={`${styles.routineCard} ${styles.fadeInUp} border-0 shadow-sm`}>
                            {/* Header with Title and Toggle */}
                            <div className={styles.routineHeader}>
                                <div className="flex items-center gap-3">
                                    <FlaskConical className="w-5 h-5 text-gray-700" />
                                    <span className="text-lg font-semibold text-gray-900">科学护肤方案</span>
                                </div>

                                {/* Segmented Control */}
                                <div className={styles.toggleContainer}>
                                    <div
                                        className={`${styles.toggleBtn} ${activeRoutineTab === 'morning' ? styles.active : ''}`}
                                        onClick={() => setActiveRoutineTab('morning')}
                                    >
                                        <Sun className="w-3.5 h-3.5" />
                                        早间防护
                                    </div>
                                    <div
                                        className={`${styles.toggleBtn} ${activeRoutineTab === 'evening' ? styles.active : ''}`}
                                        onClick={() => setActiveRoutineTab('evening')}
                                    >
                                        <Moon className="w-3.5 h-3.5" />
                                        晚间修护
                                    </div>
                                </div>
                            </div>

                            {/* Timeline Body */}
                            <div className={styles.routineBody}>
                                <div className={styles.timeline}>
                                    {routineData[activeRoutineTab].steps.map((step: any, idx: number) => (
                                        <div key={idx} className={styles.timelineStep}>
                                            <div className={styles.timelineDot}>
                                                {idx + 1}
                                            </div>

                                            <div className={styles.stepContent}>
                                                <div className={styles.stepHeader}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[15px] font-medium text-gray-900">{step.name}</span>
                                                        <span className={styles.stepEnName}>{step.nameEn}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                        {step.duration}
                                                    </div>
                                                </div>

                                                <p className="text-[14px] leading-relaxed text-gray-700 mb-3">
                                                    {step.description}
                                                </p>

                                                {step.dosage && (
                                                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50/50 border border-blue-100 px-2 py-1 rounded w-fit">
                                                        <span className="text-[10px]">💧</span>
                                                        <span>{step.dosage.description}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Products */}
                    {result.products && result.products.length > 0 && (
                        <div className={`${styles.analysisGrid} ${styles.fadeInUp} border-0 shadow-sm`}>
                            <div className={styles.sectionTitle}>
                                <div className="flex items-center gap-3">
                                    <Gift className="w-5 h-5 text-gray-700" />
                                    <span className="text-lg font-semibold text-gray-900">甄选产品推荐</span>
                                </div>
                            </div>
                            <div className={styles.productGrid}>
                                {result.products.map(product => (
                                    <Link key={product.id} href={`/products/${product.id}`} className={styles.productCard}>
                                        <div className={styles.productImgArea}>
                                            <img src={product.image} alt={product.name} className={styles.productImg} />
                                        </div>
                                        <div className={styles.productMeta}>
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">{product.category}</span>
                                            <h4 className="text-[15px] font-semibold text-gray-900 mb-1 leading-snug line-clamp-2">{product.name}</h4>
                                            <div className="text-[13px] text-gray-600 leading-relaxed mb-3 line-clamp-2">
                                                推荐理由：{product.reason}
                                            </div>
                                            <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center text-xs font-medium text-gray-900">
                                                <span>{product.price || '查看详情'}</span>
                                                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    {/* Footer Actions */}


                </div>
            </main>

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
                        skinType={result.skinProfile.typeLabel}
                        concerns={result.skinProfile.concerns}
                        summary={result.analysis.summary}
                        sessionId={id}
                    />
                )
            }
        </div >
    );
}
