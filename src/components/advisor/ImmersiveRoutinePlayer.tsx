import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Check, Clock, Info, ArrowRight, Repeat, Droplets, Pause } from 'lucide-react';
import Image from "next/image";
import { RoutineStep } from '@/lib/routine-helpers';
import { cn } from "@/lib/utils";

interface ImmersiveRoutinePlayerProps {
    steps: RoutineStep[];
    title: string;
    onClose: () => void;
    onComplete: () => void;
}

export function ImmersiveRoutinePlayer({ steps, title, onClose, onComplete }: ImmersiveRoutinePlayerProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Lock body scroll when player is open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalWidth = document.body.style.width;

        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.position = originalPosition;
            document.body.style.width = originalWidth;
        };
    }, []);

    // Reset playing state on step change
    useEffect(() => {
        setIsPlaying(false);
    }, [currentStepIndex]);

    const currentStep = steps[currentStepIndex];
    const totalSteps = steps.length;
    const progress = ((currentStepIndex + 1) / totalSteps) * 100;

    const handleNext = () => {
        if (currentStepIndex < totalSteps - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            setIsComplete(true);
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    if (isComplete) {
        return (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center animate-in fade-in duration-700">
                {/* Background Ambient */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-black to-black opacity-80" />

                <div className="relative z-10 flex flex-col items-center max-w-md w-full p-8 text-center">
                    <div className="w-24 h-24 mb-8 relative group cursor-pointer" onClick={onComplete}>
                        <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full" />
                        <div className="relative w-full h-full bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl ring-1 ring-white/10 group-hover:scale-105 transition-transform duration-300">
                            <Check className="w-10 h-10 text-white" strokeWidth={3} />
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">Routine Complete</h2>
                    <p className="text-gray-400 text-lg mb-12 leading-relaxed font-light">
                        今日护肤任务圆满完成。<br />坚持就是胜利，肌肤若光。
                    </p>

                    <button
                        onClick={onComplete}
                        className="w-full h-14 bg-white text-black rounded-full font-semibold text-lg hover:bg-gray-100 transform hover:-translate-y-1 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
                    >
                        完成打卡
                    </button>

                    <button
                        onClick={() => { setIsComplete(false); setCurrentStepIndex(0); }}
                        className="mt-6 text-gray-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Repeat size={14} /> 再次浏览
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col lg:flex-row h-[100dvh] w-screen overflow-hidden animate-in fade-in duration-300 font-sans text-gray-900">

            {/* --- LEFT COLUMN: IMMERSIVE MEDIA --- */}
            <div className="relative flex-1 bg-black h-[45vh] lg:h-full lg:min-w-[400px] lg:max-w-[calc(100vw-500px)] xl:max-w-[calc(100vw-600px)] flex flex-col justify-center items-center overflow-hidden group select-none">

                {/* Media Container */}
                <div className="relative w-full h-full">
                    <Image
                        src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=2070&auto=format&fit=crop"
                        alt="Tutorial Aesthetics"
                        className={cn(
                            "w-full h-full object-cover transition-transform duration-[2s] ease-out opacity-60",
                            isPlaying ? "scale-105" : "scale-100"
                        )}
                        width={1920}
                        height={1080}
                        priority
                    />

                    {/* Cinematic Gradients */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

                    {/* Centered Play Control */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="group/btn relative flex items-center justify-center w-20 h-20 lg:w-24 lg:h-24 transition-transform duration-300 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-full border border-white/20 group-hover/btn:bg-white/20 transition-colors" />
                            {isPlaying ? (
                                <Pause className="w-8 h-8 lg:w-10 lg:h-10 text-white relative z-10 fill-white" />
                            ) : (
                                <Play className="w-8 h-8 lg:w-10 lg:h-10 text-white relative z-10 fill-white ml-1" />
                            )}
                        </button>
                    </div>

                    {/* Bottom Info Overlay */}
                    <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between text-white">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className={cn(
                                    "px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border",
                                    "bg-white/10 border-white/20 backdrop-blur-sm text-white"
                                )}>
                                    {currentStep.category || 'Step'}
                                </span>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-white/80 bg-black/40 px-2.5 py-1 rounded-md backdrop-blur-sm">
                                    <Clock size={12} />
                                    <span>2 mins</span>
                                </div>
                            </div>
                            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-1 shadow-black drop-shadow-lg">
                                {currentStep.name}
                            </h2>
                            <p className="text-white/60 text-lg font-light tracking-wide">
                                {currentStep.nameEn || 'Skincare Routine'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Back Button (Mobile/Desktop) */}
                <button
                    onClick={onClose}
                    className="absolute top-6 left-6 z-50 p-2.5 bg-black/20 backdrop-blur-md text-white/70 hover:text-white hover:bg-white/10 rounded-full border border-white/10 transition-all hover:rotate-90 duration-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* --- RIGHT COLUMN: CONTENT & CONTROLS --- */}
            <div className="w-full lg:w-[500px] xl:w-[600px] bg-white h-auto lg:h-full flex flex-col shrink-0 relative z-20 shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.2)]">

                {/* Progress Header */}
                <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold mb-1">
                            {title}
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">{currentStepIndex + 1}</span>
                            <span className="text-base text-gray-400 font-medium">/ {totalSteps}</span>
                        </div>
                    </div>
                    {/* Progress Bar Mini */}
                    <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-black transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                    {/* Dosage Card - Refined */}
                    {currentStep.dosage && (
                        <div className="group relative overflow-hidden rounded-2xl bg-[#F8F9FA] border border-gray-100 p-6 transition-all hover:shadow-md hover:border-gray-200">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Droplets className="w-24 h-24 rotate-12" />
                            </div>

                            <div className="flex items-start gap-5 relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center shrink-0 text-blue-600">
                                    <Droplets size={24} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                                        推荐用量
                                        <span className="text-[10px] font-normal text-gray-400 px-1.5 py-0.5 rounded-full bg-gray-100 border border-gray-200">Laboratory Suggested</span>
                                    </h4>
                                    <p className="text-lg text-gray-800 font-medium">
                                        {currentStep.dosage.description}
                                    </p>
                                    {(currentStep.dosage as any)?.usageGuide && (
                                        <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 bg-white/50 p-2 rounded-lg border border-gray-100/50">
                                            <Info size={14} className="mt-0.5 text-blue-500 shrink-0" />
                                            <span className="leading-relaxed">{(currentStep.dosage as any).usageGuide}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description - Editorial Style */}
                    <div className="space-y-4">
                        <p className="text-xl text-gray-600 leading-relaxed font-serif italic">
                            "{currentStep.description}"
                        </p>
                    </div>

                    {/* Step-by-Step Instructions - Timeline */}
                    {currentStep.detailedInstructions && currentStep.detailedInstructions.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <span className="w-8 h-[1px] bg-gray-200"></span>
                                Steps
                            </h4>
                            <div className="relative pl-2 space-y-8">
                                {/* Connecting Line */}
                                <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-gray-100" />

                                {currentStep.detailedInstructions.map((instr, i) => (
                                    <div key={i} className="relative flex gap-6 items-start group">
                                        {/* Timeline Dot */}
                                        <div className="relative z-10 w-10 h-10 rounded-full border-2 border-white bg-gray-50 text-gray-400 text-sm font-bold flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 group-hover:bg-black group-hover:text-white group-hover:scale-110">
                                            {i + 1}
                                        </div>

                                        {/* Text */}
                                        <div className="pt-1.5 flex-1 p-3 -mt-2.5 rounded-xl transition-colors hover:bg-gray-50">
                                            <p className="text-base text-gray-700 leading-7 font-medium">
                                                {instr}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls - Floating Feel */}
                <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handlePrev}
                            disabled={currentStepIndex === 0}
                            className={cn(
                                "w-14 h-14 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-all",
                                currentStepIndex === 0
                                    ? "opacity-30 cursor-not-allowed"
                                    : "hover:bg-gray-50 hover:border-black hover:text-black active:scale-95"
                            )}
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <button
                            onClick={handleNext}
                            className="flex-1 h-14 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-900 shadow-lg shadow-gray-200 hover:shadow-xl hover:shadow-gray-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group overflow-hidden relative"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {currentStepIndex === totalSteps - 1 ? (
                                    <>Finish Routine <Check className="w-5 h-5" /></>
                                ) : (
                                    <>Next Step <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
