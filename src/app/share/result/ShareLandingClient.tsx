"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { ScanFace, ArrowRight, Lock, Activity, Sparkles, ShieldCheck } from "lucide-react";
// import { Button } from "@/components/ui/button"; // Removed to fix import error
import { ScientificRadarChart } from "@/components/advisor/ScientificRadarChart";

interface ShareLandingProps {
    data: {
        score: number;
        skinType: string;
        skinAge: number;
        dimensions: any; // Minimal dimension scores for chart
        publishDate: string;
    }
}

export default function ShareLandingClient({ data }: ShareLandingProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-gray-900 pb-24">
            {/* Minimal Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-center relative">
                    <div className="font-bold text-lg tracking-tight flex items-center gap-2">
                        <span className="text-xl">✨</span> MySkin.Today
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 pt-8">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    {/* 1. Hero / Score Card */}
                    <motion.div variants={itemVariants} className="text-center space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-xs font-medium text-gray-600">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            专业 AI 肤质检测报告
                        </div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                            您的好友收到了一份<br />实验室级肤质报告
                        </h1>
                    </motion.div>

                    {/* Score Circle */}
                    <motion.div variants={itemVariants} className="relative py-6 flex justify-center">
                        <div className="w-40 h-40 rounded-full border-4 border-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] bg-gradient-to-b from-white to-gray-50 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50/50 to-transparent pointer-events-none" />
                            <span className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-1">Skin Score</span>
                            <span className={`text-5xl font-bold font-mono tracking-tighter ${data.score >= 80 ? 'text-emerald-600' : data.score >= 60 ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                {data.score}
                            </span>
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100/50 text-emerald-700 text-[10px] font-bold">
                                <Sparkles className="w-3 h-3" />
                                超越 90% 用户
                            </div>
                        </div>

                        {/* Decorative background elements */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -z-10" />
                    </motion.div>

                    {/* Key Stats Grid */}
                    <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1">
                            <span className="text-xs text-gray-400 uppercase">肤质类型</span>
                            <span className="font-semibold text-lg text-gray-900">{data.skinType}</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1">
                            <span className="text-xs text-gray-400 uppercase">肌龄检测</span>
                            <span className="font-semibold text-lg text-gray-900">{data.skinAge} <span className="text-xs font-normal text-gray-400">岁</span></span>
                        </div>
                    </motion.div>

                    {/* Radar Chart (Simplified/Non-interactive) */}
                    <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="text-center mb-4">
                            <h3 className="font-semibold text-gray-900">十二维肤质图谱</h3>
                        </div>
                        <div className="h-[250px] pointer-events-none opacity-90 scale-95">
                            <ScientificRadarChart
                                dimensions={data.dimensions}
                                activeDimension={null} // No highlight
                                onDimensionSelect={() => { }}
                            />
                        </div>

                        {/* "Unlock" Overlay Hint */}
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-6">
                            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Analysis Visualization</span>
                        </div>
                    </motion.div>

                    {/* Blurred/Locked Content Teaser */}
                    <motion.div variants={itemVariants} className="relative group">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 rounded-3xl flex flex-col items-center justify-center text-center p-6 border border-white/50">
                            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center mb-3 shadow-xl">
                                <Lock className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">查看完整深度报告</h3>
                            <p className="text-sm text-gray-600 mb-4 max-w-[200px]">
                                解锁包含痘痘、皱纹、黑眼圈在内的 12 项详细实验室数据
                            </p>
                        </div>

                        {/* Fake Content Behind Blur */}
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4 filter blur-sm select-none opacity-50">
                            <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                            <div className="h-24 bg-gray-50 rounded-xl"></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-16 bg-gray-100 rounded-xl"></div>
                                <div className="h-16 bg-gray-100 rounded-xl"></div>
                            </div>
                        </div>
                    </motion.div>

                </motion.div>
            </main>

            {/* Bottom CTA */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-8 z-50 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">
                <div className="max-w-md mx-auto flex flex-col gap-3">
                    <button
                        onClick={() => router.push('/questions')}
                        className="w-full h-14 rounded-full text-lg font-semibold bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <ScanFace className="w-5 h-5" />
                        立即免费测肤
                        <ArrowRight className="w-5 h-5 opacity-60" />
                    </button>
                    <p className="text-center text-[10px] text-gray-400">
                        * 已有 10,000+ 用户生成了专业报告
                    </p>
                </div>
            </div>
        </div>
    );
}

// Simple Button Component inline if shadcn is not available (To be safe)
// Or I'll just use simple HTML button with standard tailwind classes in the JSX above if I'm not sure about 'components/ui/button' existence.
// I will check for components/ui/button existence first or just implement standard button handling to avoid errors.
