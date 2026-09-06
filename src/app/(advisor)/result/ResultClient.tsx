"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { House, Gift, ArrowRight, AlertTriangle, Lightbulb, Lock } from "lucide-react";
import { useAsyncAnalysis } from "@/hooks/useAsyncAnalysis";
import { motion as m, AnimatePresence } from "framer-motion";
import {
    RotateCcw,
    ChevronRight,
    ChevronDown,
    ScanFace,
    Activity,
    AlertCircle,
    Sparkles,
    X
} from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useNavPush } from "@/hooks/use-nav-push";
import { useToast } from "@/components/ui/Toast";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { DIMENSION_LABELS, DIMENSION_DESCRIPTIONS, DIMENSION_ORDER } from "@/lib/advisor-utils";
import { normalizeAnalysisResult, type ComprehensiveResult } from "@/lib/analysis-result";
import { getRankPercentile, getCharacterImage } from "@/lib/result-utils";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { computeLabAnalysis } from "@/lib/analysis-lab";
import type { LabMetric } from "@/lib/analysis-lab";
import { cn } from "@/lib/utils";
import { fetchWithCsrf } from "@/lib/fetch-client";
import type { SessionUser } from "@/lib/auth";

import dynamic from "next/dynamic";

// recharts 体积较大且仅桌面端 Lab 弹窗使用，改为客户端懒加载，不打入结果页首屏包
const ScientificBarChart = dynamic(() => import("@/components/advisor/ScientificBarChart").then((mod) => mod.ScientificBarChart), { ssr: false });


import { SharePoster } from "@/components/advisor/poster/SharePoster";
import { toBlob } from "html-to-image";
import { toDataURL } from "qrcode";
import ResultCards from "@/components/advisor/ResultCards";

// Import the new CSS Module
import styles from "./result.module.css";
import { ProductRecommendationSection } from "@/components/advisor/ProductRecommendationSection";
import type { ProductCardData } from "@/components/advisor/ProductCard";
import { SaveReportBanner } from "@/components/advisor/SaveReportBanner";
import { AnalyzingOverlay } from "@/components/advisor/AnalyzingOverlay";
// mock 数据仅在 ?mock=true 时动态加载，不打入生产 bundle
import { skinTypes } from "@/lib/result-content";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { ResultErrorBoundary } from "@/components/advisor/ResultErrorBoundary";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { FocusProblemsSection } from "@/components/advisor/FocusProblemsSection";
import { buildFocusProblems, type LifestyleAnswers } from "@/lib/problem-solutions";

// Re-export for backward compatibility with existing imports
export { normalizeAnalysisResult, type ComprehensiveResult } from "@/lib/analysis-result";

interface ResultClientProps {
    id?: string;
    initialData?: {
        result: ComprehensiveResult;
        faceAnalysis: FaceAnalysisResult | null;
        /** 该次测肤的问卷答案（历史报告页从 DB 传入；优先于 localStorage，避免与最新一次测肤串数据） */
        answers?: Record<string, unknown> | null;
    } | null;
    user?: SessionUser | null;
}

// --- Poster image helpers ---

function preloadImage(url: string | undefined): void {
    if (!url) return;
    const img = new globalThis.Image();
    img.src = url;
}

async function waitForImages(container: HTMLElement): Promise<void> {
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(
        images.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            if (img.complete && img.naturalWidth === 0) {
                return Promise.reject(new Error("海报图片加载未成功"));
            }
            return new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("海报图片加载未成功"));
            });
        })
    );
}

