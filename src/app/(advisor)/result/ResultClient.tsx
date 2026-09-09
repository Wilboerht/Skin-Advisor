"use client";

import { useCallback, useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowUp, House, Gift, ArrowRight, AlertCircle, Sparkles, Info, X, ScanFace, FileText } from "lucide-react";
import { useAsyncAnalysis } from "@/hooks/useAsyncAnalysis";
import { AnimatePresence, motion as m, useReducedMotion } from "framer-motion";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useNavPush } from "@/hooks/use-nav-push";
import { useToast } from "@/components/ui/Toast";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { normalizeAnalysisResult, type ComprehensiveResult, type PreviousTestSummary } from "@/lib/analysis-result";
import { getCharacterImage } from "@/lib/result-utils";
import { STORAGE_KEYS, ANALYZING_SESSION_TTL_MS } from "@/lib/storage-keys";
import { fetchWithCsrf } from "@/lib/fetch-client";
import type { SessionUser } from "@/lib/auth";
import { SharePoster } from "@/components/advisor/poster/SharePoster";
import { toBlob } from "html-to-image";
import { toDataURL } from "qrcode";
import ShareCardPage from "@/components/advisor/ShareCardPage";
import ReportPage from "@/components/advisor/ReportPage";
import UserBadge from "@/components/advisor/UserBadge";
import { GenderMismatchModal, LabDataModal, PosterSaveModal } from "@/components/advisor/result-modals";
import { ProductRecommendationSection } from "@/components/advisor/ProductRecommendationSection";
import type { ProductCardData } from "@/components/advisor/ProductCard";
import { SaveReportBanner } from "@/components/advisor/SaveReportBanner";
import { AnalyzingOverlay } from "@/components/advisor/AnalyzingOverlay";
import { skinTypes } from "@/lib/result-content";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { ResultErrorBoundary } from "@/components/advisor/ResultErrorBoundary";
import { buildFocusProblems, type LifestyleAnswers } from "@/lib/problem-solutions";
import { SKIN_STATE_LABELS, isMakeupState } from "@/lib/skin-state";

// Re-export for backward compatibility with existing imports
export { normalizeAnalysisResult, type ComprehensiveResult } from "@/lib/analysis-result";

// Import the CSS Module
import styles from "./result.module.css";

