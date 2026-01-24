"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
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
    Gift // Import Gift icon
} from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";
import type { FaceAnalysisResult, ZoneAnalysis } from "@/lib/advisor-utils";
import { ScientificRadarChart } from "@/components/advisor/ScientificRadarChart";
import { generateSkincareRoutines, getClimateByRegion } from "@/lib/skincare-dosage";
import { copyToClipboard, generateShareUrl } from "@/lib/share";
import { AIChatWindow } from "@/components/advisor/AIChatWindow";
import { ShareRewardBanner } from "@/components/advisor/ShareRewardBanner";

// Import the new CSS Module
import styles from "./result.module.css";

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
        const url = generateShareUrl("/result", { ref: "button" });
        const success = await copyToClipboard(url);
        if (success) {
            toast.success("链接已复制，可以发送给好友啦");
            trackResultShare("link");
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
            {/* Header */}
            <header className={styles.header}>
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
                    <button onClick={handleDownload} className={`${styles.actionBtn} ${styles.primaryActionBtn}`}>
                        <Download className="w-4 h-4" />
                        下载报告
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className={styles.main}>

                {/* Left Column: Summary */}
                <aside className={styles.summaryCard}>
                    <div className={styles.userProfile}>
                        <div className={styles.avatarRing}>
                            <img
                                src={userImage || "/images/default-avatar.png"}
                                alt="User"
                                className={styles.avatar}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=User&background=random&color=fff`;
                                }}
                            />
                        </div>
                        <h2 className={styles.greeting}>您的肌肤报告</h2>
                        <p className={styles.reportDate}>{new Date().toLocaleDateString()}</p>
                    </div>

                    <div className={styles.scoreDisplay}>
                        <div className={styles.bigScore}>
                            {faceAnalysis?.overallScore || 85}
                        </div>
                        <span className={styles.scoreLabel}>肌肤综合评分</span>
                        <div className={styles.skinTypeBadge}>
                            {result.skinProfile.typeLabel}
                        </div>
                    </div>

                    <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>
                                {result.skinProfile.skinAge || 25}
                            </span>
                            <span className={styles.statLabel}>肌龄</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={`${styles.statValue} ${faceAnalysis?.hydration.level === 'low' ? styles.textPoor :
                                faceAnalysis?.hydration.level === 'medium' ? styles.textAvg : styles.textGood
                                }`}>
                                {faceAnalysis?.hydration.level === 'low' ? '缺乏' :
                                    faceAnalysis?.hydration.level === 'medium' ? '适中' : '充足'}
                            </span>
                            <span className={styles.statLabel}>水分</span>
                        </div>
                    </div>

                    {/* Reward Banner */}
                    <div className="mt-8">
                        <ShareRewardBanner
                            score={faceAnalysis?.overallScore || 0}
                            percentile={90}
                        />
                    </div>

                    {/* Summary Text */}
                    <div className="mt-8 pt-8 border-t border-gray-100">
                        <h4 className="text-sm font-semibold mb-3 text-gray-900">分析摘要</h4>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4">
                            {result.analysis.summary}
                        </p>
                        <ul className={styles.detailList}>
                            {result.analysis.details.slice(0, 3).map((detail, i) => (
                                <li key={i} className={styles.detailItem}>{detail}</li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Right Column: Detailed Analysis & Routine */}
                <div className={styles.contentArea}>

                    {/* 1. Radar Analysis */}
                    {faceAnalysis?.dimensions && (
                        <div className={`${styles.analysisGrid} ${styles.fadeInUp} border-0 shadow-sm`}>
                            <div className={styles.sectionTitle}>
                                <ScanFace className={styles.sectionIcon} />
                                <span>八维深度分析</span>
                            </div>

                            <div className="grid lg:grid-cols-2 gap-8 items-center">
                                <div className={styles.radarWrapper}>
                                    <ScientificRadarChart dimensions={faceAnalysis.dimensions} />
                                </div>
                                <div className={styles.dimensionList}>
                                    {Object.entries(faceAnalysis.dimensions).map(([key, data]) => {
                                        // @ts-ignore
                                        const label = data.details || key;
                                        // @ts-ignore
                                        const score = data.score;

                                        return (
                                            <div key={key} className={styles.dimensionCard}>
                                                <div className={styles.dimHeader}>
                                                    <span className={styles.dimName}>
                                                        {key === 'spots' ? '色斑' :
                                                            key === 'wrinkles' ? '皱纹' :
                                                                key === 'texture' ? '纹理' :
                                                                    key === 'pores' ? '毛孔' :
                                                                        key === 'uvDamage' ? '紫外线' :
                                                                            key === 'brownSpots' ? '深层斑' :
                                                                                key === 'redAreas' ? '泛红' : '痘痘风险'}
                                                    </span>
                                                    <span className={`${styles.dimScore} ${score >= 80 ? styles.textGood : score >= 60 ? styles.textAvg : styles.textPoor
                                                        }`}>
                                                        {score}
                                                    </span>
                                                </div>
                                                <div className={styles.dimBarBg}>
                                                    <div className={`${styles.dimBarFill} ${score >= 80 ? styles.colorGood : score >= 60 ? styles.colorAvg : styles.colorPoor
                                                        }`} style={{ width: `${score}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Zone Analysis */}
                    {faceAnalysis?.zoneAnalysis && (
                        <div className={`${styles.analysisGrid} ${styles.fadeInUp}`}>
                            <div className={styles.sectionTitle}>
                                <Search className={styles.sectionIcon} />
                                <span>区域重点关注</span>
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
                                            <div className={styles.zoneName}>{labels[zone]}</div>
                                            <span className={`${styles.zoneStatus} ${status === '良好' ? styles.colorGood :
                                                status === '一般' ? styles.colorAvg : styles.colorPoor
                                                }`}>
                                                {status} {score}
                                            </span>
                                            <p className={styles.zoneDesc}>
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
                        <div className={`${styles.routineSection} ${styles.fadeInUp}`}>
                            <div className="p-6 pb-0 border-b border-gray-100 flex justify-between items-center bg-white">
                                <div className={styles.sectionTitle} style={{ marginBottom: '20px' }}>
                                    <Activity className={styles.sectionIcon} />
                                    <span>科学护肤方案</span>
                                </div>
                            </div>
                            <div className={styles.routineTabs}>
                                <div
                                    className={`${styles.routineTab} ${activeRoutineTab === 'morning' ? styles.active : ''}`}
                                    onClick={() => setActiveRoutineTab('morning')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Sun className="w-4 h-4" /> 早间防护 Morning
                                    </div>
                                </div>
                                <div
                                    className={`${styles.routineTab} ${activeRoutineTab === 'evening' ? styles.active : ''}`}
                                    onClick={() => setActiveRoutineTab('evening')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Moon className="w-4 h-4" /> 晚间修护 Evening
                                    </div>
                                </div>
                            </div>

                            <div className={styles.routineContent}>
                                <div className={styles.routineSteps}>
                                    {routineData[activeRoutineTab].steps.map((step: any, idx: number) => (
                                        <div key={idx} className={styles.stepCard}>
                                            <div className={styles.stepIndex}>{idx + 1}</div>
                                            <div className={styles.stepInfo}>
                                                <div className={styles.stepHeader}>
                                                    <span className={styles.stepName}>{step.name}</span>
                                                    <span className={styles.stepDuration}>{step.duration}</span>
                                                </div>
                                                <div className="text-xs text-gray-400 mb-1 font-mono uppercase">{step.nameEn}</div>
                                                <p className={styles.stepDesc}>{step.description}</p>
                                                {step.dosage && (
                                                    <div className={styles.dosageTag}>
                                                        用量：{step.dosage.description}
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
                        <div className={styles.fadeInUp}>
                            <h3 className={styles.sectionTitle}>
                                <span>甄选产品推荐</span>
                            </h3>
                            <div className={styles.productGrid}>
                                {result.products.map(product => (
                                    <Link key={product.id} href={`/products/${product.id}`} className={styles.productCard}>
                                        <div className={styles.productImgArea}>
                                            <img src={product.image} alt={product.name} className={styles.productImg} />
                                        </div>
                                        <div className={styles.productMeta}>
                                            <span className={styles.productCat}>{product.category}</span>
                                            <h4 className={styles.productTitle}>{product.name}</h4>
                                            <div className={styles.productReason}>
                                                推荐理由：{product.reason}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm font-medium">
                                                <span>{product.price || '查看详情'}</span>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className={styles.footerArea}>
                        <div className={styles.disclaimerBox}>
                            <div className={styles.disclaimerTitle}>免责声明</div>
                            本报告结果基于人工智能图像分析生成，仅供参考。分析结果受拍摄光线、角度及设备清晰度影响，不能作为医学诊断依据。如遇严重皮肤问题，请咨询专业皮肤科医生。
                        </div>

                        <button onClick={handleRetake} className="inline-flex items-center gap-2 text-gray-500 hover:text-black transition-colors px-6 py-3 border border-gray-200 rounded-lg hover:bg-white hover:border-black">
                            <RotateCcw className="w-4 h-4" />
                            重新测试
                        </button>
                    </div>

                </div>
            </main>

            {/* AI Chat Window */}
            {result && (
                <AIChatWindow
                    skinType={result.skinProfile.typeLabel}
                    concerns={result.skinProfile.concerns}
                    summary={result.analysis.summary}
                    sessionId={id}
                />
            )}
        </div>
    );
}
