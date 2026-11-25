"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceCapture, type FaceCaptureImages } from "@/components/advisor/FaceCapture";
import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, LogOut } from "lucide-react";
import Image from "next/image";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";
import { ScanGuideModal } from "@/components/advisor/ScanGuideModal";
import { hasPrivacyConsent } from "@/lib/consent-storage";
import { fetchConsentState } from "@/lib/consent-client";
import { useAuth } from "@/hooks/useAuth";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useNavPush } from "@/hooks/use-nav-push";
import { Button } from "@/components/ui/Button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useFaceModels } from "@/hooks/use-face-models";
import { scheduleFaceModelPreload } from "@/lib/face-models";
import { isSkinStateValue, type SkinStateValue } from "@/lib/skin-state";

export default function FaceScanPage() {
    const router = useRouter();
    // 预取首页与问卷页路由，避免顶部栏按钮冷导航"点了没反应"；isNavigating 提供即时反馈
    const { push: navPush, isPending: isNavigating } = useNavPush(["/", "/questions?edit=true"]);
    const toast = useToast();
    const { trackFaceScanStart, trackFaceScanComplete } = useAdvisorAnalytics();
    const { user, isInitialized } = useAuth();

    // 本地开发环境自动启用 mock 模式，跳过 AI 调用
    const isDev = process.env.NODE_ENV !== "production";
    const resultUrl = isDev ? "/result?status=analyzing\u0026mock=true" : "/result?status=analyzing";

    const hasTrackedStart = useRef(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [entryReady, setEntryReady] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(true);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [storageError, setStorageError] = useState(false);
    // 退出确认框的目标：返回首页 or 返回问卷；避免顶部“返回”静默丢弃已拍照片
    const [exitTarget, setExitTarget] = useState<"/" | "/questions?edit=true">("/");
    // 问卷中选择的性别（ADVISOR_GENDER）：决定 ScanGuideModal 的引导头像
    const [gender, setGender] = useState<"female" | "male" | null>(null);
    // 上次选择的肌肤状态：返回修改问卷后再次进入时保留，避免静默重置为素颜
    const [initialSkinState, setInitialSkinState] = useState<SkinStateValue | undefined>(undefined);
    // 上次分析失败的面部原因（由结果页写入），在引导页提示用户如何调整
    const [previousFaceError, setPreviousFaceError] = useState<string | null>(null);
    // 面部模型全局状态（唯一事实源）：face-models store 单飞加载，问卷页已触发、这里只订阅
    const { status: faceModelStatus, load: loadFaceModels } = useFaceModels();

    // 模态框打开时锁定 body 滚动，防止 iOS 上顶部栏跟随滑动
    useBodyScrollLock({ enabled: isModalOpen || showExitConfirm || storageError });

    // 已开始拍摄后刷新/关闭页面会丢失照片，浏览器级确认。
    // 提交期间也要保留：动态导入/IndexedDB 写入完成前关闭页面同样会丢图。
    useEffect(() => {
        if (!hasStarted) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [hasStarted]);
    useEffect(() => {
        if (!isInitialized) return;
        let cancelled = false;

        (async () => {
            // 扫脸接口强制登录：提前拦截，避免用户拍完才 401
            if (!isDev && !user) {
                toast.warning("请先登录后再进行测肤");
                router.replace("/?auth=login&redirect=/face-scan");
                return;
            }

            // 本地无同意记录时，再查一次服务端（支持换设备/清缓存后的老用户）
            if (!hasPrivacyConsent()) {
                const state = await fetchConsentState().catch(() => null);
                if (cancelled) return;
                // 网络异常（state=null）时对已登录用户放行，由后续服务端校验兜底；
                // 服务端明确返回缺失 scope 时才拦截。
                if (state && state.missing.length > 0) {
                    toast.warning("请先完成隐私授权");
                    router.replace("/");
                    return;
                }
            }

            // 校验是否有问卷数据 (增加对无痕模式及禁用Storage时的异常处理)
            let answers = null;
            try {
                answers = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
            } catch (e) {
                console.warn("Storage API disabled or unavailable", e);
                // Storage 不可用时重定向回问卷页，由问卷页引导用户
                toast.warning("请先完成问卷");
                router.replace("/questions");
                return;
            }

            if (!answers) {
                toast.warning("请先完成问卷");
                router.replace("/questions");
                return;
            }
            try {
                const parsed = JSON.parse(answers);
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                    throw new Error("invalid answers shape");
                }
            } catch {
                toast.warning("问卷数据异常，请重新填写");
                router.replace("/questions");
                return;
            }

            try {
                const savedGender = localStorage.getItem(STORAGE_KEYS.ADVISOR_GENDER);
                if (savedGender === "female" || savedGender === "male") setGender(savedGender);
                const savedSkinState = localStorage.getItem(STORAGE_KEYS.ADVISOR_SKIN_STATE);
                if (isSkinStateValue(savedSkinState)) setInitialSkinState(savedSkinState);
                const savedFaceError = sessionStorage.getItem(STORAGE_KEYS.ADVISOR_FACE_ERROR);
                if (savedFaceError) {
                    setPreviousFaceError(savedFaceError);
                    sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_FACE_ERROR);
                }
            } catch { /* Storage 不可用时保持默认头像 */ }

            if (!hasTrackedStart.current) {
                trackFaceScanStart();
                hasTrackedStart.current = true;
            }
            setEntryReady(true);
        })();

        return () => { cancelled = true; };
    }, [trackFaceScanStart, router, toast, isDev, isInitialized, user]);

    // 全屏准备遮罩最多 8 秒：之后进入相机，由 FaceCapture 展示模型慢加载提示与手动拍照入口
    useEffect(() => {
        if (!isPreparing) return;
        const timer = setTimeout(() => setIsPreparing(false), 8000);
        return () => clearTimeout(timer);
    }, [isPreparing]);

    // 模型就绪/失败后关闭准备遮罩（失败时 FaceCapture 会给出"手动拍照 + 重试"降级引导）
    useEffect(() => {
        if (faceModelStatus === "ready" || faceModelStatus === "failed") {
            setIsPreparing(false);
        }
    }, [faceModelStatus]);

    // 模型预加载：统一走 face-models store（问卷页选性别时已空闲调度，这里是刷新直达本页的兜底）；
    // 空闲调度启动，避免 face-api/TF.js 的解析编译长任务挤占顶部栏"返回/退出"的点击响应
    useEffect(() => {
        scheduleFaceModelPreload(3000, 1000);
    }, []);

    const handleCaptureComplete = async (images: FaceCaptureImages) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
        // 1. 必须四个角度全部存在，不再接受单张正面照片 fallback
        const requiredAngles: (keyof FaceCaptureImages)[] = ["front", "left", "right", "chin"];
        const missing = requiredAngles.filter((k) => !images[k]);
        if (missing.length > 0) {
            toast.error("请完成全部角度的拍摄后再继续。");
            setIsSubmitting(false);
            throw new Error("INCOMPLETE_IMAGES");
        }

        const { advisorStorage } = await import("@/lib/advisor-storage");

        // 只持久化正面照：侧脸/下巴不参与分析与展示，减少本地照片残留
        const success = await advisorStorage.saveFaceImages({ front: images.front });

        if (!success) {
            console.warn("Storage full, attempting cleanup...");
            toast.warning("正在优化存储空间...");

            // 只清理面部照片/旧结果，绝不能清问卷答案与隐私同意：
            // 否则用户刚完成问卷和拍摄，进入结果页会被入口守卫判定"未授权访问"。
            await advisorStorage.clearFaceImages();

            const retrySuccess = await advisorStorage.saveFaceImages({ front: images.front });
            if (!retrySuccess) {
                toast.error("存储空间不足，请清理浏览器缓存后重试");
                setIsSubmitting(false);
                setStorageError(true);
                // 抛给 FaceCapture：让它重置 isAllCaptured 并重新打开相机，
                // 否则用户会卡在“正在分析”且相机已停止的死路。
                throw new Error("STORAGE_FULL");
            }
        }

        trackFaceScanComplete();
        // 保持 isSubmitting=true 直到导航完成，避免提交期间重复触发
        router.push(resultUrl);
        } catch (err) {
            // 捕获动态导入失败（ChunkLoadError）等未预期异常，避免 UI 卡在转圈
            console.error("[FaceScan] handleCaptureComplete failed:", err);
            const isStorageFull = err instanceof Error && err.message === "STORAGE_FULL";
            const isIncomplete = err instanceof Error && err.message === "INCOMPLETE_IMAGES";
            if (!isStorageFull && !isIncomplete) {
                const isChunkError = (err as Error)?.name === 'ChunkLoadError' || (err as Error)?.message?.includes('Failed to load chunk');
                toast.error(isChunkError ? "加载未成功，请刷新后重试。" : "处理未成功，请重试。");
            }
            setIsSubmitting(false);
            throw err; // 通知 FaceCapture 保留照片并显示重试层
        }
    };

    if (!entryReady) {
        return (
            <div className="fixed inset-0 z-0 flex flex-col items-center justify-center bg-brand-canvas-warm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="mt-3 text-[13px] font-light text-muted-foreground">正在检查测肤状态…</p>
            </div>
        );
    }

    return (
        <div className="relative h-dvh overflow-hidden w-full bg-brand-canvas-warm flex flex-col items-center">
            {/* Top Bar —— 复用 /questions 统一样式 */}
            <header className={`w-full relative flex items-center justify-center pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-4 md:pt-[calc(1.75rem+env(safe-area-inset-top,0px))] md:pb-4 px-4 md:px-12 lg:px-20 z-[310] shrink-0 border-b border-border transition-colors duration-300 ${isModalOpen ? 'bg-brand-canvas-soft' : 'bg-brand-canvas-warm'}`}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (isSubmitting) return;
                        if (hasStarted) {
                            setExitTarget("/questions?edit=true");
                            setShowExitConfirm(true);
                        } else {
                            navPush("/questions?edit=true");
                        }
                    }}
                    disabled={isNavigating || isSubmitting}
                    className="absolute left-4 gap-1.5 md:left-12 lg:left-20"
                    aria-label="返回"
                >
                    <ChevronLeft />
                    <span className="hidden sm:inline">返回</span>
                </Button>

                <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={120}
                    height={36}
                    className="h-7 md:h-9 w-auto object-contain"
                    priority
                />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (isSubmitting) return;
                        setExitTarget("/");
                        setShowExitConfirm(true);
                    }}
                    disabled={isNavigating || isSubmitting}
                    className="absolute right-4 gap-1.5 md:right-12 lg:right-20"
                    aria-label="退出测试"
                >
                    <LogOut />
                    <span className="hidden sm:inline">退出</span>
                </Button>
            </header>

            {/* Main Content: Mirror Container pushed to center */}
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 px-6 md:px-0">
                <AnimatePresence>
                    {hasStarted && (
                        <m.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-full max-w-[420px] md:max-w-[480px] aspect-[3/4] max-h-[65dvh] md:max-h-[70dvh] bg-black rounded-[2rem] overflow-hidden shadow-[0_8px_32px_-8px_rgba(0,38,62,0.12),0_24px_60px_-20px_rgba(0,38,62,0.18)] ring-[3px] ring-brand-canvas-soft z-10 flex flex-col before:absolute before:inset-0 before:rounded-[2rem] before:ring-1 before:ring-inset before:ring-white/10 before:pointer-events-none"
                        >
                            {/* Real Camera Component */}
                            <FaceCapture onCapture={handleCaptureComplete} />
                        </m.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer with Copyright & Registration —— Modal 打开时隐藏，避免与 ScanGuideModal 内 footer 重复 */}
            {!isModalOpen && (
            <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="hidden sm:flex justify-center pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-4 shrink-0"
            >
                <div className="flex flex-col items-center gap-2 text-[11px] font-light text-foreground/[0.48] leading-tight">
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 tracking-[0.1em] md:tracking-[0.12em]">
                        <p suppressHydrationWarning>&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                        <span className="text-muted-foreground/50">·</span>
                        <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="transition-colors duration-300 hover:text-foreground/75">隐私政策</a>
                        <span className="text-muted-foreground/50">·</span>
                        <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="transition-colors duration-300 hover:text-foreground/75">服务条款</a>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 tracking-[0.12em]">
                        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="transition-colors duration-300 hover:text-foreground/75">沪ICP备2026014764号-1</a>
                        <span aria-hidden="true" className="hidden sm:inline text-muted-foreground/50">|</span>
                        <a href="http://www.beian.gov.cn/portal/registerSystemInfo" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 transition-colors duration-300 hover:text-foreground/75">
                            <Image src="/images/beian.webp" alt="" width={12} height={12} className="shrink-0 opacity-80" />
                            <span>沪公网安备31010702010178号</span>
                        </a>
                    </div>
                </div>
            </m.div>
            )}

            {/* 全屏加载遮罩：模型加载中 */}
            <AnimatePresence>
                {isPreparing && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="fixed inset-0 z-[9999] bg-brand-canvas flex flex-col items-center justify-center"
                    >
                        <Loader2 className="mb-8 h-10 w-10 animate-spin text-primary" />
                        <p className="text-xl font-semibold tracking-tight md:text-2xl">正在准备 AI 面部扫描</p>
                        <p className="mt-3 max-w-xs text-center text-sm text-muted-foreground">首次加载模型可能需要 10–30 秒；若加载较慢，可先进入相机使用手动拍照</p>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsPreparing(false)}
                            className="mt-6"
                        >
                            先进入相机
                        </Button>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Exit Confirmation Modal —— 复用 /questions 风格 */}
            <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>退出测试？</DialogTitle>
                        <DialogDescription>
                            退出后将清除已拍摄的照片，下次进入需重新拍摄；问卷答案会保留。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowExitConfirm(false)}
                        >
                            继续测试
                        </Button>
                        <Button
                            onClick={async () => {
                                // 仅清除人脸照片缓存，保留问卷答案和进度供用户返回修改
                                const { advisorStorage } = await import("@/lib/advisor-storage");
                                await advisorStorage.clearFaceImages();
                                navPush(exitTarget);
                            }}
                        >
                            {exitTarget === "/questions?edit=true" ? "离开并返回问卷" : "退出并返回首页"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Storage Error Modal —— 存储空间不足时的逃生出口 */}
            <Dialog
                open={storageError}
                onOpenChange={(open) => {
                    if (!open) {
                        setStorageError(false);
                        setIsSubmitting(false);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>存储空间不足</DialogTitle>
                        <DialogDescription>
                            浏览器存储空间已满，无法保存照片。请清理浏览器缓存后重新尝试。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setStorageError(false);
                                setIsSubmitting(false);
                            }}
                        >
                            重新尝试拍照
                        </Button>
                        <Button
                            onClick={async () => {
                                // 仅清理人脸照片缓存，保留问卷答案/隐私同意
                                const { advisorStorage } = await import("@/lib/advisor-storage");
                                await advisorStorage.clearFaceImages();
                                navPush("/");
                            }}
                        >
                            退出并返回首页
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Prep Guide Modal */}
            <ScanGuideModal
                isOpen={isModalOpen}
                gender={gender}
                initialSkinState={initialSkinState}
                previousError={previousFaceError}
                onConfirm={(skinState) => {
                    // 记录拍摄时肌肤状态（供分析条件化与结果页提示）
                    try { localStorage.setItem(STORAGE_KEYS.ADVISOR_SKIN_STATE, skinState); } catch { /* ignore */ }
                    setHasStarted(true);
                    // 用户明确开始扫描时强制按需加载模型（saveData/慢网也不跳过），
                    // 加载期间给 12s 兜底遮罩与手动拍照入口。
                    if (faceModelStatus !== "ready") {
                        setIsPreparing(true);
                        void loadFaceModels().catch((err) => {
                            console.warn("[FaceScan] face model load failed", err);
                            setIsPreparing(false);
                        });
                    }
                    setIsModalOpen(false);
                }}
                onExit={() => navPush("/questions?edit=true")}
            />
        </div>
    );
}

