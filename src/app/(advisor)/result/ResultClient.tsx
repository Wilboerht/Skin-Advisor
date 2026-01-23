"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { Link } from "next-view-transitions";
import { FaceAnalysisResult } from "@/components/advisor/FaceAnalysisResult";
import { SkincareRoutinePanel } from "@/components/advisor/SkincareRoutinePanel";
import { ProductRecommendations } from "@/components/advisor/ProductRecommendations";
import { ShareModal } from "@/components/advisor/ShareModal";
import { ShareRewardBanner } from "@/components/advisor/ShareRewardBanner";
import { Sparkles, ChevronDown, Check, Share2, Home, Star, AlertCircle, RefreshCw, ShoppingBag, ArrowRight, Loader2, Download } from "lucide-react";
import type { FaceAnalysisResult as FaceAnalysisData } from "@/lib/advisor-utils";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";
import { ShareFloatingButton, ShareIcons, type ShareOption } from "@/components/ui/ShareFloatingButton";
import { copyToClipboard, generateShareUrl, generateShareText, generateXiaohongshuText, generateDouyinText } from "@/lib/share";
import { AIChatWindow } from "@/components/advisor/AIChatWindow";

// 动画变体
const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
};

const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.1
        }
    }
};

const defaultTransition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any };


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
        faceAnalysis: FaceAnalysisData | null;
    } | null;
}

