"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { preprocessFaceImage } from "@/lib/image-processing";

/** 加载提示文案 */
const LOADING_TIPS = [
    { icon: "🔬", text: "正在解读您的肌肤密码..." },
    { icon: "💧", text: "评估肌肤水润状态..." },
    { icon: "✨", text: "分析肤色光泽度..." },
    { icon: "🎯", text: "识别需要关注的区域..." },
    { icon: "📊", text: "综合多维度数据..." },
    { icon: "💡", text: "定制您的专属方案..." },
];

/** 品牌小知识 */
const BRAND_FACTS = [
    "真脂质体技术 — 源自摩纳哥的高端护肤科技",
    "NIHPLOD 旎柏 — 让每一寸肌肤都被温柔以待",
    "多肽精萃配方 — 唤醒肌肤自我修护能量",
    "植物精华与科技的完美融合",
    "专注于为您打造专属护肤仪式",
];

type FailureType = "face" | "questionnaire" | null;

export default function AnalyzingPage() {
    const router = useRouter();
    const [progress, setProgress] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);
    const [factIndex, setFactIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [failureType, setFailureType] = useState<FailureType>(null);
    const { trackAnalysisStart, trackAnalysisComplete } = useAdvisorAnalytics();

    // 防止重复执行
    const hasStarted = useRef(false);

    const runAnalysis = useCallback(async () => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        trackAnalysisStart();

        try {
            // 简单的预加载等待，给用户一点反应时间
            await new Promise(r => setTimeout(r, 800));

            const answersStr = localStorage.getItem("advisor_answers");

            if (!answersStr) {
                console.warn("No answers found, redirecting");
                router.push("/questions");
                return;
            }

            // 预处理图片（如果存在）
            const imagesStr = localStorage.getItem("advisor_face_images");
            if (imagesStr) {
                try {
                    const images = JSON.parse(imagesStr);
                    if (images.front && !images.front.startsWith('http')) {
                        // 在这里做一个快速的预处理检查，确保数据准备好
                        // 但不阻塞跳转，把繁重的任务交给 Result 页面
                        // 只做最基本的验证
                    }
                } catch (e) { console.error(e); }
            }

            // 直接跳转到结果页，开启异步流式加载模式
            // 使用 replace 而不是 push，这样用户按返回键不会回到 loading 页
            router.replace(`/result?status=analyzing`);

        } catch (err) {
            console.error("Analysis Prep Error:", err);
            setError("准备分析数据时出错");
        }
    }, [router]);

    // 启动分析
    useEffect(() => {
        runAnalysis();
    }, [runAnalysis]);

    // 模拟进度条增加
    useEffect(() => {
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return prev;
                return prev + (Math.random() * 2);
            });
        }, 300);
        return () => clearInterval(timer);
    }, []);

    // 切换提示文案
    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    // 切换品牌知识
    useEffect(() => {
        const interval = setInterval(() => {
            setFactIndex((prev) => (prev + 1) % BRAND_FACTS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const [queueInfo, setQueueInfo] = useState<{ position: number; waitTime: number } | null>(null);

    // 查询队列状态
    useEffect(() => {
        const checkQueue = async () => {
            try {
                const res = await fetch("/api/advisor/queue-status");
                if (res.ok) {
                    const data = await res.json();
                    if (data.inQueue && data.position > 1) {
                        setQueueInfo({ position: data.position, waitTime: data.estimatedWaitSeconds });
                    }
                }
            } catch (e) {
                console.error("Queue check failed", e);
            }
        };

        // 初始检查
        checkQueue();
    }, []);

    const currentTip = LOADING_TIPS[tipIndex];
    const currentFact = BRAND_FACTS[factIndex];

    // 错误状态 UI
    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-brand-cream">
                <m.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-xs text-center sm:max-w-sm"
                >
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-orange-50 sm:mb-6 sm:h-20 sm:w-20">
                        <AlertCircle className="h-8 w-8 text-red-400 sm:h-10 sm:w-10" />
                    </div>

                    <h2 className="mb-3 text-lg font-medium text-brand-charcoal sm:mb-4 sm:text-xl">
                        分析中断
                    </h2>

                    <div className="mb-6 rounded-2xl bg-white/50 p-4 sm:mb-8 sm:p-6 border border-brand-beige/20">
                        <p className="text-sm leading-relaxed text-brand-charcoal/80 sm:text-base">
                            {error}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                setError(null);
                                setFailureType(null);
                                hasStarted.current = false;
                                setProgress(0);
                                runAnalysis();
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-gold px-6 py-3 text-white transition-colors hover:bg-brand-gold/90"
                        >
                            <RefreshCw className="h-4 w-4" />
                            重试分析
                        </button>
                        <button
                            onClick={() => router.push("/questions")}
                            className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-gold/30 bg-white px-6 py-3 text-brand-charcoal transition-colors hover:bg-brand-beige/30"
                        >
                            <FileText className="h-4 w-4" />
                            重新填写问卷
                        </button>
                    </div>
                </m.div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-cream px-4">
            {/* 背景装饰 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-brand-gold/10 blur-3xl" />
                <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-brand-gold/5 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-xs text-center sm:max-w-sm">
                {/* 旋转动画 */}
                <div className="relative mx-auto mb-8 h-24 w-24 sm:mb-10 sm:h-28 sm:w-28">
                    {/* 外圈 */}
                    <m.div
                        className="absolute inset-0 rounded-full border-2 border-brand-gold/40"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    />
                    {/* 内圈 */}
                    <m.div
                        className="absolute inset-3 rounded-full border border-dashed border-brand-gold/30"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    />
                    {/* 中心图标 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <m.div
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-champagne/30 backdrop-blur-sm sm:h-14 sm:w-14"
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Sparkles className="h-6 w-6 text-brand-gold sm:h-7 sm:w-7" />
                        </m.div>
                    </div>
                </div>

                {/* 动态提示文案 */}
                <div className="mb-6 h-8 sm:mb-8">
                    <AnimatePresence mode="wait">
                        <m.div
                            key={tipIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4 }}
                            className="flex items-center justify-center gap-2 text-sm font-light tracking-wide text-brand-charcoal sm:gap-2.5"
                        >
                            <span className="text-lg sm:text-xl">{currentTip.icon}</span>
                            <span>{currentTip.text}</span>
                        </m.div>
                    </AnimatePresence>
                </div>

                {/* 进度条 */}
                <div className="mb-8 sm:mb-10">
                    <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-brand-beige/50">
                        <m.div
                            className="h-full rounded-full bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 0.3 }}
                        />
                        {/* 光泽效果 */}
                        <m.div
                            className="absolute inset-0 bg-white/30"
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            style={{ width: "50%" }}
                        />
                    </div>
                    <span className="text-sm font-light tracking-wider text-brand-charcoal/50">
                        {Math.round(Math.min(progress, 100))}%
                    </span>
                </div>

                {/* 排队信息 */}
                <AnimatePresence>
                    {queueInfo && (
                        <m.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 overflow-hidden text-center"
                        >
                            <p className="text-xs text-brand-charcoal/60">
                                当前访问人数较多，正在排队中
                            </p>
                            <p className="text-sm font-medium text-brand-gold">
                                前方还有 {queueInfo.position - 1} 人，预计等待 {queueInfo.waitTime} 秒
                            </p>
                        </m.div>
                    )}
                </AnimatePresence>

                {/* 品牌小知识 */}
                <div className="rounded-2xl border border-brand-beige/40 bg-white/60 p-4 shadow-sm backdrop-blur-sm sm:p-5">
                    <div className="mb-2 flex items-center justify-center gap-1.5 text-xs tracking-wider text-brand-gold/70">
                        <span>✨</span>
                        <span>旎柏品牌</span>
                    </div>
                    <AnimatePresence mode="wait">
                        <m.p
                            key={factIndex}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.5 }}
                            className="text-sm font-light leading-relaxed tracking-wide text-brand-charcoal/70"
                        >
                            {currentFact}
                        </m.p>
                    </AnimatePresence>
                </div>
            </div>
        </div >
    );
}
