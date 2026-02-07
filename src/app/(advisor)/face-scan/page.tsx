"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceCapture, type FaceCaptureImages } from "@/components/advisor/FaceCapture";
import { m } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";

export default function FaceScanPage() {
    const router = useRouter();
    const toast = useToast();
    const { trackFaceScanStart, trackFaceScanComplete } = useAdvisorAnalytics();
    const hasTrackedStart = useRef(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // 校验是否有问卷数据
        const answers = localStorage.getItem("advisor_answers");
        if (!answers) {
            router.replace("/questions");
            return;
        }

        // 仅当用户点击开始后，才追踪 "Start" 事件? 或者进入页面就算?
        // 保持原有逻辑，进入页面就算 Start，因为这代表漏斗的一层转化
        if (!hasTrackedStart.current) {
            trackFaceScanStart();
            hasTrackedStart.current = true;
        }
    }, [trackFaceScanStart, router]);

    // 清理旧的本地存储数据以释放空间
    const clearOldStorageData = () => {
        const keysToTry = [
            "advisor_result",        // 旧的分析结果（最大）
            "advisor_face_images",   // 旧的面部图片
            "advisor_step",          // 步骤索引
        ];

        let clearedSomething = false;
        for (const key of keysToTry) {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                clearedSomething = true;
                console.log(`Cleared ${key} to free up space`);
            }
        }
        return clearedSomething;
    };

    const handleCaptureComplete = async (images: FaceCaptureImages) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        // Import advisorStorage dynamically to avoid SSR issues
        const { advisorStorage } = await import("@/lib/advisor-storage");

        // 尝试保存完整数据（优先 IndexedDB，fallback localStorage）
        toast.info("正在保存图片...");

        const success = await advisorStorage.saveFaceImages(images);

        if (success) {
            trackFaceScanComplete();
            router.push("/analyzing");
            return;
        }

        // 存储失败，先清理旧数据再重试
        console.warn("Storage full, attempting cleanup...");
        toast.warning("正在优化存储空间...");

        await advisorStorage.clearAll();

        const retrySuccess = await advisorStorage.saveFaceImages(images);
        if (retrySuccess) {
            trackFaceScanComplete();
            router.push("/analyzing");
            return;
        }

        // 仍然失败，尝试只保存正面照
        console.warn("Still full, trying front-only...");
        const frontOnlySuccess = await advisorStorage.saveFaceImages({ front: images.front });
        if (frontOnlySuccess) {
            toast.warning("仅保存了正面照片");
            trackFaceScanComplete();
            router.push("/analyzing");
            return;
        }

        // 最终失败
        toast.error("存储空间不足，请清理浏览器缓存后重试");
    };

    return (
        <div className="relative min-h-screen w-full bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
            {/* Floating Back Button */}
            <div className="absolute top-6 left-6 z-50">
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
                    // Guide / Permission Request Screen
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#1A1A1A] p-8 text-white text-center">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6">
                            <span className="text-3xl">📸</span>
                        </div>

                        <h2 className="font-serif text-2xl mb-2">准备好开始分析了吗？</h2>
                        <p className="text-white/60 text-sm mb-8 px-4">
                            为了通过 AI 获得最准确的结果，请遵循以下建议：
                        </p>

                        <div className="space-y-4 w-full max-w-xs mb-10">
                            <div className="flex items-center gap-4 text-left bg-white/5 p-3 rounded-xl">
                                <span className="text-xl">💄</span>
                                <div>
                                    <p className="text-sm font-medium">素颜状态</p>
                                    <p className="text-xs text-white/40">保持皮肤自然状态，结果更准确</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-left bg-white/5 p-3 rounded-xl">
                                <span className="text-xl">👓</span>
                                <div>
                                    <p className="text-sm font-medium">摘下眼镜</p>
                                    <p className="text-xs text-white/40">避免反光和遮挡</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-left bg-white/5 p-3 rounded-xl">
                                <span className="text-xl">💡</span>
                                <div>
                                    <p className="text-sm font-medium">光线充足</p>
                                    <p className="text-xs text-white/40">保持面部光线明亮均匀</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setHasStarted(true)}
                            className="w-full bg-white text-black py-4 rounded-xl font-medium tracking-wide hover:bg-[#F0F0F0] active:scale-[0.98] transition-all shadow-lg shadow-white/10"
                        >
                            开启摄像头
                        </button>
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
        </div>
    );
}
