"use client";

import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CaptureStep = "front" | "left" | "right" | "chin";
type FaceStatus = "none" | "detecting" | "found" | "ready" | "success";

interface FaceScanOverlayProps {
    currentStep: CaptureStep;
    faceStatus: FaceStatus;
    stabilityProgress: number;
    successStep?: CaptureStep | null;
}

/**
 * 面部扫描动态蒙版组件 - 3.0 亮色优化版
 * 核心优化：采用 White/Gold 亮色高级质感，去除深色沉重感
 */
export function FaceScanOverlay({
    currentStep,
    faceStatus,
    stabilityProgress,
    successStep,
}: FaceScanOverlayProps) {
    const prefersReducedMotion = useReducedMotion();

    const getBorderColor = () => {
        switch (faceStatus) {
            case "found": return "border-brand-gold";
            case "ready": return "border-emerald-500";
            case "success": return "border-emerald-500";
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

                    {/* 动态呼吸光环 (Found)：reduced-motion 时退化为静态光环 */}
                    {faceStatus === "found" && (
                        <m.div
                            className="absolute -inset-[2px] rounded-[50%] border-2 border-brand-gold/60"
                            animate={prefersReducedMotion ? { opacity: 0.6 } : { opacity: [0, 0.8, 0], scale: [1, 1.05, 1] }}
                            transition={prefersReducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 2, ease: "easeInOut" }}
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

                    {/* 椭圆框进度描边：随倒计时稳定度从 0 逐渐闭合到 100%（金色的"进度圈"）。
                        ready 态保持完全闭合一圈，直到 success 绿环确认动画接手——用户能看到"完整闭合"瞬间。
                        实现为 conic-gradient 环 + 前缘圆点（SVG dash 在非等比拉伸下会铺贴错乱成多段圆弧） */}
                    {(faceStatus === "found" || faceStatus === "ready") && stabilityProgress > 0 && stabilityProgress <= 100 && (
                        <div
                            className="scan-progress-ring absolute inset-0 rounded-[50%] pointer-events-none"
                            style={{
                                "--scan-progress": `${Math.min(stabilityProgress, 100)}%`,
                                filter: "drop-shadow(0 0 6px rgba(201,168,108,0.5))",
                            } as React.CSSProperties}
                        >
                            {/* 前缘圆点：随进度角绕椭圆边界旋转，模拟圆头笔端 */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    transform: `rotate(${Math.min(stabilityProgress, 100) * 3.6}deg)`,
                                    transition: prefersReducedMotion ? "none" : "transform 250ms linear",
                                }}
                            >
                                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-[#C9A86C] shadow-[0_0_8px_rgba(201,168,108,0.8)]" />
                            </div>
                        </div>
                    )}

                    {/* 拍摄成功确认态 */}
                    {faceStatus === "success" && successStep && (
                        <m.div
                            className="absolute inset-0 flex items-center justify-center z-20"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* 绿色圆环描边绘制动画：沿椭圆轨迹从 0 逐渐闭合到 100%（conic-gradient 环，与进度环同方案） */}
                            <div
                                className="scan-success-ring absolute inset-0 rounded-[50%] pointer-events-none"
                                style={{
                                    ...(prefersReducedMotion ? { "--scan-progress": "100%" } : {}),
                                    filter: "drop-shadow(0 0 8px rgba(16,185,129,0.45))",
                                } as React.CSSProperties}
                            />

                            {/* 中央成功提示 */}
                            <m.div
                                className="relative z-10 flex flex-col items-center gap-2"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: 0.3 }}
                            >
                                <div className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                                    <Check className="h-7 w-7 text-white" strokeWidth={3} />
                                </div>
                                <span className="text-white text-base font-medium drop-shadow-md">
                                    {successStep === "front" && "正脸拍摄完成"}
                                    {successStep === "left" && "左转拍摄完成"}
                                    {successStep === "right" && "右转拍摄完成"}
                                    {successStep === "chin" && "下颚拍摄完成"}
                                </span>
                            </m.div>
                        </m.div>
                    )}
                </div>

                {/* 扫描激光：元素高度等于扫描轨道（top 10% → 90%），仅顶部 2px 线条可见；
                    用 transform（y 百分比相对自身高度）替代 top 动画，只走合成层，避免每帧 layout。
                    仅在未找到脸/检测中播放：found 阶段让位给金色进度描边与倒计时，避免动效叠加 */}
                <AnimatePresence>
                    {currentStep === "front" && (faceStatus === "none" || faceStatus === "detecting") && !prefersReducedMotion && (
                        <m.div
                            className="absolute left-[8%] right-[8%] top-[10%] h-[80%] bg-[linear-gradient(to_right,transparent,#C9A86C,transparent)] bg-[length:100%_2px] bg-no-repeat [filter:drop-shadow(0_0_7px_rgba(234,179,8,0.5))]"
                            initial={{ y: "0%", opacity: 0 }}
                            animate={{ y: ["0%", "100%", "0%"], opacity: 1 }}
                            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                            exit={{ opacity: 0 }}
                        />
                    )}
                </AnimatePresence>

            </div>

            {/* 2. 顶部指引已移除，由父组件统一接管 */}


            {/* 3. 中心倒计时数字 (仅在Found且未Ready时显示；进度视觉已由椭圆框描边承担) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <AnimatePresence>
                    {faceStatus === "found" && stabilityProgress > 0 && stabilityProgress < 100 && (
                        <m.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.2, opacity: 0 }}
                            className="relative z-10"
                        >
                            <span className="font-mono text-4xl font-bold text-white tracking-tighter drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                                {Math.max(1, Math.ceil((100 - stabilityProgress) / 25))}
                            </span>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>

        </div>
    );
}
