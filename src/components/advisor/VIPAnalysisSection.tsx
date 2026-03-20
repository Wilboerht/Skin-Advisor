"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VIPFeatureCard } from "./VIPFeatureCard";
import type { ZoneAnalysis } from "@/lib/advisor-utils";
import type { DimensionKey } from "@/lib/face-zones";

// 动态导入 MediaPipe 组件以减少初始包大小，并仅在 VIP 模式下加载
const FaceAnalysisOverlay = dynamic(
    () => import("@/components/advisor/FaceAnalysisOverlay").then(mod => mod.FaceAnalysisOverlay),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full bg-slate-900/5 animate-pulse rounded-2xl flex items-center justify-center">
                <span className="text-xs text-slate-400">加载 AI 引擎...</span>
            </div>
        )
    }
);

const DimensionSwitcher = dynamic(
    () => import("@/components/advisor/DimensionSwitcher").then(mod => mod.DimensionSwitcher),
    { ssr: false }
);

interface VIPAnalysisSectionProps {
    imageUrl?: string;
    zoneAnalysis?: ZoneAnalysis;
    className?: string;
}

export function VIPAnalysisSection({ imageUrl, zoneAnalysis, className }: VIPAnalysisSectionProps) {
    const { isVip, loading } = useAuth();
    const [activeDimension, setActiveDimension] = useState<DimensionKey>('overall');

    // 1. Loading State
    if (loading) {
        return (
            <div className="w-full h-[500px] bg-slate-50 rounded-2xl animate-pulse mt-8 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="w-48 h-4 rounded bg-slate-200" />
            </div>
        );
    }

    // 2. Non-VIP View (Marketing Card)
    if (!isVip) {
        return (
            <div className="w-full h-[500px] md:h-[600px] mt-8">
                <VIPFeatureCard userImage={imageUrl} />
            </div>
        );
    }

    // 3. VIP View (Full AR Experience)
    return (
        <div className={`space-y-6 mt-8 ${className || ''}`}>
            {/* Dimension Switcher */}
            <div className="flex justify-center px-4 w-full overflow-x-hidden">
                <DimensionSwitcher
                    activeDimension={activeDimension}
                    onChange={setActiveDimension}
                />
            </div>

            {/* AR Overlay Container */}
            <div className="relative w-full aspect-[3/4] md:aspect-[4/5] max-w-lg mx-auto rounded-3xl overflow-hidden bg-black/5 shadow-2xl ring-1 ring-black/5">
                {imageUrl ? (
                    <FaceAnalysisOverlay
                        imageUrl={imageUrl}
                        zoneAnalysis={zoneAnalysis}
                        activeDimension={activeDimension}
                    />
                ) : (
                    <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm">
                        无法加载图像
                    </div>
                )}
            </div>

            <div className="text-center text-xs text-slate-400 py-2">
                * VIP 专属：基于 MediaPipe 478点面部网格实时渲染
            </div>
        </div>
    );
}
