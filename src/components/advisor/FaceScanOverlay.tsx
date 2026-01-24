"use client";

import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronUp, ScanLine, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CaptureStep = "front" | "left" | "right" | "chin";
type FaceStatus = "none" | "detecting" | "found" | "ready";

interface FaceScanOverlayProps {
    currentStep: CaptureStep;
    faceStatus: FaceStatus;
    stabilityProgress: number;
}

/**
 * 面部扫描动态蒙版组件 - 3.0 亮色优化版
 * 核心优化：采用 White/Gold 亮色高级质感，去除深色沉重感
 */
export function FaceScanOverlay({
    currentStep,
    faceStatus,
    stabilityProgress,
}: FaceScanOverlayProps) {

    const getBorderColor = () => {
        switch (faceStatus) {
            case "found": return "border-brand-gold";
            case "ready": return "border-emerald-500";
            default: return "border-white/40";
        }
    };

    return (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* 1. 核心扫描区域 */}
            <div className="relative h-[70%] w-[65%]">

                {/* 椭圆边框容器 */}
                <div className="absolute inset-0">
                    {/* 静态基础边框 */}
                    <div className={cn(
                        "absolute inset-0 rounded-[50%] border-[2px] transition-all duration-500",
                        getBorderColor(),
                        faceStatus !== "ready" && "border-dashed opacity-50"
                    )} />

                    {/* 动态呼吸光环 (Found) */}
                    {faceStatus === "found" && (
                        <m.div
                            className="absolute -inset-[2px] rounded-[50%] border-2 border-brand-gold/60"
                            animate={{ opacity: [0, 0.8, 0], scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        />
                    )}

                    {/* 成功锁定光环 (Ready) */}
                    {faceStatus === "ready" && (
                        <m.div
                            className="absolute -inset-[2px] rounded-[50%] border-2 border-emerald-500"
                            initial={{ scale: 1, opacity: 0 }}
                            animate={{ scale: 1.08, opacity: [0, 1, 0] }}
                            transition={{ duration: 0.6 }}
                        />
                    )}
                </div>

                {/* 扫描激光 */}
                <AnimatePresence>
                    {currentStep === "front" && faceStatus !== "ready" && (
                        <m.div
                            className="absolute left-[8%] right-[8%] h-[2px] bg-gradient-to-r from-transparent via-brand-gold to-transparent shadow-[0_0_15px_rgba(234,179,8,0.5)]"
                            initial={{ top: "10%", opacity: 0 }}
                            animate={{ top: ["10%", "90%", "10%"], opacity: 1 }}
                            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                            exit={{ opacity: 0 }}
                        />
                    )}
                </AnimatePresence>

            </div>

            {/* 2. 顶部指引已移除，由父组件统一接管 */}


            {/* 3. 中心倒计时 (仅在Found且未Ready时显示) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <AnimatePresence>
                    {faceStatus === "found" && stabilityProgress > 0 && stabilityProgress < 100 && (
                        <m.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.2, opacity: 0 }}
                            className="relative z-10"
                        >
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/40 shadow-lg">
                                <span className="font-mono text-3xl font-bold text-white tracking-tighter drop-shadow-md">
                                    {Math.ceil((100 - stabilityProgress) / 25)}
                                </span>
                                <svg className="absolute inset-0 h-full w-full -rotate-90">
                                    <circle cx="40" cy="40" r="38" className="fill-none stroke-white/20 stroke-[3]" />
                                    <m.circle
                                        cx="40" cy="40" r="38"
                                        className="fill-none stroke-brand-gold stroke-[3] stroke-linecap-round filter drop-shadow-sm"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: stabilityProgress / 100 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                </svg>
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>

        </div>
    );
}