// 手机端：十维分析表单（替代 ScientificBarChart）
function MobileDimensionForm({ dimensions }: { dimensions: Record<string, { score?: number } | undefined> }) {
    const order = DIMENSION_ORDER;

    return (
        <div className="sm:hidden mb-5">
            {order.map((key) => {
                const item = dimensions[key];
                const score = item?.score ?? 0;
                const color = score >= 80 ? 'bg-[var(--color-brand-cocoa)]' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
                return (
                    <div key={key} className="py-3 border-b border-[#E8E2D9] last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] text-[#4A4A4A]">{DIMENSION_LABELS[key]}</span>
                            <span className="text-[13px] font-medium text-[#1A1A1A]">{score} 分</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#E8E2D9] overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                        </div>
                        <p className="mt-1.5 text-sm text-[#8A8A8A] leading-relaxed">{DIMENSION_DESCRIPTIONS[key]}</p>
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
                <span className="text-[13px] font-medium text-[var(--color-brand-espresso)] leading-tight">{metric.param}</span>
                {metric.status && (
                    <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isGood ? "bg-[var(--color-brand-cocoa)]/10 text-[var(--color-brand-cocoa)]" : "bg-red-100 text-red-700"
                    )}>
                        {metric.status}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-[11px] text-[#8A8A8A] mb-0.5">测定值</p>
                    <p className="text-[12px] text-[#1A1A1A]">{metric.value}</p>
                </div>
                <div>
                    <p className="text-[11px] text-[#8A8A8A] mb-0.5">参考范围</p>
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

function ResultClientContent({ id, initialData, user: serverUser }: ResultClientProps) {
    const router = useRouter();
    const toast = useToast();
    // 预取首页/问卷路由，避免点击导航按钮时冷导航"点了没反应"；isNavigating 提供即时反馈
    const { push: navPush, isPending: isNavigating } = useNavPush(["/", "/questions?edit=true"]);

    // 入口守卫：必须通过首页引导弹窗后才能查看结果
    // 历史报告页面（/reports/:id）会传入 id 与 initialData，跳过此守卫
    const accessDenied = useMemo(() => {
        if (id || initialData) return false;
        try {
            const hasResult = localStorage.getItem("advisor_result");
            const hasAnswers = localStorage.getItem("advisor_answers");
            const hasConsent = localStorage.getItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
            return !hasResult && !hasAnswers && !hasConsent;
        } catch {
            return true;
        }
    }, [id, initialData]);
    const { trackResultView, trackResultShare, trackProductClick } = useAdvisorAnalytics();
    const { user, isInitialized: authInitialized } = useAuth();
    const { openAuthModal } = useAuthModal();
    const searchParams = useSearchParams();
    const { runAnalysis, analysisState, recoverSession, startMock } = useAsyncAnalysis();

    // Session ID state - needed early for QR code generation
    const [sessionId, setSessionId] = useState<string | undefined>(id);

    // Pre-generate QR code for poster (avoids race condition on save click)
    useEffect(() => {
        const siteBase = process.env.NEXT_PUBLIC_SITE_URL || "https://advisor.nihplod.cn";
        const qrUrl = sessionId
            ? `${siteBase}/?ref=poster_${sessionId}`
            : `${siteBase}/?gift=1`;
        toDataURL(
            qrUrl,
            { width: 80, margin: 1, color: { dark: "#00263E", light: "#0000" } }
        )
            .then((url) => setQrDataUrl(url))
            .catch(() => {
                console.warn("QR code generation failed, poster will not include QR code");
                setQrDataUrl(null);
            });
    }, [sessionId]);

    // Refs for latest auth state to avoid adding them to effect dependency arrays
    const userRef = useRef(serverUser ?? user);
    const authInitializedRef = useRef(!!serverUser || authInitialized);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { authInitializedRef.current = authInitialized; }, [authInitialized]);

    // Data State
    const normalizedResult = useMemo(() => normalizeAnalysisResult(initialData?.result || null), [initialData]);
    const [result, setResult] = useState<ComprehensiveResult | null>(normalizedResult);

    // 错误态重试按钮文案：异步检查真实存储（照片存 IndexedDB 时 localStorage 键已被删除，
    // 只看 localStorage 会在照片完好时误显示"重新填写问卷"）
    const [errorRetryLabel, setErrorRetryLabel] = useState("重新测试");
    // 错误态重试目标：有照片缓存时直接回扫脸页重拍（如距离过远被拒），否则回问卷页
    const [errorRetryTarget, setErrorRetryTarget] = useState("/questions?edit=true");
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { advisorStorage } = await import("@/lib/advisor-storage");
                const images = await advisorStorage.getFaceImages();
                if (!cancelled) {
                    if (images) {
                        setErrorRetryLabel("重新拍摄");
                        setErrorRetryTarget("/face-scan");
                    } else {
                        setErrorRetryLabel("重新填写问卷");
                        setErrorRetryTarget("/questions?edit=true");
                    }
                }
            } catch {
                if (!cancelled) setErrorRetryLabel("重新填写问卷");
            }
        })();
        return () => { cancelled = true; };
    }, []);
    const resultRef = useRef(result);
    useEffect(() => {
        resultRef.current = result;
    }, [result]);
    const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(initialData?.faceAnalysis || null);

    const [userNickname, setUserNickname] = useState<string>(user?.name || "您");
    const [socialGender, setSocialGender] = useState<string>(''); // Initialize empty to avoid flash mismatch

    // 性别恢复：独立执行，保证 initialData（历史报告）提前 return 的路径也能恢复性别。
    // 缺失时回退到面部分析检测的性别，避免 IP 形象/海报头像长期为默认值。
    useEffect(() => {
        if (socialGender === 'male' || socialGender === 'female') return;
        try {
            const storedGender = localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER);
            if (storedGender === 'male' || storedGender === 'female') {
                setSocialGender(storedGender);
                return;
            }
        } catch { /* ignore */ }
        const faGender = faceAnalysis?.gender?.value;
        if (faGender === 'male' || faGender === 'female') {
            setSocialGender(faGender);
        }
    }, [socialGender, faceAnalysis]);

    // IP 匹配所需数据
    const [ipBudget, setIpBudget] = useState<string | undefined>(undefined);
    const [ipSkincareFrequency, setIpSkincareFrequency] = useState<string | undefined>(undefined);

    // 重点问题关注板块：问卷生活方式答案（睡眠/压力/护肤频率）
    const [lifestyleAnswers, setLifestyleAnswers] = useState<LifestyleAnswers>({});

    // UI State
    const [loading, setLoading] = useState(!initialData);
    const hasTrackedView = useRef(false);

    // Gender Mismatch State：存储已确认过的 sessionId，换 session 后自动重新提示
    const [ackedSessionId, setAckedSessionId] = useState<string | null>(() => {
        try { return localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK); } catch { return null; }
    });

    // New State for interactivity

    const [showLabData, setShowLabData] = useState(false);
    // 板块 2 专家护肤建议：默认只显示前 3 条，其余折叠
    const [showAllRecommendations, setShowAllRecommendations] = useState(false);
    const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
    const [posterError, setPosterError] = useState<string | null>(null);
    // 微信内嵌浏览器无法可靠触发下载，生成后改用「长按保存」引导弹窗
    const [savedPosterForSave, setSavedPosterForSave] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [preloadedPosterBlob, setPreloadedPosterBlob] = useState<Blob | null>(null);
    const [dismissValidationWarning, setDismissValidationWarning] = useState(() => {
        try { return sessionStorage.getItem('advisor_dismiss_validation') === 'true'; } catch { return false; }
    });
    const posterRef = useRef<HTMLDivElement>(null);
    const retryButtonRef = useRef<HTMLButtonElement>(null);

    const rankPercentile = useMemo(
        () => {
            if (result?.dataSource === "questionnaire") return undefined;
            const rawScore = faceAnalysis?.overallScore;
            if (rawScore === undefined || rawScore === null) return undefined;
            return getRankPercentile(rawScore);
        },
        [faceAnalysis?.overallScore, result?.dataSource]
    );

    // 重点问题关注：暗沉/黑头/痘痘等具体问题（维度分数 <70 或 AI 症状检测），按严重程度排序
    const focusProblems = useMemo(
        () => buildFocusProblems(faceAnalysis?.dimensions, lifestyleAnswers, faceAnalysis?.skinConditions),
        [faceAnalysis?.dimensions, faceAnalysis?.skinConditions, lifestyleAnswers]
    );

    const isGenderMismatch = useMemo(() => {
        if (!faceAnalysis || !socialGender) return false;
        const faGender = faceAnalysis.gender;
        const faGenderVal = faGender?.value;
        const faGenderConf = faGender?.confidence || 0;

        // Normalize confidence (handle both 0-1 and 0-100)
        const normalizedConf = faGenderConf > 1 ? faGenderConf / 100 : faGenderConf;

        // Mismatch = questionnaire gender differs from detected gender with high confidence
        return faGenderVal && normalizedConf > 0.85 && faGenderVal !== socialGender;
    }, [faceAnalysis, socialGender]);

    const showGenderMismatchModal = useMemo(
        () => !loading && !!result && !!faceAnalysis && isGenderMismatch && !!sessionId && ackedSessionId !== sessionId,
        [loading, result, faceAnalysis, isGenderMismatch, ackedSessionId, sessionId]
    );

    const hasUsedFreeRetry = useMemo(() => {
        if (!sessionId) return false;
        try {
            const freeRetry = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY) === "true";
            const freeRetrySessionId = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID);
            return freeRetry && freeRetrySessionId === sessionId;
        } catch {
            return false;
        }
    }, [sessionId]);

    // Auto-focus primary button when modal opens
    useEffect(() => {
        if (showGenderMismatchModal) {
            // Small delay to wait for animation
            const timer = setTimeout(() => retryButtonRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [showGenderMismatchModal]);

    // 弹窗焦点陷阱（Tab 循环 + 关闭后焦点还原）
    const genderModalRef = useFocusTrap<HTMLDivElement>(!!showGenderMismatchModal);
    const labModalRef = useFocusTrap<HTMLDivElement>(showLabData);
    const savePosterModalRef = useFocusTrap<HTMLDivElement>(savedPosterForSave !== null);

    // 页面进入后后台预加载海报素材
    useEffect(() => {
        if (!result) return;

        const avatarUrl = getCharacterImage({
            score: faceAnalysis?.overallScore ?? 0,
            skinType: result?.skinProfile?.type || 'combination',
            budget: ipBudget,
            skincareFrequency: ipSkincareFrequency,
            gender: socialGender,
        });

        preloadImage("/images/poster-template.png?v=4");
        preloadImage("/images/poster-overlay.png");
        preloadImage(avatarUrl);
    }, [result, faceAnalysis?.overallScore, result?.skinProfile?.type, ipBudget, ipSkincareFrequency, socialGender]);

    // 后台预生成海报 blob：素材和二维码就绪后延迟执行，点击保存时直接使用
    // 性别就绪后才生成，避免把默认女版头像烘焙进海报缓存
    useEffect(() => {
        if (!result || !qrDataUrl || preloadedPosterBlob || !socialGender) return;
        // 触屏设备（手机/平板）跳过预生成：toBlob(pixelRatio:2) 会冻结主线程数百 ms，
        // iOS 低端机甚至可能被杀进程，改为用户点击保存时再现场生成
        if (window.matchMedia("(hover: none)").matches) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                // 先等海报内图片加载完成，避免生成空白 blob
                if (posterRef.current) {
                    await waitForImages(posterRef.current);
                }
                const blob = await generatePosterBlob();
                if (cancelled) return;

                // 不缓存异常小或空白的 blob
                if (!blob || blob.size < 10 * 1024 || (await isBlobBlank(blob))) {
                    console.warn("预生成海报异常（可能为空白），不缓存");
                    return;
                }

                setPreloadedPosterBlob(blob);
            } catch (error) {
                console.error("预生成海报失败:", error);
            }
        }, 1200);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [result, qrDataUrl, preloadedPosterBlob, socialGender]);

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

        navPush("/questions");
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


    // 历史报告页（/reports/:id）：initialData.answers 为 DB 传入的该次测肤问卷答案。
    // loadClientData 对已有结果会短路，localStorage 恢复不会执行，因此这里单独恢复
    // 重点问题关注所需的生活方式数据（睡眠/压力/护肤频率）与 IP 匹配数据（预算/护肤频率）。
    useEffect(() => {
        const answers = initialData?.answers;
        if (!answers) return;
        if (typeof answers.sleepQuality === "string") {
            setLifestyleAnswers(prev => ({ ...prev, sleepQuality: answers.sleepQuality as string }));
        }
        if (typeof answers.stressLevel === "string") {
            setLifestyleAnswers(prev => ({ ...prev, stressLevel: answers.stressLevel as string }));
        }
        if (typeof answers.skincareFrequency === "string") {
            setLifestyleAnswers(prev => ({ ...prev, skincareFrequency: answers.skincareFrequency as string }));
            setIpSkincareFrequency(answers.skincareFrequency as string);
        }
        if (typeof answers.budget === "string") {
            setIpBudget(answers.budget as string);
        }
    }, [initialData]);

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
                if (storedNickname) {
                    setUserNickname(storedNickname);
                } else if (user?.name) {
                    // 未填写过昵称的已登录用户，回退到官网昵称
                    setUserNickname(user.name);
                }

                // Restore Gender（独立 effect 已负责恢复，这里不再重复设置）
                // Restore budget & skincare frequency for IP matching
                const answersStr = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
                if (answersStr) {
                    try {
                        const answers = JSON.parse(answersStr);
                        if (answers.budget) setIpBudget(answers.budget);
                        if (answers.skincareFrequency) setIpSkincareFrequency(answers.skincareFrequency);
                        setLifestyleAnswers({
                            sleepQuality: typeof answers.sleepQuality === "string" ? answers.sleepQuality : undefined,
                            stressLevel: typeof answers.stressLevel === "string" ? answers.stressLevel : undefined,
                            skincareFrequency: typeof answers.skincareFrequency === "string" ? answers.skincareFrequency : undefined,
                        });
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
                                const recoveredSessionId = advisorResult.sessionId as string | undefined;

                                // 昵称兜底：localStorage 的 ADVISOR_NICKNAME 可能已被首页清空，从缓存结果中提取
                                const cachedNickname = advisorResult.nickname;
                                if (typeof cachedNickname === 'string' && cachedNickname) {
                                    setUserNickname(prev => (prev === '您' || prev === userRef.current?.name ? cachedNickname : prev));
                                }

                                // If we successfully recovered data, remove 'analyzing' status from URL to stop re-analysis
                                if (searchParams.get('status') === 'analyzing') {
                                    if (authInitializedRef.current) {
                                        if (userRef.current && recoveredSessionId) {
                                            // 登录用户直接跳转到 /reports/:id，避免先渲染 /result 再跳转的闪烁
                                            router.replace(`/reports/${recoveredSessionId}`, { scroll: false });
                                        } else {
                                            // 游客留在 /result，清掉 analyzing 参数并渲染结果
                                            if (normalized) setResult(normalized);
                                            if (advisorResult.faceAnalysis) setFaceAnalysis(advisorResult.faceAnalysis);
                                            if (recoveredSessionId) setSessionId(recoveredSessionId);
                                            router.replace('/result', { scroll: false });
                                        }
                                    } else if (normalized && recoveredSessionId) {
                                        pendingResultRef.current = {
                                            result: normalized,
                                            faceAnalysis: advisorResult.faceAnalysis || null,
                                            sessionId: recoveredSessionId,
                                        };
                                    }
                                } else {
                                    // 非分析中状态，直接渲染缓存结果
                                    if (normalized) setResult(normalized);
                                    if (advisorResult.faceAnalysis) setFaceAnalysis(advisorResult.faceAnalysis);
                                    if (recoveredSessionId) setSessionId(recoveredSessionId);
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
                        toast.warning("没有找到您的报告数据，请重新完成测评");
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
    }, [initialData, router, trackResultView, searchParams, user, toast]);

    // --- Environment Data Integration ---
    // REMOVED: Weather component has been disabled per user request

    // Actions
    // Save result as image for sharing (image generation in progress)

    function sanitizeFilename(name: string): string {
        return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "用户";
    }

    async function triggerDownload(blob: Blob, filename: string) {
        const blobUrl = URL.createObjectURL(blob);
        const file = new File([blob], filename, { type: "image/png" });

        // 仅在移动设备上尝试系统原生分享；PC 端 navigator.share 打开面板后通常无法真正保存文件
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
        const canShareFiles = typeof navigator.share === "function" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] });

        if (isMobile && canShareFiles) {
            try {
                await navigator.share({
                    title: "我的肌智派证书",
                    files: [file],
                });
                URL.revokeObjectURL(blobUrl);
                return;
            } catch (err) {
                // 用户取消分享或浏览器不支持文件分享，继续走下载兜底
                console.log("navigator.share failed or cancelled", err);
            }
        }

        const link = document.createElement("a");
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }

    async function generatePosterBlob(): Promise<Blob> {
        if (!posterRef.current) throw new Error("posterRef 未就绪");

        const rect = posterRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            throw new Error("海报元素尺寸为 0，无法生成图片");
        }

        await document.fonts.ready;
        await waitForImages(posterRef.current);

        const blob = await toBlob(posterRef.current, {
            pixelRatio: 2,
            cacheBust: false,
            // 覆盖可能被继承的定位/透明/变换，避免离屏容器导致截图异常
            style: {
                position: "relative",
                top: "0",
                left: "0",
                transform: "none",
                opacity: "1",
                visibility: "visible",
                margin: "0",
            },
            backgroundColor: "#ffffff",
        });

        if (!blob) throw new Error("toBlob 返回空");
        return blob;
    }

    async function isBlobBlank(blob: Blob): Promise<boolean> {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(blob);
            const img = new globalThis.Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                if (img.width === 0 || img.height === 0) {
                    resolve(true);
                    return;
                }
                const canvas = document.createElement("canvas");
                canvas.width = Math.min(img.width, 480);
                canvas.height = Math.min(img.height, 640);
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(true);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                try {
                    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    for (let i = 3; i < data.length; i += 4) {
                        if (data[i] > 0) {
                            resolve(false);
                            return;
                        }
                    }
                    resolve(true);
                } catch {
                    resolve(true);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(true);
            };
            img.src = url;
        });
    }

    const handleSavePoster = async () => {
        if (isGeneratingPoster) return;
        try {
            setIsGeneratingPoster(true);
            setPosterError(null);

            // 优先使用后台预生成的 blob，没有则现场生成
            let blob = preloadedPosterBlob;
            if (!blob) {
                blob = await generatePosterBlob();
            }

            // 校验是否空白，若是则丢弃缓存并现场重试一次
            if (!blob || (await isBlobBlank(blob))) {
                if (blob) console.warn("预生成海报为空白，尝试现场重新生成");
                setPreloadedPosterBlob(null);
                blob = await generatePosterBlob();
            }

            if (!blob || (await isBlobBlank(blob))) {
                throw new Error("海报生成结果为空");
            }

            // 微信移动端内置浏览器：<a download> 与 navigator.share(files) 均不可靠，
            // 改为展示海报图片，引导用户长按保存到相册
            const isWeChatMobile = typeof navigator !== "undefined" &&
                /MicroMessenger/i.test(navigator.userAgent) &&
                (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1);
            if (isWeChatMobile) {
                setSavedPosterForSave(URL.createObjectURL(blob));
                trackResultShare("image");
                return;
            }

            const safeName = sanitizeFilename(userNickname || "用户");
            await triggerDownload(blob, `${safeName}的肌智派证书.png`);
            trackResultShare("image");
        } catch (error) {
            console.error("海报生成失败:", error);
            setPosterError("海报生成遇到问题，请稍后重试。");
        } finally {
            setIsGeneratingPoster(false);
        }
    };

    const closePosterSaveModal = () => {
        if (savedPosterForSave) URL.revokeObjectURL(savedPosterForSave);
        setSavedPosterForSave(null);
    };

    // --- Auto-Claim Session ---
    // Automatically link guest-initiated session to user account once logged in
    useEffect(() => {
        if (!user || !sessionId) return;

        const abortController = new AbortController();

        const claimSession = async () => {
            try {
                const claimedKey = STORAGE_KEYS.claimedSession(sessionId);
                if (localStorage.getItem(claimedKey)) return;

                const res = await fetchWithCsrf("/api/advisor/session/claim", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId }),
                    signal: abortController.signal,
                });

                if (!abortController.signal.aborted && res.ok) {
                    localStorage.setItem(claimedKey, 'true');
                    const reportPath = `/reports/${sessionId}`;
                    if (typeof window !== 'undefined' && window.location.pathname !== reportPath && !window.location.pathname.startsWith('/result')) {
                        router.replace(reportPath);
                    }
                }
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error("Failed to claim session:", err);
            }
        };

        claimSession();

        return () => {
            abortController.abort();
        };
    }, [user, sessionId, router]);


    // --- Async Analysis Integration ---
    // searchParams and useAsyncAnalysis are declared at the top of the component

    // Trigger Async Analysis
    const analysisStartedRef = useRef(false);
    const pendingResultRef = useRef<{
        result: ComprehensiveResult;
        faceAnalysis: FaceAnalysisResult | null;
        sessionId: string;
    } | null>(null);

    // 等 auth 初始化后再决定渲染还是跳转，避免登录用户先看到 /result 再闪到 /reports/:id
    useEffect(() => {
        const pending = pendingResultRef.current;
        if (!pending || !authInitializedRef.current) return;
        pendingResultRef.current = null;
        if (userRef.current) {
            router.replace(`/reports/${pending.sessionId}`, { scroll: false });
        } else {
            setResult(pending.result);
            if (pending.faceAnalysis) setFaceAnalysis(pending.faceAnalysis);
            setSessionId(pending.sessionId);
            router.replace('/result', { scroll: false });
        }
    }, [authInitialized, user, router]);

    useEffect(() => {
        const status = searchParams.get('status');
        // Only trigger if we are in 'analyzing' mode, no result yet, and not already running/error
        // Crucial: check 'result' state which might have been populated by loadClientData recovery
        if (status !== 'analyzing' || result || analysisState.status !== 'idle') return;
        if (analysisStartedRef.current) return;
        analysisStartedRef.current = true;

        // Mock 模式：纯前端预览 AnalyzingOverlay，不调用后端
        if (searchParams.get('mock') === 'true') {
            startMock();
            return;
        }
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

                        // 昵称兜底：localStorage 可能已被首页清空，从会话结果中提取
                        const recoveredNickname = (rawResult as Record<string, unknown>).nickname;
                        if (typeof recoveredNickname === 'string' && recoveredNickname) {
                            setUserNickname(prev => (prev === '您' || prev === userRef.current?.name ? recoveredNickname : prev));
                        }

                        if (authInitializedRef.current) {
                            if (userRef.current) {
                                router.replace(`/reports/${recoveredSessionId}`, { scroll: false });
                            } else {
                                if (normalized) setResult(normalized);
                                if (rawResult.faceAnalysis) {
                                    setFaceAnalysis(rawResult.faceAnalysis as FaceAnalysisResult);
                                }
                                setSessionId(recoveredSessionId);
                                router.replace('/result', { scroll: false });
                            }
                        } else if (normalized) {
                            pendingResultRef.current = {
                                result: normalized,
                                faceAnalysis: (rawResult.faceAnalysis as FaceAnalysisResult) || null,
                                sessionId: recoveredSessionId,
                            };
                        }
                        return;
                    }
                    // If recovery returned null (pending/not_found/forbidden), fall through to fresh analysis
                }

                // 2. Normal fresh analysis flow
                const analysisResult = await runAnalysis();
                if (!analysisResult) return; // Already running, skip
                const { result: newResult, faceAnalysis: newFace, sessionId: newSessionId } = analysisResult;

                // 昵称兜底：localStorage 可能已被首页清空，从分析结果中提取
                const freshNickname = (newResult as Record<string, unknown>).nickname;
                if (typeof freshNickname === 'string' && freshNickname) {
                    setUserNickname(prev => (prev === '您' || prev === userRef.current?.name ? freshNickname : prev));
                }

                // Save sessionId for sharing
                if (newSessionId) {
                    setSessionId(newSessionId);
                }

                if (!newSessionId) {
                    throw new Error("会话 ID 丢失，请重新测试");
                }

                // 先跳转/暂存，登录用户不在 /result 渲染结果，避免闪烁
                if (authInitializedRef.current) {
                    if (userRef.current) {
                        router.replace(`/reports/${newSessionId}`, { scroll: false });
                    } else {
                        setResult(newResult as unknown as ComprehensiveResult);
                        if (newFace) setFaceAnalysis(newFace);
                        setSessionId(newSessionId);
                        router.replace('/result', { scroll: false });
                    }
                } else {
                    pendingResultRef.current = {
                        result: newResult as unknown as ComprehensiveResult,
                        faceAnalysis: newFace || null,
                        sessionId: newSessionId,
                    };
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
    }, [searchParams, result, analysisState.status, runAnalysis, recoverSession, router, startMock]);

    // Mock 完成后注入假数据，渲染结果页（动态加载 mock 数据，不影响生产包体积）
    useEffect(() => {
        if (searchParams.get('mock') !== 'true') return;
        if (analysisState.status !== 'completed') return;
        import("./mock-result").then(({ MOCK_RESULT, MOCK_FACE_ANALYSIS }) => {
            setResult(MOCK_RESULT);
            setFaceAnalysis(MOCK_FACE_ANALYSIS);
            setUserNickname("测试用户");
            setSocialGender("female");
            setSessionId("mock-session");
            router.replace('/result?mock=done', { scroll: false });
        });
    }, [analysisState.status, searchParams, router]);

    // 入口守卫：拒绝访问时显示友好提示，而非静默跳转
    if (accessDenied) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-[#F5F2E9]/80 backdrop-blur-sm" />
                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-brand-charcoal/[0.08] shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <div className="sm:w-[60%] text-center sm:text-left">
                            <h3 className="text-lg font-bold text-[var(--color-brand-espresso)] mb-3 sm:mb-2">未授权访问</h3>
                            <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">请从首页开始皮肤测评，完成问卷后即可查看您的分析报告。</p>
                        </div>
                        <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                            <button
                                onClick={() => navPush("/")}
                                className="px-6 h-10 border border-brand-charcoal/60 text-brand-charcoal hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal text-[13px] font-light tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                            >
                                返回首页
                            </button>
                        </div>
                    </div>
                </div>
                <Image src="/images/watermark.png" alt="" width={200} height={200} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-auto object-contain opacity-15 pointer-events-none" unoptimized />
            </div>
        );
    }

    // Error State
    if (analysisState.status === 'error') {
        // 额度/限流类错误：重拍照片无法解决问题，按钮引导返回首页而非重测
        const errorMessage = analysisState.error || "";
        const isQuotaError = /测试次数|测试上限|次数已用完|免费重试|限流|明天再试/i.test(errorMessage);
        return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-brand-charcoal/[0.08] shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <div className="sm:w-[60%] text-center sm:text-left">
                            <h3 className="text-lg font-bold text-[var(--color-brand-espresso)] mb-3 sm:mb-2">
                                {isQuotaError ? "今日测试次数已用完" : "分析遇到了一些问题"}
                            </h3>
                            <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                                {analysisState.error || "服务器暂时无法响应，请稍后再试。"}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                            <button
                                onClick={() => navPush(isQuotaError ? "/" : errorRetryTarget)}
                                className="px-6 h-10 border border-brand-charcoal/60 text-brand-charcoal hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal text-[13px] font-light tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                            >
                                {isQuotaError ? "返回首页" : errorRetryLabel}
                            </button>
                        </div>
                    </div>
                </div>
                <Image src="/images/watermark.png" alt="" width={200} height={200} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-auto object-contain opacity-15 pointer-events-none" unoptimized />
            </div>
        );
    }

    // Enhanced Loading State
    const isAsyncAnalyzing = (searchParams.get('status') === 'analyzing' && searchParams.get('mock') !== 'true') || !['idle', 'completed', 'error'].includes(analysisState.status);
    const showLoading = loading || (!result && isAsyncAnalyzing);

    // Fallback if truly nothing to show (not loading, no result)
    if (!result && !showLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-[#F5F2E9]/80 backdrop-blur-sm" />
                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-brand-charcoal/[0.08] shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <div className="sm:w-[60%] text-center sm:text-left">
                            <h3 className="text-lg font-bold text-[var(--color-brand-espresso)] mb-3 sm:mb-2">报告暂时无法加载</h3>
                            <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">请重新开始一次肌肤检测，获取您的专属分析报告。</p>
                        </div>
                        <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                            <button
                                onClick={() => navPush(errorRetryTarget)}
                                className="px-6 h-10 border border-brand-charcoal/60 text-brand-charcoal hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal text-[13px] font-light tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                            >
                                {errorRetryLabel === "重新填写问卷" ? "重新测试" : errorRetryLabel}
                            </button>
                        </div>
                    </div>
                </div>
                <Image src="/images/watermark.png" alt="" width={200} height={200} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-auto object-contain opacity-15 pointer-events-none" unoptimized />
            </div>
        );
    }

    return (
        <ResultErrorBoundary resetKeys={[id, sessionId]}>
            <>
            <AnimatePresence mode="wait">
                {showLoading && (
                    <AnalyzingOverlay
                        key="analyzing-overlay"
                        progress={analysisState.progress}
                        onCancel={() => navPush('/questions?edit=true')}
                        queuePosition={analysisState.queuePosition}
                        queueWaitSeconds={analysisState.queueWaitSeconds}
                    />
                )}
            </AnimatePresence>

            {/* --- GENDER MISMATCH MODAL --- */}
            <AnimatePresence>
                {showGenderMismatchModal && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] bg-brand-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <m.div
                            ref={genderModalRef}
                            initial={{ scale: 0.95, opacity: 0, y: 8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 8 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="bg-[#FDFBF7] rounded-2xl shadow-sm w-full max-w-[420px] overflow-hidden border border-brand-charcoal/10"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="gender-mismatch-title"
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    e.stopPropagation();
                                    handleMismatchContinue();
                                }
                            }}
                        >
                            <div className="p-7 md:p-8">
                                {/* Header */}
                                <div className="flex flex-col items-center text-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-brand-charcoal/[0.08] flex items-center justify-center">
                                        <AlertTriangle className="w-6 h-6 text-brand-charcoal" strokeWidth={1.5} />
                                    </div>
                                    <h3
                                        id="gender-mismatch-title"
                                        className="text-[17px] font-light text-brand-charcoal tracking-[0.02em]"
                                    >
                                        测前信息准确性提示
                                    </h3>
                                    </div>

                                <div className="space-y-5">
                                    <p className="text-[14px] text-brand-charcoal/60 font-light leading-[1.8] text-left px-1">
                                        AI 面部识别结果显示您的面部特征更接近
                                        <span className="font-light bg-brand-charcoal/[0.08] px-1.5 py-0.5 rounded text-brand-charcoal mx-1">
                                            {faceAnalysis?.gender?.value === 'male' ? '男性' : '女性'}
                                        </span>
                                        ，但您在问卷中选择的是
                                        <span className="font-light bg-brand-charcoal/[0.08] px-1.5 py-0.5 rounded text-brand-charcoal mx-1">
                                            {socialGender === 'male' ? '男性' : '女性'}
                                        </span>
                                        ，二者不一致。
                                    </p>

                                    {/* Callout Block */}
                                    <div className="bg-brand-charcoal/[0.04] p-4 rounded-lg flex items-start gap-3">
                                        <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-brand-charcoal/70" strokeWidth={1.5} />
                                        <div className="space-y-2 text-[13px] text-brand-charcoal/60 font-light leading-[1.8]">
                                            <p>这可能会影响为您匹配<span className="font-light text-brand-charcoal">“针对性护肤方案”</span>的精准度，导致分析结论与您的实际肤感产生偏差。</p>
                                            {hasUsedFreeRetry ? (
                                                <p>该会话已使用过免费重试，重新填写将正常消耗测试次数。</p>
                                            ) : (
                                                <p>建议核实信息以获得更准确的建议。若是填写有误？<span className="font-light text-brand-charcoal">本次重新填写不消耗测试次数</span>。</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-3 pt-2">
                                        <button
                                            ref={retryButtonRef}
                                            onClick={hasUsedFreeRetry ? handleMismatchContinue : handleMismatchRetry}
                                            className="w-full h-11 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[14px] font-light hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw size={14} strokeWidth={2} />
                                            <span>{hasUsedFreeRetry ? "我已了解" : "重新填写问卷"}</span>
                                        </button>

                                        <button
                                            onClick={handleMismatchContinue}
                                            className="w-full h-11 bg-transparent text-brand-charcoal/60 text-[14px] font-light hover:bg-brand-charcoal/[0.06] hover:text-brand-charcoal transition-all flex items-center justify-center gap-2"
                                        >
                                            <span>信息无误，继续查看</span>
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
                    <SaveReportBanner className="hidden md:block" />

                    {/* Logo */}
                    <div className="w-full flex flex-col items-center pt-12">
                        <Image
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD"
                            width={120}
                            height={30}
                            className="h-8 sm:h-10 w-auto object-contain"
                            priority
                        />
                        <p className="mt-6 mb-5 lg:mt-8 lg:mb-8 text-base lg:text-lg text-[var(--color-brand-cocoa)] font-medium tracking-wide flex items-center justify-center gap-2">
                            <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
                            {userNickname} 的专属肌智派在线测肤报告
                        </p>
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

                    {/* Main Content（layout 已提供唯一 <main> 地标，这里用 div 避免嵌套） */}
                    <div className={`${styles.main} lg:gap-8`}>

                        {/* Report Summary Cards */}
                        <ResultCards
                            score={faceAnalysis?.overallScore ?? undefined}
                            skinAge={result?.skinProfile?.skinAge}
                            dimensions={faceAnalysis?.dimensions || {}}
                            nickname={userNickname}
                            gender={socialGender}
                            skinType={result?.skinProfile?.type}
                            budget={ipBudget}
                            skincareFrequency={ipSkincareFrequency}
                            summary={result?.analysis?.summary}
                            rankPercentile={rankPercentile}
                            onDownloadPoster={handleSavePoster}
                            isPosterLoading={isGeneratingPoster}

                            comprehensiveReport={
                                <>
                                    {/* 1、详细诊断报告 */}
                                    <div className="mt-6 lg:mt-14 mb-6">
                                        <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                            1、详细诊断报告 <span className="text-xs lg:text-base">(Detailed Diagnosis)</span>
                                        </h4>

                                        {result.analysis?.details && result.analysis.details.length > 0 ? (
                                            <>
                                                {result.analysis.details[0] && (
                                                    <p className="text-sm lg:text-[15px] leading-relaxed text-[var(--color-brand-espresso)] mb-4">
                                                        {result.analysis.details[0]}
                                                    </p>
                                                )}
                                                {result.analysis.details.length > 1 && (
                                                    <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                                        {result.analysis.details.slice(1).map((item, idx) => (
                                                            <li key={idx}>{item}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-[14px] leading-relaxed text-[var(--color-brand-cocoa)]">
                                                {faceAnalysis?.summary || result.analysis?.summary || "暂无详细诊断报告"}
                                            </p>
                                        )}
                                    </div>

                                    {/* 2、专家护肤建议 */}
                                    <div className="mb-8">
                                        <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                            2、专家护肤建议 <span className="text-xs lg:text-base">(Expert Recommendations)</span>
                                        </h4>

                                        <p className="text-sm text-[var(--color-brand-taupe)] mb-3">根据您的肌肤数据，以下是针对性的护理和生活方式建议：</p>

                                        {(faceAnalysis?.recommendations && faceAnalysis.recommendations.length > 0) ? (
                                            <>
                                                <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                                    {faceAnalysis.recommendations
                                                        .slice(0, showAllRecommendations ? undefined : 3)
                                                        .map((rec, idx) => (
                                                            <li key={idx}>{rec}</li>
                                                        ))}
                                                </ul>
                                                {faceAnalysis.recommendations.length > 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAllRecommendations(v => !v)}
                                                        className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-brand-cocoa)]/70 hover:text-[var(--color-brand-cocoa)] transition-colors"
                                                    >
                                                        {showAllRecommendations
                                                            ? "收起"
                                                            : `查看全部（共 ${faceAnalysis.recommendations.length} 条）`}
                                                        <ChevronDown
                                                            className={cn(
                                                                "w-3.5 h-3.5 transition-transform duration-200",
                                                                showAllRecommendations && "rotate-180"
                                                            )}
                                                        />
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                                <li>每日早晚温和清洁，避免过度去脂。</li>
                                                <li>严格做好防晒，减少紫外线损伤。</li>
                                                <li>根据季节调整保湿产品，保持水油平衡。</li>
                                            </ul>
                                        )}

                                        {/* 🌿 生活建议（嵌套在专家护肤建议内） */}
                                        {result.analysis?.lifestyleTips && result.analysis.lifestyleTips.length > 0 && (
                                            <div className="mt-5 pt-4 border-t border-dashed border-[var(--color-brand-espresso)]/10">
                                                <ul className="list-disc pl-5 space-y-2 lg:space-y-3 text-sm lg:text-[14px] leading-snug lg:leading-relaxed text-[var(--color-brand-cocoa)]">
                                                    {result.analysis.lifestyleTips.map((tip, idx) => (
                                                        <li key={idx}>{tip}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Zone Analysis Grid - always present when data exists, avoids CLS */}
                                    {faceAnalysis?.zoneAnalysis && (
                                        <>
                                            {!authInitialized ? (
                                                <div className="mb-8 min-h-[200px]" />
                                            ) : user ? (
                                                <div className="mb-8">
                                                    <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-4 border-b border-[var(--color-brand-espresso)]/20 pb-2">
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
                                                        } as Record<string, string>).map(([key, label]) => {
                                                            const zoneData = faceAnalysis.zoneAnalysis![key as keyof typeof faceAnalysis.zoneAnalysis];
                                                            if (!zoneData) return null;
                                                            return (
                                                                <div key={key} className="bg-[var(--color-brand-espresso)]/5 border text-left border-[var(--color-brand-espresso)]/15 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="font-semibold text-[var(--color-brand-espresso)] text-sm">{label}</div>
                                                                    </div>
                                                                    <p className="text-sm text-[var(--color-brand-cocoa)] mb-2 leading-snug lg:line-clamp-2">
                                                                        {zoneData.condition}
                                                                    </p>
                                                                    <div className="mt-2 pt-2 border-t border-dashed border-[var(--color-brand-espresso)]/10">
                                                                        <p className="text-xs text-[var(--color-brand-charcoal)] leading-snug">
                                                                            <span className="font-medium text-[var(--color-brand-cocoa)] mr-1">建议:</span>
                                                                            {zoneData.advice}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mb-8">
                                                    <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-4 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                                        3、区域重点关注 <span className="text-xs lg:text-base">(Area Focus)</span>
                                                    </h4>
                                                    <div className="rounded-xl border border-dashed border-[#C9A86C]/40 bg-gradient-to-br from-[#FBF8F3] to-[var(--color-brand-cream)] p-6 text-center">
                                                        <Lock className="w-8 h-8 text-[#C9A86C] mx-auto mb-3" />
                                                        <p className="text-sm text-[var(--color-brand-cocoa)] mb-3 leading-relaxed">
                                                            登录后可解锁区域重点分析，查看额头、T区、脸颊等六大区域的详细诊断与专属建议
                                                        </p>
                                                        <button
                                                            onClick={() => openAuthModal("login")}
                                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-brand-cocoa)] text-white text-xs font-medium hover:bg-[#4a3a2c] transition-colors"
                                                        >
                                                            立即登录解锁
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* 4、重点问题关注 */}
                                    {faceAnalysis && (
                                        <div className="mb-8">
                                            <h4 className="text-base font-medium text-[var(--color-brand-espresso)] mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2">
                                                4、重点问题关注 <span className="text-xs lg:text-base">(Key Concerns)</span>
                                            </h4>
                                            <FocusProblemsSection
                                                problems={focusProblems}
                                                authInitialized={authInitialized}
                                                isLoggedIn={!!user}
                                                onUnlock={() => openAuthModal("login")}
                                            />
                                        </div>
                                    )}

                                    {/* Lab-Grade Analysis Metrics */}
                                    {result?.dataSource !== "questionnaire" && faceAnalysis && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLabData(true)}
                                            className="w-full text-left rounded-xl border border-[var(--color-brand-espresso)]/15 bg-[var(--color-brand-espresso)]/5 shadow-sm overflow-hidden font-sans cursor-pointer hover:bg-[var(--color-brand-espresso)]/[0.07] transition-colors"
                                        >
                                            <div className="px-5 py-3 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-[var(--color-brand-taupe)]" />
                                                    <span className="text-sm font-medium text-[var(--color-brand-espresso)]">定制化专业分析数据详情</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-[var(--color-brand-taupe)] font-normal hidden sm:inline-block">
                                                        MySkin.Today™ Gold Standard
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-[var(--color-brand-taupe)]" />
                                                </div>
                                            </div>
                                            <div className="px-5 pb-3 pt-0">
                                                <p className="text-xs text-[var(--color-brand-taupe)]/80 leading-relaxed pl-6">
                                                    联系您的专属护肤顾问，或咨询门店顾问获取专业分析解读
                                                </p>
                                            </div>
                                        </button>
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
                                        className="absolute inset-0 bg-[var(--color-brand-espresso)]/25 backdrop-blur-sm"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowLabData(false)}
                                    />
                                    <m.div
                                        ref={labModalRef}
                                        className="relative z-10 w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[var(--color-brand-espresso)]/10 shadow-2xl flex flex-col bg-[var(--color-brand-cream)]"
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                        role="dialog"
                                        aria-modal="true"
                                        aria-label="定制化专业分析数据详情"
                                        onKeyDown={(e) => {
                                            if (e.key === "Escape") {
                                                e.stopPropagation();
                                                setShowLabData(false);
                                            }
                                        }}
                                    >
                                        <button
                                            onClick={() => setShowLabData(false)}
                                            className="absolute top-4 right-4 z-20 text-[var(--color-brand-taupe)]/60 hover:text-[var(--color-brand-cocoa)] transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 flex-shrink-0">
                                            <div className="flex items-center gap-3">
                                                <Activity className="w-5 h-5 text-[var(--color-brand-taupe)]" />
                                                <h3 className="text-lg font-bold text-[var(--color-brand-espresso)]">定制化专业分析数据详情</h3>
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

                                            <div className="mt-5 pt-3 border-t border-dashed border-[var(--color-brand-espresso)]/15">
                                                <div className="flex gap-2.5 items-start text-xs leading-relaxed text-[var(--color-brand-cocoa)]">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C9A86C]" />
                                                    <div className="space-y-1.5">
                                                        <p className="font-medium text-[var(--color-brand-espresso)]">数据说明 (Data Disclaimer)</p>
                                                        <p>
                                                            <span className="font-semibold text-[var(--color-brand-espresso)]">* AI ESTIMATE:</span> 上述数值均由 AI 算法基于您的面部图像特征（纹理、色泽、对比度）反演推算得出，<span className="border-b border-[var(--color-brand-espresso)]/20 text-[var(--color-brand-espresso)]">并非物理探头实测数据</span>。
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



                    </div>

                    {/* 4. Products - 与上方专业版报告卡片（含边距）宽度对齐 */}
                    <div className="w-full max-w-[900px] mx-auto px-6 lg:px-10">
                        <ProductRecommendationSection
                            products={(result.products || []).map(p => ({
                                id: p.id,
                                name: p.name,
                                category: p.category,
                                image: p.image,
                                images: p.images || null,
                                price: p.price ?? '',
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
                            centered
                        />
                    </div>

                    {/* Global Footer */}
                    <footer className="w-full bg-transparent mt-0 pb-12">
                        <div className="max-w-[900px] mx-auto px-6 lg:px-10">
                            {/* Secondary actions */}
                            <div className="flex flex-col items-center justify-center gap-2.5 mt-10 mb-10">
                                <div className="flex flex-row flex-wrap justify-center gap-3">
                                    <button
                                        onClick={() => navPush('/')}
                                        disabled={isNavigating}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[12px] sm:text-[13px] tracking-[0.1em] text-[var(--color-brand-cocoa)]/70 font-medium hover:text-[var(--color-brand-cocoa)] transition-colors"
                                    >
                                        <House className="w-3.5 h-3.5" />
                                        回到首页
                                    </button>
                                    <button
                                        onClick={() => navPush('/?gift=1')}
                                        disabled={isNavigating}
                                        className="group inline-flex items-center justify-center gap-2 w-auto sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-full border border-dashed border-[#8B7355]/40 bg-[#8B7355]/[0.04] text-[12px] sm:text-[13px] tracking-[0.1em] text-[#8B7355] hover:text-[var(--color-brand-cocoa)] hover:border-[var(--color-brand-cocoa)]/40 hover:bg-[var(--color-brand-cocoa)]/5 transition-all duration-300"
                                    >
                                        <Gift className="w-4 h-4" />
                                        肌智派送好礼 · 参与抽奖
                                        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                                    </button>
                                </div>
                            </div>

                            {/* Minimal Footer Text — 与首页 Footer 对齐 */}
                            <div className="text-center flex flex-col items-center gap-3">
                                <p className="text-[11px] font-light tracking-[0.15em] text-brand-charcoal/48" suppressHydrationWarning>
                                    © {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                                </p>

                                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/48">
                                    <a
                                        href="https://beian.miit.gov.cn/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="transition-colors hover:text-brand-charcoal/70"
                                    >
                                        沪ICP备2026014764号-1
                                    </a>
                                    <span aria-hidden="true" className="hidden sm:inline">|</span>
                                    <a
                                        href="http://www.beian.gov.cn/portal/registerSystemInfo"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 transition-colors hover:text-brand-charcoal/70"
                                    >
                                        <Image src="/images/beian.webp" alt="" width={12} height={12} className="shrink-0 opacity-80" />
                                        <span>沪公网安备31010702010178号</span>
                                    </a>
                                </div>
                                <p className="text-[11px] font-light tracking-[0.12em] text-brand-charcoal/48">
                                    *AI 分析结果受图像质量影响仅供参考，不构成医疗诊断建议
                                </p>
                            </div>
                        </div>
                    </footer>

                    {posterError && (
                        <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm shadow-lg">
                            {posterError}
                        </div>
                    )}
                    <div
                        aria-hidden="true"
                        style={{
                            position: "fixed",
                            top: "-9999px",
                            left: "-9999px",
                            width: 480,
                            height: 640,
                            pointerEvents: "none",
                            zIndex: -1,
                        }}
                    >
                        <SharePoster
                            ref={posterRef}
                            nickname={userNickname || "用户"}
                            score={faceAnalysis?.overallScore ?? undefined}
                            percentile={rankPercentile}
                            waterOil={faceAnalysis?.dimensions?.waterOil?.score}
                            skinTypeName={result?.persona ? skinTypes.find(t => t.ipKey === result.persona)?.typeName : undefined}
                            skinAge={result?.skinProfile?.skinAge}
                            avatar={socialGender ? getCharacterImage({
                                score: faceAnalysis?.overallScore ?? 0,
                                skinType: result?.skinProfile?.type || 'combination',
                                budget: ipBudget,
                                skincareFrequency: ipSkincareFrequency,
                                gender: socialGender,
                            }) : ""}
                            posterTemplate="/images/poster-template.png?v=4"
                            posterOverlay="/images/poster-overlay.png"
                            qrDataUrl={qrDataUrl}
                            persona={result?.persona ? skinTypes.find(t => t.ipKey === result.persona)?.m1?.persona : undefined}
                            summary={result?.analysis?.summary}
                        />
                    </div>

                    {/* 微信内嵌浏览器海报保存兜底：长按图片保存引导 */}
                    <AnimatePresence>
                        {savedPosterForSave && (
                            <m.div
                                className="fixed inset-0 z-[99998] flex items-center justify-center p-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <m.div
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={closePosterSaveModal}
                                />
                                <m.div
                                    ref={savePosterModalRef}
                                    initial={{ scale: 0.95, opacity: 0, y: 12 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.95, opacity: 0, y: 12 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                    className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-5 text-center shadow-xl"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label="保存测肤证书"
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                            e.stopPropagation();
                                            closePosterSaveModal();
                                        }
                                    }}
                                >
                                    <p className="text-[15px] font-medium text-[var(--color-brand-espresso)] mb-1">长按图片保存证书</p>
                                    <p className="text-[12px] text-[var(--color-brand-taupe)] mb-4">
                                        微信内长按下方图片，选择「保存图片」即可存入相册
                                    </p>
                                    <div className="mx-auto w-full max-w-[300px] rounded-xl overflow-hidden border border-black/5 bg-[var(--color-brand-cream)]">
                                        <Image
                                            src={savedPosterForSave}
                                            alt="肌智派证书海报"
                                            width={480}
                                            height={640}
                                            unoptimized
                                            className="w-full h-auto"
                                        />
                                    </div>
                                    <button
                                        onClick={closePosterSaveModal}
                                        className="mt-4 inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full border border-[var(--color-brand-cocoa)]/30 text-[var(--color-brand-cocoa)] text-[13px] tracking-[0.1em] font-medium hover:bg-[var(--color-brand-cocoa)]/5 transition-colors"
                                    >
                                        已保存，关闭
                                    </button>
                                </m.div>
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>)}
        </>
        </ResultErrorBoundary>
    );
}
