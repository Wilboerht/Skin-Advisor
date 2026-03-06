"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceCapture, type FaceCaptureImages } from "@/components/advisor/FaceCapture";
import { m } from "framer-motion";
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
        <div className="relative min-h-screen w-full bg-transparent flex flex-col items-center justify-center p-4">
            {/* Floating Back Button */}
            <div className="absolute top-6 left-6 z-[110]">
                <Link
                    href="/questions"
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 text-[#1A1A1A]/60 hover:bg-white hover:text-[#1A1A1A] hover:shadow-sm transition-all border border-[#1A1A1A]/5"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="text-xs font-medium tracking-wide">返回</span>
                </Link>
            </div>

            {/* Title - Only visible on large screens when not capturing */}
            <div className="absolute top-8 text-center hidden md:block z-0">
                <h1 className="font-serif text-xl text-[#1A1A1A]/80 tracking-wide">AI 皮肤分析</h1>
            </div>

            {/* The "Mirror" Container */}
            <div className="relative w-full max-w-[480px] aspect-[3/4] max-h-[80vh] bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-8 ring-white/50 z-10 flex flex-col">
                {!hasStarted ? (
                    // Camera Placeholder when modal is open
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#1A1A1A] text-white/20 p-8 text-center">
                        <m.div
                            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center mb-4"
                        >
                            <Camera className="h-8 w-8" />
                        </m.div>
                        <p className="text-xs font-light tracking-widest uppercase opacity-40">Ready to Scan</p>
                    </div>
                ) : (
                    // Real Camera Component
                    <FaceCapture onCapture={handleCaptureComplete} />
                )}
            </div>

            {/* Bottom Note */}
            <p className="mt-8 text-xs text-[#1A1A1A]/30 text-center font-light tracking-wider uppercase">
                隐私保护 • 数据安全加密
            </p>

            {/* Prep Guide Modal */}
            <ScanGuideModal
                isOpen={isModalOpen}
                onConfirm={() => {
                    setHasStarted(true);
                    setIsModalOpen(false);
                }}
                onCancel={() => {
                    router.push("/questions");
                }}
            />
        </div>
    );
}

