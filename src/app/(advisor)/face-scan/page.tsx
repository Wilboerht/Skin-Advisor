"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaceCapture, type FaceCaptureImages } from "@/components/advisor/FaceCapture";
import { m } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";

export default function FaceScanPage() {
    const router = useRouter();
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

    const handleCaptureComplete = (images: FaceCaptureImages) => {
        // 保存图片到 local storage 供分析页使用
        try {
            localStorage.setItem("advisor_face_images", JSON.stringify(images));
            trackFaceScanComplete();
            router.push("/analyzing");
        } catch (e) {
            console.error("Storage full, clearing old data");
            localStorage.removeItem("advisor_face_images");
            // 尝试只存一张
            try {
                localStorage.setItem("advisor_face_images", JSON.stringify({ front: images.front }));
                trackFaceScanComplete();
                router.push("/analyzing");
            } catch (e2) {
                alert("您的设备存储空间不足，无法保存照片。");
            }
        }
    };

    return (
        <div className="flex h-screen w-full flex-col bg-black">
            {/* 顶部导航 */}
            <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent p-4 pb-12">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <Link href="/questions" className="flex items-center text-white/80 hover:text-white transition-colors">
                        <ChevronLeft className="h-6 w-6" />
                        <span className="ml-1 text-sm font-medium">重选问题</span>
                    </Link>
                    <span className="text-sm font-medium text-white/90 tracking-wide font-serif">AI 面部扫描</span>
                    <div className="w-16" /> {/* 占位平衡 */}
                </div>
            </div>

            <div className="relative h-full w-full overflow-hidden rounded-none sm:rounded-3xl">
                <FaceCapture onCapture={handleCaptureComplete} />
            </div>
        </div>
    );
}
