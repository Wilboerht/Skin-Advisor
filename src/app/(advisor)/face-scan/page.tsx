"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceCapture, type FaceCaptureImages } from "@/components/advisor/FaceCapture";
import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, LogOut, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";
import { ScanGuideModal } from "@/components/advisor/ScanGuideModal";

export default function FaceScanPage() {
    const router = useRouter();
    const toast = useToast();
    const { trackFaceScanStart, trackFaceScanComplete } = useAdvisorAnalytics();
    const hasTrackedStart = useRef(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(true);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [preloadedFaceApi, setPreloadedFaceApi] = useState<any>(null);

    useEffect(() => {
        // 校验是否有问卷数据 (增加对无痕模式及禁用Storage时的异常处理)
        let answers = null;
        try {
            answers = localStorage.getItem("advisor_answers");
        } catch (e) {
            console.warn("Storage API disabled or unavailable", e);
            // 兜底策略：如果浏览器彻底禁用了 Storage，跳过校验直接放行，避免无限拦截造成死循环
            answers = "fallback_allowed";
        }

        if (!answers) {
            router.replace("/questions");
            return;
        }

        if (!hasTrackedStart.current) {
            trackFaceScanStart();
            hasTrackedStart.current = true;
        }
    }, [trackFaceScanStart, router]);

    // 预加载 face-api 模型：用户还在看引导页时就开始加载，减少等待时间
    useEffect(() => {
        let cancelled = false;
        const preloadModels = async () => {
            try {
                const faceapi = await import("@vladmandic/face-api");
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
                    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
                ]);
                if (!cancelled) {
                    setPreloadedFaceApi(faceapi);
                    console.log("Face-api models preloaded successfully");
                }
            } catch (err) {
                console.error("Failed to preload face-api models:", err);
            }
        };
        preloadModels();
        return () => { cancelled = true; };
    }, []);

    const handleCaptureComplete = async (images: FaceCaptureImages) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const { advisorStorage } = await import("@/lib/advisor-storage");

        const success = await advisorStorage.saveFaceImages(images);

        if (success) {
            // ★ 后台立即预处理+上传（不阻塞跳转）
            Promise.resolve().then(async () => {
                try {
                    const { preprocessFaceImage, getBase64Size } = await import("@/lib/image-processing");
                    const { uploadImage } = await import("@/lib/upload-client");

                    const angles = [
                        { key: 'front' as const, label: 'front' },
                        { key: 'left' as const, label: 'left' },
                        { key: 'right' as const, label: 'right' },
                        { key: 'chin' as const, label: 'chin' },
                    ];

                    const processedEntries = await Promise.all(
                        angles.map(async ({ key, label }) => {
                            const imgData = images[key];
                            if (!imgData) return null;

                            let finalData = imgData;

                            // 预处理：base64 且 >300KB 才处理
                            if (finalData.startsWith('data:')) {
                                const base64Size = getBase64Size(finalData);
                                if (base64Size < 300 * 1024) {
                                    console.log(`[Background] ${label} already small (${Math.round(base64Size / 1024)}KB), skipping preprocess`);
                                } else {
                                    try {
                                        const { imageData } = await preprocessFaceImage(imgData);
                                        finalData = imageData;
                                    } catch (e) {
                                        console.warn(`[Background] Preprocess failed for ${label}`, e);
                                    }
                                }
                            }

                            // 上传（只有 base64 才需要上传）
                            if (finalData.startsWith('data:')) {
                                try {
                                    const blob = await (await fetch(finalData)).blob();
                                    const url = await uploadImage(blob, `face-${label}.jpg`);
                                    if (url) finalData = url;
                                } catch (e) {
                                    console.warn(`[Background] Upload failed for ${label}`, e);
                                }
                            }

                            return { key, finalData };
                        })
                    );

                    const processed: Record<string, string> = {};
                    for (const entry of processedEntries) {
                        if (entry) processed[entry.key] = entry.finalData;
                    }

                    if (Object.keys(processed).length > 0) {
                        await advisorStorage.saveProcessedImages(processed);
                        console.log("[Background] Preprocess+upload complete", Object.keys(processed));
                    }
                } catch (e) {
                    console.warn("[Background] Preprocess+upload task failed", e);
                }
            });

            trackFaceScanComplete();
            router.push("/result?status=analyzing");
            return;
        }

        console.warn("Storage full, attempting cleanup...");
        toast.warning("正在优化存储空间...");

        await advisorStorage.clearAll();

        const retrySuccess = await advisorStorage.saveFaceImages(images);
        if (retrySuccess) {
            trackFaceScanComplete();
            router.push("/result?status=analyzing");
            return;
        }

        const frontOnlySuccess = await advisorStorage.saveFaceImages({ front: images.front });
        if (frontOnlySuccess) {
            toast.warning("仅保存了正面照片");
            trackFaceScanComplete();
            router.push("/result?status=analyzing");
            return;
        }

        toast.error("存储空间不足，请清理浏览器缓存后重试");
    };

    return (
        <div className="relative h-dvh overflow-hidden w-full bg-[#F5F2E9] flex flex-col items-center">
            {/* Top Bar —— 复用 /questions 统一样式 */}
            <header className={`w-full relative flex items-center justify-center py-5 md:py-7 px-4 md:px-12 lg:px-20 z-[310] shrink-0 border-b border-[#3D4430]/5 transition-colors duration-300 ${isModalOpen ? 'bg-[#FAF8F5]' : 'bg-[#F5F2E9]'}`}>
                <button
                    onClick={() => router.push("/questions?edit=true")}
                    className="absolute left-4 md:left-12 lg:left-20 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                    aria-label="返回"
                >
                    <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                    <span className="hidden sm:inline text-[14px] font-medium tracking-wide">返回</span>
                </button>

                <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={120}
                    height={30}
                    className="h-7 md:h-9 w-auto object-contain"
                    priority
                />

                <button
                    onClick={() => setShowExitConfirm(true)}
                    className="absolute right-4 md:right-12 lg:right-20 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                    aria-label="退出测试"
                >
                    <LogOut className="w-5 h-5" strokeWidth={1.5} />
                    <span className="hidden sm:inline text-[14px] font-medium tracking-wide">退出</span>
                </button>
            </header>

            {/* Main Content: Mirror Container pushed to center */}
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 px-4 md:px-0">
                <AnimatePresence>
                    {hasStarted && (
                        <m.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-full max-w-[480px] aspect-[3/4] max-h-[70vh] bg-black rounded-[2rem] overflow-hidden shadow-[0_24px_70px_-18px_rgba(0,0,0,0.28)] ring-[5px] ring-[#FAF8F5] z-10 flex flex-col before:absolute before:inset-0 before:rounded-[2rem] before:ring-1 before:ring-inset before:ring-white/15 before:pointer-events-none"
                        >
                            {/* Real Camera Component */}
                            <FaceCapture
                                onCapture={handleCaptureComplete}
                                onModelsLoaded={() => setIsPreparing(false)}
                                externalFaceApi={preloadedFaceApi}
                            />
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
                className="flex flex-col items-center py-6 shrink-0"
            >
                <div className="flex flex-col items-center gap-1 opacity-40">
                    <p className="text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A]">
                        &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                    </p>
                    <div className="flex items-center justify-center gap-3 text-[9px] sm:text-[10px] font-light text-[#1A1A1A]">
                        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-gold transition-colors">沪ICP备2026014764号-1</a>
                        <span className="opacity-20">|</span>
                        <a href="#" className="flex items-center gap-1 hover:text-brand-gold transition-colors">
                            <img src="/images/beian.webp" alt="" className="w-3 h-3 opacity-80" />
                            <span>沪公网安备 31011502019404号</span>
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
                        className="fixed inset-0 z-[9999] bg-[#FDFBF7] flex flex-col items-center justify-center"
                    >
                        <Loader2 className="w-10 h-10 text-[#8B7355] animate-spin mb-8" />
                        <p className="text-[#1A1A1A] text-xl md:text-2xl font-serif tracking-wide">正在准备 AI 面部扫描</p>
                        <p className="text-[#5E5E5E] text-sm md:text-[15px] mt-3 font-light max-w-xs text-center leading-relaxed">首次加载模型需要几秒钟，请保持耐心</p>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Exit Confirmation Modal —— 复用 /questions 风格 */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#FDFBF7]/90 backdrop-blur-sm"
                            onClick={() => setShowExitConfirm(false)}
                        />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-sm bg-white/70 backdrop-blur-xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] border border-[#D4CFC5] text-center rounded-xl overflow-hidden"
                        >
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
                            <div className="relative z-10">
                                <h3 className="text-xl font-serif text-[#1A1A1A] mb-2">结束测试？</h3>
                                <p className="text-sm text-[#5E5E5E] mb-8 font-light leading-relaxed">
                                    您的进度已自动保存，<br />下次返回可直接从此处继续。
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="w-full h-11 rounded-md bg-[#4A3728] hover:bg-[#3D2E20] text-[#FDFBF7] text-[13px] font-medium tracking-[0.15em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <span>继续测试</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const { advisorStorage } = await import("@/lib/advisor-storage");
                                            await advisorStorage.clearAll();
                                            router.push("/");
                                        }}
                                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                    >
                                        退出并返回首页
                                    </button>
                                </div>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Prep Guide Modal */}
            <ScanGuideModal
                isOpen={isModalOpen}
                onConfirm={() => {
                    setHasStarted(true);
                    setIsPreparing(true);
                    setIsModalOpen(false);
                }}
            />
        </div>
    );
}

