"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion as m } from "framer-motion";
import { Activity, AlertCircle, AlertTriangle, Lightbulb, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { DIMENSION_LABELS, DIMENSION_DESCRIPTIONS, DIMENSION_ORDER } from "@/lib/advisor-utils";
import { computeLabAnalysis, type LabMetric } from "@/lib/analysis-lab";
import { cn } from "@/lib/utils";

// recharts 体积较大且仅桌面端 Lab 弹窗使用，改为客户端懒加载，不打入结果页首屏包
const ScientificBarChart = dynamic(() => import("@/components/advisor/ScientificBarChart").then((mod) => mod.ScientificBarChart), { ssr: false });

// 手机端：十维分析表单（替代 ScientificBarChart）
function MobileDimensionForm({ dimensions }: { dimensions: Record<string, { score?: number } | undefined> }) {
    const order = DIMENSION_ORDER;

    return (
        <div className="sm:hidden mb-5">
            {order.map((key) => {
                const item = dimensions[key];
                const score = item?.score;
                const color = score === undefined ? '' : score >= 80 ? 'bg-[var(--color-brand-cocoa)]' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
                return (
                    <div key={key} className="py-3 border-b border-[#E8E2D9] last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] text-[#4A4A4A]">{DIMENSION_LABELS[key]}</span>
                            <span className="text-[13px] font-medium text-[#1A1A1A]">{score === undefined ? '-' : `${score} 分`}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#E8E2D9] overflow-hidden">
                            {score !== undefined && (
                                <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                            )}
                        </div>
                        <p className="mt-1.5 text-sm text-[#8A8A8A] leading-relaxed">{DIMENSION_DESCRIPTIONS[key]}</p>
                    </div>
                );
            })}
        </div>
    );
}

// 手机端 Lab 指标卡片
function MobileLabRow({ metric }: { metric: LabMetric }) {
    const goodKeywords = ['正常', 'Normal', '紧致', '细腻', '均匀', '透亮', 'Type I', '少', 'Balanced'];
    const isGood = goodKeywords.some(k => metric.status.includes(k));

    return (
        <div className="mb-3 rounded-xl border border-[#E8E2D9] bg-white/50 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[13px] font-medium text-[var(--color-brand-espresso)] leading-tight">{metric.param}</span>
                {metric.status && (
                    <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isGood ? "bg-[var(--color-brand-cocoa)]/10 text-[var(--color-brand-cocoa)]" : "bg-red-100 text-red-700"
                    )}>
                        {metric.status}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-[11px] text-[#8A8A8A] mb-0.5">测定值</p>
                    <p className="text-[12px] text-[#1A1A1A]">{metric.value}</p>
                </div>
                <div>
                    <p className="text-[11px] text-[#8A8A8A] mb-0.5">参考范围</p>
                    <p className="text-[12px] text-[#1A1A1A]">{metric.ref}</p>
                </div>
            </div>
        </div>
    );
}

// Lab Report 行渲染（抽离到组件外部，避免每次渲染重新创建）
function renderLabRow(param: string, value: string, ref: string, status: string) {
    // Determine status color based on keywords
    const goodKeywords = ['正常', 'Normal', '紧致', '细腻', '均匀', '透亮', 'Type I', '少', 'Balanced'];
    const isGood = goodKeywords.some(k => status.includes(k));

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-2 px-4 border-b border-[#E8E2D9] last:border-0 items-center hover:bg-white/60 transition-colors">
            <div className="sm:col-span-5 text-[12px] text-[#4A4A4A] font-light tracking-tight">
                {param}
            </div>
            <div className="sm:col-span-3 text-left sm:text-right text-[12px] text-[#1A1A1A] font-normal">
                {value}
            </div>
            <div className="sm:col-span-2 text-left sm:text-right text-[12px] text-[#8A8A8A] font-light">
                <span className="sm:hidden mr-2 text-[#8A8A8A]">Ref:</span>
                {ref}
            </div>
            <div className="sm:col-span-2 text-left sm:text-right text-[11px] font-light">
                {status ? (
                    <span className={isGood ? 'text-[#4A4A4A]' : 'text-[#c45a4a]'}>
                        {status} {isGood ? '' : '▲'}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

/* ------------------------- 性别不一致提示弹窗 ------------------------- */

interface GenderMismatchModalProps {
    faceAnalysis: FaceAnalysisResult | null;
    socialGender: string;
    hasUsedFreeRetry: boolean;
    onRetry: () => void;
    onContinue: () => void;
}

export function GenderMismatchModal({
    faceAnalysis,
    socialGender,
    hasUsedFreeRetry,
    onRetry,
    onContinue,
}: GenderMismatchModalProps) {
    const retryButtonRef = useRef<HTMLButtonElement>(null);
    const modalRef = useFocusTrap<HTMLDivElement>(true);

    // Auto-focus primary button when modal opens
    useEffect(() => {
        // Small delay to wait for animation
        const timer = setTimeout(() => retryButtonRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-brand-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <m.div
                ref={modalRef}
                initial={{ scale: 0.95, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="bg-[#FDFBF7] rounded-2xl shadow-sm w-full max-w-[420px] overflow-hidden border border-brand-charcoal/10"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gender-mismatch-title"
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.stopPropagation();
                        onContinue();
                    }
                }}
            >
                <div className="p-7 md:p-8">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-brand-charcoal/[0.08] flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-brand-charcoal" strokeWidth={1.5} />
                        </div>
                        <h3
                            id="gender-mismatch-title"
                            className="text-[17px] font-light text-brand-charcoal tracking-[0.02em]"
                        >
                            测前信息准确性提示
                        </h3>
                    </div>

                    <div className="space-y-5">
                        <p className="text-[14px] text-brand-charcoal/60 font-light leading-[1.8] text-left px-1">
                            AI 面部识别结果显示您的面部特征更接近
                            <span className="font-light bg-brand-charcoal/[0.08] px-1.5 py-0.5 rounded text-brand-charcoal mx-1">
                                {faceAnalysis?.gender?.value === 'male' ? '男性' : '女性'}
                            </span>
                            ，但您在问卷中选择的是
                            <span className="font-light bg-brand-charcoal/[0.08] px-1.5 py-0.5 rounded text-brand-charcoal mx-1">
                                {socialGender === 'male' ? '男性' : '女性'}
                            </span>
                            ，二者不一致。
                        </p>

                        {/* Callout Block */}
                        <div className="bg-brand-charcoal/[0.04] p-4 rounded-lg flex items-start gap-3">
                            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-brand-charcoal/70" strokeWidth={1.5} />
                            <div className="space-y-2 text-[13px] text-brand-charcoal/60 font-light leading-[1.8]">
                                <p>这可能会影响为您匹配<span className="font-light text-brand-charcoal">“针对性护肤方案”</span>的精准度，导致分析结论与您的实际肤感产生偏差。</p>
                                {hasUsedFreeRetry ? (
                                    <p>该会话已使用过免费重试，重新填写将正常消耗测试次数。</p>
                                ) : (
                                    <p>建议核实信息以获得更准确的建议。若是填写有误？<span className="font-light text-brand-charcoal">本次重新填写不消耗测试次数</span>。</p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                ref={retryButtonRef}
                                onClick={hasUsedFreeRetry ? onContinue : onRetry}
                                className="w-full h-11 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[14px] font-light hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                            >
                                <RotateCcw size={14} strokeWidth={2} />
                                <span>{hasUsedFreeRetry ? "我已了解" : "重新填写问卷"}</span>
                            </button>

                            <button
                                onClick={onContinue}
                                className="w-full h-11 bg-transparent text-brand-charcoal/60 text-[14px] font-light hover:bg-brand-charcoal/[0.06] hover:text-brand-charcoal transition-all flex items-center justify-center gap-2"
                            >
                                <span>信息无误，继续查看</span>
                            </button>
                        </div>
                    </div>
                </div>
            </m.div>
        </m.div>
    );
}

/* ------------------------- 定制化分析数据详情弹窗 ------------------------- */

interface LabDataModalProps {
    open: boolean;
    onClose: () => void;
    faceAnalysis: FaceAnalysisResult | null;
}

export function LabDataModal({ open, onClose, faceAnalysis }: LabDataModalProps) {
    const labModalRef = useFocusTrap<HTMLDivElement>(open);

    return (
        <AnimatePresence>
            {open && (
                <m.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <m.div
                        className="absolute inset-0 bg-[var(--color-brand-espresso)]/25 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <m.div
                        ref={labModalRef}
                        className="relative z-10 w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[var(--color-brand-espresso)]/10 shadow-2xl flex flex-col bg-[var(--color-brand-cream)]"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="定制化专业分析数据详情"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                e.stopPropagation();
                                onClose();
                            }
                        }}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-20 text-[var(--color-brand-taupe)]/60 hover:text-[var(--color-brand-cocoa)] transition-colors bg-transparent border-none cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <Activity className="w-5 h-5 text-[var(--color-brand-taupe)]" />
                                <h3 className="text-lg font-bold text-[var(--color-brand-espresso)]">定制化专业分析数据详情</h3>
                            </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar px-6 sm:px-8 py-5 sm:py-6 flex-1">
                            <div className="grid grid-cols-1 gap-y-0">

                                {/* 十维分析：PC 用条形图，手机端用表单 */}
                                {faceAnalysis?.dimensions && (
                                    <>
                                        <div className="hidden sm:block mb-2">
                                            <ScientificBarChart
                                                dimensions={faceAnalysis.dimensions}
                                            />
                                        </div>
                                        <MobileDimensionForm dimensions={faceAnalysis.dimensions} />
                                    </>
                                )}

                                {/* Table Header Row (Desktop only) */}
                                <div className="hidden sm:grid grid-cols-12 text-[11px] font-semibold text-[#1B3A5C] border-b border-[#D9D0C3] py-2 px-4 tracking-wider">
                                    <div className="col-span-5">检测指标 (Parameter)</div>
                                    <div className="col-span-3 text-right">测定值 (Value)*</div>
                                    <div className="col-span-2 text-right">参考范围 (Range)</div>
                                    <div className="col-span-2 text-right">状态 (Status)</div>
                                </div>

                                {computeLabAnalysis(faceAnalysis).flatMap((group) => (
                                    <div key={group.title}>
                                        <div className="hidden sm:block">
                                            {group.metrics.map((metric) => (
                                                <div key={metric.param}>
                                                    {renderLabRow(metric.param, metric.value, metric.ref, metric.status)}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="sm:hidden">
                                            {group.metrics.map((metric) => (
                                                <MobileLabRow key={metric.param} metric={metric} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-5 pt-3 border-t border-dashed border-[var(--color-brand-espresso)]/15">
                                <div className="flex gap-2.5 items-start text-xs leading-relaxed text-[var(--color-brand-cocoa)]">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C9A86C]" />
                                    <div className="space-y-1.5">
                                        <p className="font-medium text-[var(--color-brand-espresso)]">数据说明 (Data Disclaimer)</p>
                                        <p>
                                            <span className="font-semibold text-[var(--color-brand-espresso)]">* AI ESTIMATE:</span> 上述数值均由 AI 算法基于您的面部图像特征（纹理、色泽、对比度）反演推算得出，<span className="border-b border-[var(--color-brand-espresso)]/20 text-[var(--color-brand-espresso)]">并非物理探头实测数据</span>。
                                        </p>
                                        <p>
                                            例如：皱纹严重度分级（Wrinkle Severity）是根据面部纹理与阴影的视觉表现估算而来。本报告仅作护肤参考，不可替代医疗诊断。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}

/* ------------------------- 微信内嵌浏览器海报长按保存弹窗 ------------------------- */

interface PosterSaveModalProps {
    /** 海报图片 URL（objectURL）；null 时不渲染 */
    imageUrl: string | null;
    onClose: () => void;
}

export function PosterSaveModal({ imageUrl, onClose }: PosterSaveModalProps) {
    const modalRef = useFocusTrap<HTMLDivElement>(imageUrl !== null);

    return (
        <AnimatePresence>
            {imageUrl && (
                <m.div
                    className="fixed inset-0 z-[99998] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <m.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <m.div
                        ref={modalRef}
                        initial={{ scale: 0.95, opacity: 0, y: 12 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 12 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-5 text-center shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="保存测肤证书"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                e.stopPropagation();
                                onClose();
                            }
                        }}
                    >
                        <p className="text-[15px] font-medium text-[var(--color-brand-espresso)] mb-1">长按图片保存证书</p>
                        <p className="text-[12px] text-[var(--color-brand-taupe)] mb-4">
                            微信内长按下方图片，选择「保存图片」即可存入相册
                        </p>
                        <div className="mx-auto w-full max-w-[300px] rounded-xl overflow-hidden border border-black/5 bg-[var(--color-brand-cream)]">
                            <Image
                                src={imageUrl}
                                alt="肌智派证书海报"
                                width={480}
                                height={640}
                                unoptimized
                                className="w-full h-auto"
                            />
                        </div>
                        <button
                            onClick={onClose}
                            className="mt-4 inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full border border-[var(--color-brand-cocoa)]/30 text-[var(--color-brand-cocoa)] text-[13px] tracking-[0.1em] font-medium hover:bg-[var(--color-brand-cocoa)]/5 transition-colors"
                        >
                            已保存，关闭
                        </button>
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}