interface ResultClientProps {
    id?: string;
    initialData?: {
        result: ComprehensiveResult;
        faceAnalysis: FaceAnalysisResult | null;
        /** 该次测肤的问卷答案（历史报告页从 DB 传入；优先于 localStorage，避免与最新一次测肤串数据） */
        answers?: Record<string, unknown> | null;
    } | null;
    user?: SessionUser | null;
    /** 本次报告之前最近一次已完成测肤的摘要（登录用户由 /reports/:id 服务端传入；null = 确认为首次测肤）。
     *  undefined = 游客路径（ResultClient 从 localStorage 恢复）。 */
    previousSummary?: PreviousTestSummary | null;
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

// 两页版式共享页头：归属标题（logo 已上移到固定顶部栏，见 styles.topBar）
function ResultHeader({ nickname }: { nickname: string }) {
    return (
        <div className="w-full flex flex-col items-center pt-6 lg:pt-8">
            <p className="mt-0 mb-4 lg:mb-6 text-base lg:text-lg text-[var(--color-brand-cocoa)] font-medium tracking-wide flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
                {nickname} 的专属肌智派在线测肤报告
            </p>
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

function ResultClientContent({ id, initialData, user: serverUser, previousSummary: serverPreviousSummary }: ResultClientProps) {
    const router = useRouter();
    const toast = useToast();
    // 预取首页/问卷路由，避免点击导航按钮时冷导航"点了没反应"；isNavigating 提供即时反馈
    const { push: navPush, isPending: isNavigating } = useNavPush(["/", "/questions?edit=true"]);

    // 入口守卫：必须通过首页引导弹窗后才能查看结果
    // 历史报告页面（/reports/:id）会传入 id 与 initialData，跳过此守卫
    // SSR 水合安全：初始值 null 表示未判定（服务端无 localStorage），挂载后再判定，
    // 未判定期间渲染加载态而非"未授权访问"（同 ackedSessionId / storedSkinState 模式）
    const [accessDenied, setAccessDenied] = useState<boolean | null>((id || initialData) ? false : null);
    useEffect(() => {
        if (id || initialData) return;
        try {
            // 仅当本地存在报告数据或未完成的问卷答案时才放行；
            // 只有隐私授权（hasConsent）不等于有数据——放行后也会被 loadClientData 踢回问卷页，
            // 不如直接在守卫层给出明确的引导页
            const hasResult = localStorage.getItem(STORAGE_KEYS.ADVISOR_RESULT);
            const hasAnswers = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
            setAccessDenied(!hasResult && !hasAnswers);
        } catch {
            setAccessDenied(true);
        }
    }, [id, initialData]);
    const { trackResultView, trackResultShare, trackResultFlip, trackProductClick } = useAdvisorAnalytics();
    const { user, isInitialized: authInitialized } = useAuth();
    const { openAuthModal } = useAuthModal();
    const searchParams = useSearchParams();
    const { runAnalysis, analysisState, recoverSession, startMock } = useAsyncAnalysis();

    // Mock 预览仅本地开发可用（与 face-scan 入口的门控一致），生产环境忽略 mock 参数走正常流程；
    // mock=done 是 mock 数据注入后的 URL 标记，同样按 mock 会话处理（不写趋势快照/不上报埋点/不发起 session claim）
    const isMock = process.env.NODE_ENV !== "production" &&
        (searchParams.get('mock') === 'true' || searchParams.get('mock') === 'done');

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

    // 昵称兜底同步：UserProvider 异步返回（user 后到达）或报告落库昵称存在时，替换占位"您"
    useEffect(() => {
        setUserNickname((prev) => {
            if (prev !== "您" && prev !== "") return prev;
            if (user?.name) return user.name;
            const stored = result?.nickname;
            if (typeof stored === "string" && stored && stored !== "您" && stored !== "护肤达人") return stored;
            return prev;
        });
    }, [user, result]);
    const [socialGender, setSocialGender] = useState<string>(''); // Initialize empty to avoid flash mismatch

    // 历史报告页（/reports/:id）：性别以该次测肤快照为准，而非 localStorage 里的当前偏好，
    // 避免用户测后改性别再打开旧报告时误弹性别不一致弹窗
    const isHistoricalReport = !!(id || initialData);
    const snapshotGender = initialData?.answers?.gender;

    // 性别恢复：独立执行，保证 initialData（历史报告）提前 return 的路径也能恢复性别。
    // 缺失时回退到面部分析检测的性别，避免 IP 形象/海报头像长期为默认值。
    useEffect(() => {
        if (socialGender === 'male' || socialGender === 'female') return;
        if (isHistoricalReport) {
            // 历史报告：优先取该次测肤问卷快照里的性别；快照没有性别记录时不读当前偏好
            if (snapshotGender === 'male' || snapshotGender === 'female') {
                setSocialGender(snapshotGender);
                return;
            }
        } else {
            try {
                const storedGender = localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER);
                if (storedGender === 'male' || storedGender === 'female') {
                    setSocialGender(storedGender);
                    return;
                }
            } catch { /* ignore */ }
        }
        const faGender = faceAnalysis?.gender?.value;
        if (faGender === 'male' || faGender === 'female') {
            setSocialGender(faGender);
        }
    }, [socialGender, faceAnalysis, isHistoricalReport, snapshotGender]);

    // IP 匹配所需数据
    const [ipBudget, setIpBudget] = useState<string | undefined>(undefined);
    const [ipSkincareFrequency, setIpSkincareFrequency] = useState<string | undefined>(undefined);

    // 重点问题关注板块：问卷生活方式答案（睡眠/压力/护肤频率）
    const [lifestyleAnswers, setLifestyleAnswers] = useState<LifestyleAnswers>({});

    // UI State
    const [loading, setLoading] = useState(!initialData);
    // 首次客户端数据恢复是否完成：analysis effect 据此等待 loadClientData，
    // 避免 ?status=analyzing 挂载时在缓存结果读出前就启动新分析（竞态重复扣费）
    const [clientDataLoaded, setClientDataLoaded] = useState(false);
    const hasTrackedView = useRef(false);

    // Gender Mismatch State：存储已确认过的 sessionId，换 session 后自动重新提示
    // 注意：初始值必须是 SSR 安全的 null，挂载后再从 localStorage 同步，
    // 否则服务端（null）与客户端（已存值）渲染不一致会触发 React #418 水合错误
    const [ackedSessionId, setAckedSessionId] = useState<string | null>(null);
    useEffect(() => {
        try { setAckedSessionId(localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER_MISMATCH_ACK)); } catch { /* ignore */ }
    }, []);

    // New State for interactivity

    const [showLabData, setShowLabData] = useState(false);
    const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
    const [posterError, setPosterError] = useState<string | null>(null);
    // 微信内嵌浏览器无法可靠触发下载，生成后改用「长按保存」引导弹窗
    const [savedPosterForSave, setSavedPosterForSave] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [preloadedPosterBlob, setPreloadedPosterBlob] = useState<Blob | null>(null);
    const [dismissValidationWarning, setDismissValidationWarning] = useState(false);
    // SSR 水合安全：初始值固定 false，挂载后再从 sessionStorage 同步（同 ackedSessionId）
    useEffect(() => {
        try { setDismissValidationWarning(sessionStorage.getItem('advisor_dismiss_validation') === 'true'); } catch { /* ignore */ }
    }, []);
    const posterRef = useRef<HTMLDivElement>(null);

    // "超越全国 X% 用户"百分位是固定公式伪统计，v2 报告与分享海报均已下线，不再计算

    // 重点问题关注：暗沉/黑头/痘痘等具体问题（维度分数 <70 或 AI 症状检测），按严重程度排序
    const focusProblems = useMemo(
        () => buildFocusProblems(faceAnalysis?.dimensions, lifestyleAnswers, faceAnalysis?.skinConditions),
        [faceAnalysis?.dimensions, faceAnalysis?.skinConditions, lifestyleAnswers]
    );

    // 证书日期：分析完成时间。缺失（老缓存/历史数据未携带）时不展示日期，避免把"查看时间"伪造成"测肤时间"
    const certDate = result?.analyzedAt;

    // 当前派系中文名（顶部栏身份区/产品区/分享海报共用）
    const personaLabel = result?.persona
        ? skinTypes.find(t => t.ipKey === result.persona)?.typeName
        : undefined;

    // ===== 两页版式（证书封面 + 报告正文）与趋势对比 =====

    // "上一次测肤摘要"：登录用户由服务端 previousSummary 提供（null=确认为首次）；
    // 游客挂载后从 localStorage 恢复（undefined = 恢复中）
    const [guestPrevSnapshot, setGuestPrevSnapshot] = useState<PreviousTestSummary | null | undefined>(undefined);
    useEffect(() => {
        if (serverPreviousSummary !== undefined) return;
        try {
            const rawSnap = localStorage.getItem(STORAGE_KEYS.ADVISOR_LAST_SUMMARY);
            if (rawSnap) {
                const parsed = JSON.parse(rawSnap) as PreviousTestSummary;
                setGuestPrevSnapshot(
                    parsed && (parsed.persona != null || parsed.score != null || parsed.skinAge != null)
                        ? { persona: parsed.persona ?? null, score: parsed.score ?? null, skinAge: parsed.skinAge ?? null, at: parsed.at ?? null }
                        : null
                );
            } else {
                // 兼容旧键（上版本仅存派系字符串）
                const old = localStorage.getItem(STORAGE_KEYS.ADVISOR_LAST_PERSONA);
                setGuestPrevSnapshot(old ? { persona: old } : null);
            }
        } catch {
            setGuestPrevSnapshot(null);
        }
    }, [serverPreviousSummary]);

    // 游客：查看本次报告后记录结构化快照（当前派系/评分/肌肤年龄），作为下次测肤的对比基准
    // mock 会话不写快照，避免假数据污染下次真实测肤的趋势对比基准
    useEffect(() => {
        if (isMock || serverPreviousSummary !== undefined || guestPrevSnapshot === undefined || !result) return;
        const snap: PreviousTestSummary = {
            persona: result.persona || null,
            score: faceAnalysis?.overallScore ?? null,
            skinAge: result?.skinProfile?.skinAge ?? null,
            at: certDate || null,
        };
        try { localStorage.setItem(STORAGE_KEYS.ADVISOR_LAST_SUMMARY, JSON.stringify(snap)); } catch { /* ignore */ }
    }, [isMock, serverPreviousSummary, guestPrevSnapshot, result, faceAnalysis, certDate]);

    /** 生效的"上一次摘要"：服务端优先；游客无快照时为 null（首次）。
     *  仅用于趋势对比板块与 cohort 埋点；封面页每次测肤都先展示，不受本判定影响 */
    const prevSum = serverPreviousSummary !== undefined ? serverPreviousSummary : guestPrevSnapshot;

    /** cohort 指标（统计用）：是否首测 / 派系是否变化 */
    const coverMeta = useMemo(() => {
        if (prevSum === undefined) return undefined;
        const prevPersona = prevSum?.persona ?? null;
        const current = result?.persona || null;
        return {
            firstTest: prevPersona == null,
            personaChanged: prevPersona != null && prevPersona !== current,
        };
    }, [prevSum, result?.persona]);

    // 页面切换：0 = 封面（IP 证书页，每次测肤都先展示），1 = 报告。
    // 初始为封面页；翻页后如返回报告页路径？不会——用户可随时点指示器/「我的证书」回看封面
    const [pageIndex, setPageIndex] = useState<0 | 1>(0);
    const flippedToReportRef = useRef(false);
    const reportLayerRef = useRef<HTMLDivElement>(null);
    // 尊重系统"减弱动效"偏好：翻页交叉淡入淡出降级为瞬时切换
    const reduceMotion = useReducedMotion();

    // 报告层滚动位置记忆：翻回封面时报告层在 AnimatePresence 退出动画结束后被卸载，
    // scrollTop 随之丢失；ref 回调在报告层重新挂载时恢复阅读位置
    const reportScrollTopRef = useRef(0);
    const setReportLayerRef = useCallback((node: HTMLDivElement | null) => {
        reportLayerRef.current = node;
        if (node && reportScrollTopRef.current > 0) {
            node.scrollTop = reportScrollTopRef.current;
        }
    }, []);

    // 封面 → 报告（翻页）：翻页动作恒有效；"封面→报告"转化埋点每会话只记一次
    // （flippedToReportRef 一旦置位不再复位，来回切换封面不重复计入转化）
    const handleFlipToReport = useCallback(() => {
        if (!flippedToReportRef.current) {
            flippedToReportRef.current = true;
            if (!isMock) trackResultFlip("report", coverMeta);
        }
        setPageIndex(1);
    }, [coverMeta, trackResultFlip, isMock]);

    // 报告 → 封面（手动打开证书入口；封面即便初未展示也允许回看）
    const handleOpenCover = useCallback(() => {
        setPageIndex(0);
        if (!isMock) trackResultFlip("cover", coverMeta);
    }, [coverMeta, trackResultFlip, isMock]);

    // 翻页仅接受明确操作（按钮 / 指示器 / 证书入口），不监听滚轮与手势，
    // 避免用户查看封面时误滑动直接翻页丢失当前阅读位置
    // 注意：flippedToReportRef 一旦置位不再复位——"封面→报告"转化每会话只上报一次，
    // 来回切换封面不重复计入转化（cover 打开事件单独上报）

    // result_view 埋点附带 cohort 标记（判定未就绪时仅上报 base 事件）；mock 会话不上报埋点
    const trackView = useCallback(() => {
        if (isMock) return;
        trackResultView(coverMeta);
    }, [coverMeta, trackResultView, isMock]);

    // 拍摄时肌肤状态：优先取分析结果落库值（历史报告），缺失时回退本地存储（当前会话）
    // 本地存储部分挂载后再读，避免 SSR（null）与客户端水合（已存值）不一致触发 React #418
    const [storedSkinState, setStoredSkinState] = useState<string | null>(null);
    useEffect(() => {
        try { setStoredSkinState(localStorage.getItem(STORAGE_KEYS.ADVISOR_SKIN_STATE) || null); } catch { /* ignore */ }
    }, []);
    const skinStateValue = result?.skinState ?? storedSkinState;

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

    // 历史报告页仅在快照本身记录了问卷性别时才可能提示（此时 socialGender 已以快照为准）；
    // 快照无性别记录时不弹窗——性别不一致提示只属于当前测肤流程的 /result
    const showGenderMismatchModal = useMemo(
        () => !loading && !!result && !!faceAnalysis && isGenderMismatch && !!sessionId && ackedSessionId !== sessionId
            && (!isHistoricalReport || snapshotGender === 'male' || snapshotGender === 'female'),
        [loading, result, faceAnalysis, isGenderMismatch, ackedSessionId, sessionId, isHistoricalReport, snapshotGender]
    );

    // SSR 水合安全：初始值固定 false，挂载后再从 localStorage 同步（同 ackedSessionId）
    const [hasUsedFreeRetry, setHasUsedFreeRetry] = useState(false);
    useEffect(() => {
        if (!sessionId) return;
        try {
            const freeRetry = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY) === "true";
            const freeRetrySessionId = localStorage.getItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID);
            setHasUsedFreeRetry(freeRetry && freeRetrySessionId === sessionId);
        } catch { /* ignore */ }
    }, [sessionId]);

    // 页面进入后后台预加载海报素材
    useEffect(() => {
        if (!result) return;

        const avatarUrl = getCharacterImage({
            // 纯问卷场景无评分：传中性分 80 落入 71-89 档，让 matchCharacterIP 按 skinType 匹配派系而非兜底守护派（与封面页一致）
            score: faceAnalysis?.overallScore ?? 80,
            skinType: result?.skinProfile?.type || 'combination',
            budget: ipBudget,
            skincareFrequency: ipSkincareFrequency,
            gender: socialGender,
        });

        preloadImage("/images/poster-template.png?v=4");
        preloadImage("/images/poster-overlay.png");
        preloadImage(avatarUrl);
    }, [result, faceAnalysis?.overallScore, result?.skinProfile?.type, ipBudget, ipSkincareFrequency, socialGender]);

    // 海报内容数据源（昵称/派系头像/面部分析等）变化时使预生成缓存失效，触发重新生成，
    // 避免晚到的数据（昵称兜底同步、localStorage 答案异步恢复）无法进入已缓存的 blob
    useEffect(() => {
        setPreloadedPosterBlob(null);
    }, [result, qrDataUrl, socialGender, userNickname, faceAnalysis, ipBudget, ipSkincareFrequency, sessionId]);

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
                // 海报 DOM 尚未挂载（加载态/分析中等早期分支渲染中）时跳过本次预生成，
                // 后续数据变化会重新触发；用户点击保存时也有现场生成兜底
                if (!posterRef.current) return;
                // 先等海报内图片加载完成，避免生成空白 blob
                await waitForImages(posterRef.current);
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
    }, [result, qrDataUrl, preloadedPosterBlob, socialGender, userNickname, faceAnalysis, ipBudget, ipSkincareFrequency, sessionId]);

    const handleMismatchRetry = () => {
        // Clear previous answers to force a fresh start
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANSWERS);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FACE_IMAGES);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_RESULT);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_STEP);
        // 一并清除拍摄时肌肤状态，避免上一次的状态（如"带妆"）透传给免费重试的新分析
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_SKIN_STATE);

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

    // 封面页"重新测试"：正常消耗次数的全新测试（区别于性别不一致弹窗的免费重试）。
    // 清理本次会话链路（问答/照片/结果/分析中状态），保留昵称与性别等用户偏好；
    // 免费重试标记一并清除，避免新流程误复用旧 sessionId 命中缓存结果
    const handleReTest = () => {
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANSWERS);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FACE_IMAGES);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_RESULT);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_STEP);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_LOCAL);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_SKIN_STATE);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FREE_RETRY);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_FREE_RETRY_SESSION_ID);
        try {
            sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID);
            sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT);
        } catch { /* ignore */ }
        navPush("/questions");
    };

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
                                // 埋点由独立 effect 在 cohort 判定就绪后统一上报
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
        };

        loadClientData().finally(() => setClientDataLoaded(true));
    }, [initialData, router, searchParams, user, toast]);

    // result_view 埋点：等首次数据恢复（clientDataLoaded）且游客端"上一次摘要"恢复完成后
    // 再上报，保证 cohort 标记（首测/派系变化）不因时序竞争而缺失；mock 会话不上报
    useEffect(() => {
        if (hasTrackedView.current || !clientDataLoaded) return;
        if (serverPreviousSummary === undefined && guestPrevSnapshot === undefined) return;
        trackView();
        hasTrackedView.current = true;
    }, [clientDataLoaded, serverPreviousSummary, guestPrevSnapshot, trackView]);

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
                    // 两种空白形态都要拦截：
                    // 1. 全透明（alpha 全 0）——截图失败的典型产物；
                    // 2. 纯色不透明图（如纯白）——alpha 全 255，仅查 alpha 会漏检。
                    // 以首个不透明像素为基准色，出现明显色差即视为有内容。
                    let hasOpaque = false;
                    let baseR = -1, baseG = -1, baseB = -1;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] === 0) continue;
                        hasOpaque = true;
                        if (baseR < 0) {
                            baseR = data[i];
                            baseG = data[i + 1];
                            baseB = data[i + 2];
                            continue;
                        }
                        const diff =
                            Math.abs(data[i] - baseR) +
                            Math.abs(data[i + 1] - baseG) +
                            Math.abs(data[i + 2] - baseB);
                        if (diff > 12) {
                            resolve(false);
                            return;
                        }
                    }
                    resolve(!hasOpaque);
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
                // 现场生成（toBlob pixelRatio:2）在低端机上可能耗时数秒，提前给用户预期，避免误以为卡死
                toast.info("正在生成高清海报，可能需要几秒钟…", 4000);
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
                if (!isMock) trackResultShare("image");
                return;
            }

            const safeName = sanitizeFilename(userNickname || "用户");
            await triggerDownload(blob, `${safeName}的肌智派证书.png`);
            if (!isMock) trackResultShare("image");
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

    // 弹窗打开时直接离开页面的兜底：卸载时 revoke，避免 blob URL 泄漏
    const savedPosterForSaveRef = useRef<string | null>(null);
    useEffect(() => { savedPosterForSaveRef.current = savedPosterForSave; }, [savedPosterForSave]);
    useEffect(() => () => {
        if (savedPosterForSaveRef.current) URL.revokeObjectURL(savedPosterForSaveRef.current);
    }, []);

    // --- Auto-Claim Session ---
    // Automatically link guest-initiated session to user account once logged in
    // mock 会话不发起 claim（mock-session 不是真实会话）
    useEffect(() => {
        if (!user || !sessionId || isMock) return;

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
    }, [user, sessionId, router, isMock]);


    // --- Async Analysis Integration ---
    // searchParams and useAsyncAnalysis are declared at the top of the component

    // Trigger Async Analysis
    const analysisStartedRef = useRef(false);
    const analysisAbortRef = useRef<AbortController | null>(null);
    // 恢复轮询的中止只应发生在组件卸载时；analysis effect 因依赖变化重跑由
    // analysisStartedRef 去重，cleanup 里 abort 会把正在进行的恢复打断（导致回退重复扣费）
    useEffect(() => () => { analysisAbortRef.current?.abort(); }, []);
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
        // clientDataLoaded：等待首次数据恢复完成，避免 loadClientData 尚未读出缓存结果就启动新分析；
        // pendingResultRef：缓存结果在等待 auth 初始化时同样不启动新分析
        if (status !== 'analyzing' || !clientDataLoaded || result || pendingResultRef.current) return;
        if (analysisState.status !== 'idle') return;
        if (analysisStartedRef.current) return;
        analysisStartedRef.current = true;

        // Mock 模式：纯前端预览 AnalyzingOverlay，不调用后端；仅开发环境生效，生产环境忽略 mock 参数
        if (isMock && searchParams.get('mock') === 'true') {
            startMock();
            return;
        }
        const abortController = new AbortController();
        analysisAbortRef.current = abortController;

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
                const shouldRecover = existingSessionId && (Date.now() - startedAt) < ANALYZING_SESSION_TTL_MS;

                if (shouldRecover) {
                    const recovered = await recoverSession(existingSessionId!, abortController.signal);
                    if (recovered) {
                        const { result: rawResult, sessionId: recoveredSessionId } = recovered;

                        // Save to localStorage for normal recovery
                        try {
                            // DB 快照不含 sessionId，补齐后再写入（与正常分析路径 useAsyncAnalysis 保存前补 sessionId 一致），
                            // 否则后续无 ?status=analyzing 的 /result 恢复会丢失 sessionId（海报二维码退化为 ?gift=1、
                            // 证书编号缺失、性别弹窗被抑制、auto-claim 不执行）
                            localStorage.setItem(STORAGE_KEYS.ADVISOR_RESULT, JSON.stringify({ ...rawResult, sessionId: recoveredSessionId }));
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

                // 组件已卸载（卸载时中止了恢复轮询）则不再回退到全新分析，避免重复扣费
                if (abortController.signal.aborted) return;

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
    }, [searchParams, result, analysisState.status, clientDataLoaded, runAnalysis, recoverSession, router, startMock, isMock]);

    // Mock 完成后注入假数据，渲染结果页（动态加载 mock 数据，不影响生产包体积）；仅开发环境生效
    useEffect(() => {
        if (!isMock || searchParams.get('mock') !== 'true') return;
        if (analysisState.status !== 'completed') return;
        import("./mock-result").then(({ MOCK_RESULT, MOCK_FACE_ANALYSIS }) => {
            setResult(MOCK_RESULT);
            setFaceAnalysis(MOCK_FACE_ANALYSIS);
            setUserNickname("测试用户");
            setSocialGender("female");
            setSessionId("mock-session");
            router.replace('/result?mock=done', { scroll: false });
        });
    }, [analysisState.status, searchParams, router, isMock]);

    // 入口守卫判定未就绪（SSR 或挂载前）：渲染加载态，避免水合不一致（React #418）
    if (accessDenied === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
                <ScanFace className="w-12 h-12 text-[#D4B78F] animate-pulse" />
            </div>
        );
    }

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
        // 游客/会话失效触发 401 requireLogin：重试无意义，引导登录
        const isRequireLogin = /需登录|登录后使用/i.test(errorMessage);
        return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-brand-charcoal/[0.08] shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <div className="sm:w-[60%] text-center sm:text-left">
                            <h3 className="text-lg font-bold text-[var(--color-brand-espresso)] mb-3 sm:mb-2">
                                {isRequireLogin ? "测肤需登录后使用" : isQuotaError ? "今日测试次数已用完" : "分析遇到了一些问题"}
                            </h3>
                            <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">
                                {analysisState.error || "服务器暂时无法响应，请稍后再试。"}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                            {isRequireLogin ? (
                                <>
                                    <button
                                        onClick={() => openAuthModal("login")}
                                        className="px-6 h-10 bg-brand-charcoal text-white hover:bg-brand-charcoal/90 text-[13px] font-light tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        登录 / 注册
                                    </button>
                                    <button
                                        onClick={() => navPush("/")}
                                        className="px-6 h-10 border border-brand-charcoal/60 text-brand-charcoal hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal text-[13px] font-light tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        返回首页
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => navPush(isQuotaError ? "/" : errorRetryTarget)}
                                    className="px-6 h-10 border border-brand-charcoal/60 text-brand-charcoal hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal text-[13px] font-light tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                >
                                    {isQuotaError ? "返回首页" : errorRetryLabel}
                                </button>
                            )}
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
                    <GenderMismatchModal
                        key="gender-mismatch"
                        faceAnalysis={faceAnalysis}
                        socialGender={socialGender}
                        hasUsedFreeRetry={hasUsedFreeRetry}
                        onRetry={handleMismatchRetry}
                        onContinue={handleMismatchContinue}
                    />
                )}
            </AnimatePresence>


            {result && (
                <div className={styles.container}>
                    {/* 顶部栏：全局固定，三段式（回首页 / logo / 用户身份区），跨两页共享（不随页面层滚动） */}
                    <header className={styles.topBar}>
                        <div className={styles.topBarInner}>
                            <button
                                onClick={() => navPush('/')}
                                disabled={isNavigating}
                                className="justify-self-start inline-flex items-center gap-1.5 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 text-brand-charcoal/60 hover:text-brand-charcoal transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95 disabled:opacity-40"
                                aria-label="回到首页"
                            >
                                <House className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
                                <span className="hidden sm:inline text-[14px] font-medium tracking-[0.1em]">回到首页</span>
                            </button>

                            <Image
                                src="/NIHPLOD-logo.svg"
                                alt="NIHPLOD"
                                width={120}
                                height={30}
                                className="h-7 md:h-9 w-auto object-contain justify-self-center"
                                priority
                            />

                            <div className="justify-self-end">
                                <UserBadge personaLabel={personaLabel} />
                            </div>
                        </div>
                    </header>

                    {/* ===== 两页切换：封面（第一面）/ 报告（第二面），交叉淡入淡出 ===== */}
                    <AnimatePresence initial={false}>
                        {pageIndex === 0 && (
                            <m.div
                                key="cover-layer"
                                className={styles.pageLayer}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeInOut" }}
                            >
                                <ResultHeader nickname={userNickname} />
                                <div className={`${styles.main} lg:gap-8`}>
                                    <section aria-label="肌智派证书（第一面）">
                                        <ShareCardPage
                                            nickname={userNickname}
                                            score={faceAnalysis?.overallScore ?? undefined}
                                            skinType={result?.skinProfile?.type || 'combination'}
                                            budget={ipBudget}
                                            skincareFrequency={ipSkincareFrequency}
                                            gender={socialGender}
                                            summary={result?.analysis?.summary}
                                            onDownloadPoster={handleSavePoster}
                                            isPosterLoading={isGeneratingPoster}
                                            certDate={certDate}
                                            certId={sessionId}
                                            onOpenReport={handleFlipToReport}
                                            onReTest={handleReTest}
                                            isReturning={!!prevSum}
                                        />
                                    </section>
                                </div>
                            </m.div>
                        )}

                        {pageIndex === 1 && (
                            <m.div
                                key="report-layer"
                                ref={setReportLayerRef}
                                className={styles.pageLayer}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeInOut" }}
                                onScroll={(e) => { reportScrollTopRef.current = e.currentTarget.scrollTop; }}
                            >
                                {/* Save Report Banner for unauthenticated users */}
                                <SaveReportBanner className="hidden md:block" />

                                <ResultHeader nickname={userNickname} />

                                {/* Validation Warning Banner */}
                                {faceAnalysis?.validation && !faceAnalysis.validation.isValid && !dismissValidationWarning && (
                                    <div className="w-full bg-red-50 border-b border-red-100 relative z-10">
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

                                {/* Main Content（layout 已提供唯一 <main> 地标，这里用 div 避免嵌套）。
                                    所有板块统一在 styles.main 容器内，由 gap（24/32px）规范间距、滚动同宽对齐 */}
                                <div className={`${styles.main} lg:gap-8`}>
                                    {/* 拍摄时肌肤状态：影响分析口径的说明，置于报告正文最顶部（趋势对比/报告卡之前） */}
                                    {skinStateValue && SKIN_STATE_LABELS[skinStateValue] && (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-white/60 px-3 py-1 text-[11px] text-brand-charcoal/60 font-light tracking-[0.05em]">
                                                <Info className="w-3 h-3 text-brand-charcoal/40" strokeWidth={1.5} />
                                                本次测肤状态：{SKIN_STATE_LABELS[skinStateValue]}
                                            </span>
                                            {isMakeupState(skinStateValue) && (
                                                <p className="text-[11px] text-brand-charcoal/40 font-light tracking-[0.04em]">
                                                    带妆拍摄，色斑、泛红与肤色相关结果仅供参考
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <section aria-label="测肤报告（第二面）">
                                        <ReportPage
                                            result={result}
                                            faceAnalysis={faceAnalysis}
                                            nickname={userNickname}
                                            previousSummary={prevSum || null}
                                            authInitialized={authInitialized}
                                            isLoggedIn={!!user}
                                            focusProblems={focusProblems}
                                            onOpenLab={() => setShowLabData(true)}
                                            onUnlock={() => openAuthModal("login")}
                                        />
                                    </section>

                                    {/* 产品推荐 - 与报告卡同一容器宽度（不再各自控制 padding） */}
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
                                        personaLabel={personaLabel}
                                        onProductClick={(productId) => {
                                            const product = result.products?.find(p => p.id === productId);
                                            if (product && !isMock) {
                                                trackProductClick(productId, product.name);
                                            }
                                        }}
                                        centered
                                    />

                                    {/* Global Footer */}
                                    <footer className="w-full bg-transparent mt-0 pb-12">
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
                                    </footer>
                                </div>
                            </m.div>
                        )}
                    </AnimatePresence>

                    {/* 报告页浮动操作区：回顶部 + 证书入口（分享裂变兜底），竖向堆叠不遮挡内容 */}
                    {pageIndex === 1 && (
                        <div className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2">
                            <button
                                onClick={() => reportLayerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                                className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-brand-charcoal/15 bg-white/80 backdrop-blur text-brand-charcoal/60 hover:text-brand-charcoal transition-colors"
                                aria-label="回到顶部"
                            >
                                <ArrowUp className="w-4 h-4" strokeWidth={2} />
                            </button>
                            <button
                                onClick={handleOpenCover}
                                className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-white/80 backdrop-blur px-3 py-1.5 text-[11px] text-brand-charcoal/70 font-medium hover:text-brand-charcoal hover:border-brand-charcoal/30 transition-colors"
                                aria-label="查看我的肌智派证书"
                            >
                                <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
                                我的证书
                            </button>
                        </div>
                    )}

                    {/* 定制化分析数据详情 Modal - Page Level */}
                    <LabDataModal
                        open={showLabData}
                        onClose={() => setShowLabData(false)}
                        faceAnalysis={faceAnalysis}
                    />

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
                            waterOil={faceAnalysis?.dimensions?.waterOil?.score}
                            skinTypeName={personaLabel}
                            skinAge={result?.skinProfile?.skinAge}
                            avatar={socialGender ? getCharacterImage({
                                // 纯问卷场景无评分：传中性分 80 落入 71-89 档，让 matchCharacterIP 按 skinType 匹配派系而非兜底守护派（与封面页一致）
                                score: faceAnalysis?.overallScore ?? 80,
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
                            certDate={certDate}
                            certId={sessionId}
                        />
                    </div>

                    {/* 微信内嵌浏览器海报保存兜底：长按图片保存引导 */}
                    <PosterSaveModal
                        imageUrl={savedPosterForSave}
                        onClose={closePosterSaveModal}
                    />
                </div>)}
        </>
        </ResultErrorBoundary>
    );
}
