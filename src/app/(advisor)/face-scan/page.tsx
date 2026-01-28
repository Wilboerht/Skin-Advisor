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
                toast.error("您的设备存储空间不足，无法保存照片。");
            }
        }
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