export default function ResultClient({ id, initialData }: ResultClientProps) {
    const router = useRouter();
    const toast = useToast();
    const [result, setResult] = useState<ComprehensiveResult | null>(initialData?.result || null);
    const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisData | null>(initialData?.faceAnalysis || null);
    const [userImage, setUserImage] = useState<string | undefined>(undefined);
    const [userAge, setUserAge] = useState<number | undefined>(undefined);
    const [userLocation, setUserLocation] = useState<{ province?: string; city?: string } | null>(null);
    const [analysisExpanded, setAnalysisExpanded] = useState(false);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<string | null>(null);

    // 分享相关状态
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [shareStatus, setShareStatus] = useState<"idle" | "copying" | "copied">("idle");
    const [isMobile, setIsMobile] = useState(true); // 默认移动端，避免闪烁
    const [chatSessionId, setChatSessionId] = useState<string | undefined>(id);

    // Analytics
    const { trackResultView, trackResultShare } = useAdvisorAnalytics();
    const hasTrackedView = useRef(false);

    // 检测是否为移动端
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (initialData) {
                // 如果有初始数据（SSR），尝试从 LocalStorage 恢复图片和年龄等本地状态
                const imgStr = localStorage.getItem("advisor_face_images");
                const answersStr = localStorage.getItem("advisor_answers");
                const locationStr = localStorage.getItem("userRegion");

                if (imgStr) {
                    try {
                        const images = JSON.parse(imgStr);
                        if (images.front) setUserImage(images.front);
                    } catch (e) { console.error(e); }
                }

                if (answersStr) {
                    try {
                        const answers = JSON.parse(answersStr);
                        if (answers.ageRange) {
                            const match = answers.ageRange.match(/(\d+)/);
                            if (match) setUserAge(parseInt(match[1]));
                        }
                    } catch (e) { console.error(e); }
                }

                if (locationStr) {
                    try {
                        setUserLocation(JSON.parse(locationStr));
                    } catch (e) { console.error(e); }
                }

                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const advisorResultStr = localStorage.getItem("advisor_result");
                const imgStr = localStorage.getItem("advisor_face_images");
                const answersStr = localStorage.getItem("advisor_answers");
                const locationStr = localStorage.getItem("userRegion");

                if (!advisorResultStr) {
                    router.push("/questions");
                    return;
                }

                const advisorResult = JSON.parse(advisorResultStr);

                // 设置面部分析数据
                if (advisorResult.faceAnalysis) {
                    setFaceAnalysis(advisorResult.faceAnalysis);
                }

                // 构建综合结果
                setResult({
                    skinProfile: {
                        type: advisorResult.skinAnalysis?.skinType || "combination",
                        typeLabel: advisorResult.skinAnalysis?.skinTypeLabel || "混合性肌肤",
                        concerns: advisorResult.skinAnalysis?.concerns || [],
                        skinAge: advisorResult.skinAnalysis?.skinAge,
                    },
                    analysis: {
                        summary: advisorResult.skinAnalysis?.summary || "根据您的肌肤状况，要在补水保湿的同时兼顾抗老修护。",
                        details: advisorResult.skinAnalysis?.details || [
                            "T区油脂分泌较旺盛，需要注重清洁平衡",
                            "双颊偏干，建议加强保湿滋养",
                            "眼周有细纹风险，建议及早使用眼霜"
                        ],
                    },
                    dataSource: advisorResult.source === "ai" ? "comprehensive" : "questionnaire",
                    products: advisorResult.products || []
                });

                if (imgStr) {
                    const imgs = JSON.parse(imgStr);
                    if (imgs.front) setUserImage(imgs.front);
                }

                if (answersStr) {
                    const ans = JSON.parse(answersStr);
                    // 简单映射年龄
                    let age = 25;
                    if (ans.ageRange === 'under20') age = 18;
                    else if (ans.ageRange === '20-25') age = 22;
                    else if (ans.ageRange === '26-30') age = 28;
                    else if (ans.ageRange === '31-40') age = 35;
                    else if (ans.ageRange === '41-50') age = 45;
                    else if (ans.ageRange === 'above50') age = 55;
                    setUserAge(age);
                }

                if (locationStr) {
                    setUserLocation({ province: locationStr });
                }

                // 追踪结果查看事件
                if (!hasTrackedView.current) {
                    trackResultView();
                    hasTrackedView.current = true;
                }
            } catch (e) {
                console.error(e);
                setError("加载报告失败，请重试");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [router, trackResultView]);

    // 分享处理函数
    const handleShareWechat = useCallback(async () => {
        const shareUrl = generateShareUrl("/result", { ref: "wechat" });
        const success = await copyToClipboard(shareUrl);
        if (success) {
            setShareStatus("copied");
            setTimeout(() => setShareStatus("idle"), 2000);
            toast.success("链接已复制，快去微信分享给好友吧～");
            trackResultShare("wechat");
        }
    }, [toast, trackResultShare]);

    const handleShareWeibo = useCallback(async () => {
        const shareUrl = generateShareUrl("/result", { ref: "weibo" });
        const { title, description } = generateShareText();
        const text = `${title}\n\n${description}\n\n🔗 ${shareUrl}`;
        const success = await copyToClipboard(text);
        if (success) {
            setShareStatus("copied");
            setTimeout(() => setShareStatus("idle"), 2000);
            toast.success("文案已复制，快去微博分享吧～");
            trackResultShare("weibo");
        }
    }, [toast, trackResultShare]);

    const handleShareXiaohongshu = useCallback(async () => {
        const shareUrl = generateShareUrl("/result", { ref: "xiaohongshu" });
        const { title, description } = generateXiaohongshuText(
            result?.skinProfile.typeLabel,
            faceAnalysis?.overallScore
        );
        const text = `${title}\n\n${description}\n\n🔗 ${shareUrl}`;
        const success = await copyToClipboard(text);
        if (success) {
            setShareStatus("copied");
            setTimeout(() => setShareStatus("idle"), 2000);
            toast.success("文案已复制，快去小红书发笔记吧～");
            trackResultShare("xiaohongshu");
        }
    }, [toast, trackResultShare, result, faceAnalysis]);

    const handleShareDouyin = useCallback(async () => {
        const shareUrl = generateShareUrl("/result", { ref: "douyin" });
        const { title, description } = generateDouyinText(
            result?.skinProfile.typeLabel,
            faceAnalysis?.overallScore
        );
        const text = `${title}\n\n${description}\n\n🔗 ${shareUrl}`;
        const success = await copyToClipboard(text);
        if (success) {
            setShareStatus("copied");
            setTimeout(() => setShareStatus("idle"), 2000);
            toast.success("文案已复制，快去抖音分享吧～");
            trackResultShare("douyin");
        }
    }, [toast, trackResultShare, result, faceAnalysis]);

    const handleCopyLink = useCallback(async () => {
        const shareUrl = generateShareUrl("/result", { ref: "copy" });
        const success = await copyToClipboard(shareUrl);
        if (success) {
            setShareStatus("copied");
            setTimeout(() => setShareStatus("idle"), 2000);
            toast.success("链接已复制到剪贴板");
            trackResultShare("link");
        }
    }, [toast, trackResultShare]);

    const handleDownloadPDF = async () => {
        if (!result) return;

        try {
            toast.success("正在为您生成 PDF 报告，请稍候...");
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

            if (!response.ok) throw new Error("Generation failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `myskin-advisor-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("报告下载成功！");
        } catch (e) {
            console.error(e);
            toast.error("生成报告失败，请重试");
        }
    };

    // 悬浮球分享选项配置
    const shareOptions: ShareOption[] = [
        {
            key: "wechat",
            label: "微信",
            icon: ShareIcons.Wechat,
            bgColor: "bg-[#07C160] text-white",
            onClick: handleShareWechat,
        },
        {
            key: "weibo",
            label: "微博",
            icon: ShareIcons.Weibo,
            bgColor: "bg-white text-gray-800",
            onClick: handleShareWeibo,
        },
        {
            key: "xiaohongshu",
            label: "小红书",
            icon: ShareIcons.Xiaohongshu,
            bgColor: "bg-[#FE2C55] text-white",
            onClick: handleShareXiaohongshu,
        },
        {
            key: "douyin",
            label: "抖音",
            icon: ShareIcons.Douyin,
            bgColor: "bg-black text-white",
            onClick: handleShareDouyin,
        },
        {
            key: "copy",
            label: "复制链接",
            icon: ShareIcons.Copy,
            bgColor: "bg-white text-gray-800",
            onClick: handleCopyLink,
        },
        {
            key: "download",
            label: "下载报告",
            icon: Download,
            bgColor: "bg-brand-gold text-white",
            onClick: handleDownloadPDF,
        },
    ];

    const handleRestart = () => {
        localStorage.removeItem("advisor_answers");
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_result");
        router.push("/questions");
    };

    const handleRetry = () => {
        window.location.reload();
    };

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center px-4">
                <div className="text-center">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-gold sm:h-12 sm:w-12" />
                    <p className="mt-3 text-xs text-brand-charcoal/60 sm:mt-4 sm:text-sm">正在生成您的专属报告...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center px-4">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-2" />
                    <p className="text-sm text-brand-charcoal mb-4">{error}</p>
                    <button
                        onClick={handleRetry}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-2 text-sm text-white hover:bg-brand-gold/90 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        重试
                    </button>
                    <button onClick={handleRestart} className="block mt-4 text-xs text-brand-charcoal/50 hover:underline mx-auto">
                        重新开始测试
                    </button>
                </div>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-[#F5F0E8] px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-12 lg:py-8 xl:px-16">
            {/* 顶部导航 */}
            <header className="mx-auto mb-4 flex max-w-xl items-center justify-between sm:mb-6 sm:max-w-2xl lg:max-w-3xl lg:mb-8">
                <button
                    onClick={() => router.push("/")}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-charcoal/20 bg-white/60 text-brand-charcoal/70 transition-all hover:border-brand-charcoal/40 hover:bg-white/80 hover:text-brand-charcoal sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                >
                    <Home className="h-4 w-4 sm:h-5 sm:w-5 lg:h-[22px] lg:w-[22px]" />
                </button>
                <span className="text-xs tracking-wider text-brand-charcoal/60">
                    {result.dataSource === "comprehensive" ? "综合分析" : "问卷分析"}
                </span>
                <button
                    onClick={() => setShowShareMenu(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-charcoal/20 bg-white/60 text-brand-charcoal/70 transition-all hover:border-brand-charcoal/40 hover:bg-white/80 hover:text-brand-charcoal sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                    aria-label="分享"
                >
                    <AnimatePresence mode="wait">
                        {shareStatus === "copied" ? (
                            <m.div
                                key="check"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                            >
                                <Check className="h-5 w-5 text-green-500" />
                            </m.div>
                        ) : (
                            <m.div
                                key="share"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                            >
                                <Share2 className="h-5 w-5" />
                            </m.div>
                        )}
                    </AnimatePresence>
                </button>
            </header>

            {/* 分享弹窗 */}
            <ShareModal
                isOpen={showShareMenu}
                onClose={() => setShowShareMenu(false)}
                isMobile={isMobile}
                skinType={result.skinProfile.type}
                skinTypeLabel={result.skinProfile.typeLabel}
                concerns={result.skinProfile.concerns}
                skinAge={result.skinProfile.skinAge}
                summary={result.analysis.summary}
                faceAnalysis={faceAnalysis}
                userImage={userImage}
            />

            {/* 页面标题 */}
            <m.div
                className="mb-6 text-center sm:mb-8 lg:mb-10"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            >
                {/* 装饰性分隔线 */}
                <m.div
                    className="mx-auto mb-4 flex items-center justify-center gap-3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    <span className="h-px w-8 bg-gradient-to-r from-transparent to-brand-gold/50" />
                    <Star className="h-4 w-4 text-brand-gold" />
                    <span className="h-px w-8 bg-gradient-to-l from-transparent to-brand-gold/50" />
                </m.div>

                {/* 徽章 */}
                <m.div
                    className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-white/40 px-5 py-2 shadow-sm backdrop-blur-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                >
                    <span className="text-sm font-light tracking-wider text-brand-gold">
                        ✨ 专属定制报告
                    </span>
                </m.div>

                <m.h1
                    className="font-serif text-xl font-light tracking-wide text-brand-charcoal sm:text-2xl lg:text-3xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                >
                    您的肌肤密码解析
                </m.h1>
            </m.div>

            {/* 报告内容区域 */}
            <m.div
                className="mx-auto max-w-xl space-y-4 sm:max-w-2xl sm:space-y-6 lg:max-w-3xl"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {/* 面部分析结果 */}
                {faceAnalysis && (
                    <m.div variants={fadeInUp} transition={defaultTransition}>
                        <FaceAnalysisResult result={faceAnalysis} userImage={userImage} userAge={userAge} />
                    </m.div>
                )}

                {/* 综合分析摘要 */}
                <m.div
                    variants={fadeInUp}
                    transition={defaultTransition}
                    onClick={() => setAnalysisExpanded(!analysisExpanded)}
                    className={`relative overflow-hidden rounded-2xl border border-brand-beige/50 bg-white/95 p-5 shadow-card backdrop-blur-sm transition-all duration-300 ${analysisExpanded ? "" : "cursor-pointer hover:shadow-card-hover"}`}
                >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-gold/5 opacity-30" />

                    <div className="relative mb-4 flex w-full items-center justify-between">
                        <h3 className="flex items-center gap-2.5 font-serif text-base font-light tracking-wide text-brand-charcoal">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-champagne/40">
                                <Sparkles className="h-4 w-4 text-brand-gold" />
                            </div>
                            专家分析建议
                        </h3>
                        <ChevronDown
                            className={`h-5 w-5 text-brand-charcoal/50 transition-transform duration-300 ${analysisExpanded ? "rotate-180" : ""}`}
                        />
                    </div>

                    <p className="relative mb-4 text-sm leading-relaxed text-brand-charcoal/80">{result.analysis.summary}</p>

                    <AnimatePresence>
                        {analysisExpanded && (
                            <m.ul
                                className="relative space-y-2"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            >
                                {result.analysis.details.map((detail, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-brand-charcoal/70">
                                        <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-brand-gold" />
                                        {detail}
                                    </li>
                                ))}
                            </m.ul>
                        )}
                    </AnimatePresence>

                    {!analysisExpanded && result.analysis.details.length > 0 && (
                        <div className="mt-2 flex justify-center sm:justify-start">
                            <span className="text-xs text-brand-gold">
                                查看详细分析 ({result.analysis.details.length} 条)
                            </span>
                        </div>
                    )}

                    {analysisExpanded && (
                        <div className="mt-4 flex justify-center">
                            <span className="text-xs text-brand-charcoal/40">点击卡片收起</span>
                        </div>
                    )}
                </m.div>

                {/* 专属护肤方案 */}
                <m.div variants={fadeInUp} transition={defaultTransition}>
                    <SkincareRoutinePanel
                        skinType={result.skinProfile.type}
                        province={userLocation?.province}
                        city={userLocation?.city}
                    />
                </m.div>

                {/* 分享有礼活动入口 */}
                <m.div variants={fadeInUp} transition={defaultTransition}>
                    <ShareRewardBanner
                        score={faceAnalysis?.overallScore || 88}
                        percentile={faceAnalysis?.overallScore ? Math.min(99, Math.floor(faceAnalysis.overallScore * 1.1)) : 92}
                    />
                </m.div>

                {/* 产品推荐 */}
                {result.products && result.products.length > 0 && (
                    <m.div variants={fadeInUp} transition={defaultTransition}>
                        <ProductRecommendations products={result.products} />
                    </m.div>
                )}

                {/* 免责声明 */}
                <m.div
                    variants={fadeInUp}
                    transition={defaultTransition}
                    className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                        <div className="text-xs leading-relaxed text-amber-800/80">
                            <p className="mb-1 text-xs font-medium text-amber-900">温馨提示</p>
                            <p className="text-xs leading-relaxed">
                                本分析报告由 AI 技术生成，仅供参考，不构成医学诊断或治疗建议。
                                {faceAnalysis && (
                                    <span>
                                        面部照片分析结果受拍摄光线、角度等因素影响，准确度有限。
                                    </span>
                                )}
                                如有皮肤健康问题，请咨询专业皮肤科医生。
                            </p>
                        </div>
                    </div>
                </m.div>

                {/* 操作按钮 */}
                <m.div
                    variants={fadeInUp}
                    transition={defaultTransition}
                    className="flex flex-col gap-3 pt-6 sm:flex-row pb-24 sm:pb-0"
                >
                    <button
                        onClick={handleRestart}
                        className="group flex items-center justify-center gap-2.5 rounded-full border border-brand-beige bg-white/80 py-3.5 text-sm font-light tracking-wide text-brand-charcoal/70 shadow-card backdrop-blur-sm transition-all duration-300 hover:border-brand-gold/40 hover:bg-white hover:text-brand-charcoal hover:shadow-card-hover sm:flex-1"
                    >
                        <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
                        重新测试
                    </button>

                    <Link
                        href="/products"
                        className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light py-3.5 text-sm font-light tracking-wide text-white shadow-luxury transition-all duration-300 hover:shadow-luxury-lg sm:flex-1"
                    >
                        {/* 光泽效果 */}
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        <ShoppingBag className="relative h-4 w-4" />
                        <span className="relative">浏览全部产品</span>
                    </Link>
                </m.div>

                <div className="h-8" />
            </m.div>

            {/* 右侧悬浮分享球 */}
            <ShareFloatingButton
                options={shareOptions}
                onSaveImage={() => setShowShareMenu(true)}
                copied={shareStatus === "copied"}
            />

            {/* AI 追问窗口 */}
            {result && (

                <AIChatWindow
                    skinType={result.skinProfile.typeLabel}
                    concerns={result.skinProfile.concerns}
                    summary={result.analysis.summary}
                    sessionId={chatSessionId}
                />
            )}
        </div>
    );
}
