"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceCapture, type FaceCaptureImages } from "@/components/advisor/FaceCapture";
import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, Camera } from "lucide-react";
import Link from "next/link";
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
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleCaptureComplete = async (images: FaceCaptureImages) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const { advisorStorage } = await import("@/lib/advisor-storage");


        const success = await advisorStorage.saveFaceImages(images);

        if (success) {
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
        <div className="relative min-h-screen w-full bg-transparent flex flex-col items-center p-4">
            {/* Top Navigation Bar: 90% Width */}
            <header className="w-full flex justify-center z-[110] shrink-0">
                <div className="w-[90%] py-6 flex items-center justify-between relative">
                    <Link
                        href="/questions"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/40 backdrop-blur-md text-[#1A1A1A]/60 hover:bg-white/80 hover:text-[#1A1A1A] hover:shadow-xl transition-all border border-white/40 shadow-sm"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="text-xs font-bold tracking-widest uppercase">返回</span>
                    </Link>

                    {/* Centered Brand Logo */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                        <img
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD 旎柏"
                            className="h-7 md:h-8 object-contain opacity-90 mix-blend-multiply"
                        />
                    </div>

                    {/* Placeholder to maintain flex balance */}
                    <div className="w-10 h-10" />
                </div>
            </header>

            {/* Main Content: Mirror Container pushed to center */}
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
                <AnimatePresence>
                    {hasStarted && (
                        <m.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-full max-w-[480px] aspect-[3/4] max-h-[70vh] bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-8 ring-white/50 z-10 flex flex-col"
                        >
                            {/* Real Camera Component */}
                            <FaceCapture onCapture={handleCaptureComplete} />
                        </m.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer with Copyright & Registration */}
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
                        <a href="https://beian.miit.gov.cn/" target="_blank" className="hover:text-brand-gold transition-colors">沪ICP备2026014764号-1</a>
                        <span className="opacity-20">|</span>
                        <a href="#" className="flex items-center gap-1 hover:text-brand-gold transition-colors">
                            <img src="/images/beian.webp" alt="" className="w-3 h-3 opacity-80" />
                            <span>沪公网安备 31011502019404号</span>
                        </a>
                    </div>
                </div>
            </m.div>

            {/* Prep Guide Modal */}
            <ScanGuideModal
                isOpen={isModalOpen}
                onConfirm={() => {
                    setHasStarted(true);
                    setIsModalOpen(false);
                }}
                onCancel={() => {
                    router.push("/questions?edit=true");
                }}
                onExit={async () => {
                    const { advisorStorage } = await import("@/lib/advisor-storage");
                    await advisorStorage.clearAll();
                    router.push("/");
                }}
            />
        </div>
    );
}

