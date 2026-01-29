"use client";

import { useEffect, useRef } from "react";
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

    useEffect(() => {
        // 校验是否有问卷数据
        const answers = localStorage.getItem("advisor_answers");
        if (!answers) {
            router.replace("/questions");
            return;
        }

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

    const handleCaptureComplete = (images: FaceCaptureImages) => {
        // 保存图片到 local storage 供分析页使用
        const saveImages = (data: any): boolean => {
            try {
                localStorage.setItem("advisor_face_images", JSON.stringify(data));
                return true;
            } catch {
                return false;
            }
        };

        // 尝试保存完整数据
        if (saveImages(images)) {
            trackFaceScanComplete();
            router.push("/analyzing");
            return;
        }

        // 存储失败，先清理旧数据再重试
        console.warn("Storage full, attempting cleanup...");
        toast.info("正在优化存储空间...");

        if (clearOldStorageData() && saveImages(images)) {
            trackFaceScanComplete();
            router.push("/analyzing");
            return;
        }

        // 仍然失败，尝试只保存正面照
        console.warn("Still full, trying front-only...");
        if (saveImages({ front: images.front })) {
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
                    <span className="text-xs font-medium tracking-wide">BACK</span>
                </Link>
            </div>

            {/* Title - Only visible on large screens when not capturing */}
            <div className="absolute top-8 text-center hidden md:block z-0">
                <h1 className="font-serif text-xl text-[#1A1A1A]/80 tracking-wide">AI Skin Analysis</h1>
            </div>

            {/* The "Mirror" Container */}
            <div className="relative w-full max-w-[480px] aspect-[3/4] max-h-[80vh] bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-8 ring-white/50 z-10">
                <FaceCapture onCapture={handleCaptureComplete} />
            </div>

            {/* Bottom Note */}
            <p className="mt-8 text-xs text-[#1A1A1A]/30 text-center font-light tracking-wider uppercase">
                Privacy Protected • Bank-grade Security
            </p>
        </div>
    );
}
