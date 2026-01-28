import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Check, Clock, Info, ArrowRight, Repeat, Droplets, Pause, Beaker, Volume2, Maximize2 } from 'lucide-react';
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
            <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center animate-in fade-in duration-700">
                <div className="relative z-10 flex flex-col items-center max-w-md w-full p-8 text-center">
                    <div className="w-24 h-24 mb-8 bg-black text-white rounded-full flex items-center justify-center shadow-2xl">
                        <Check className="w-10 h-10" strokeWidth={3} />
                    </div>

                    <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Routine Completed</h2>
                    <p className="text-gray-500 text-base mb-12 leading-relaxed">
                        坚持就是胜利，肌肤若光。
                    </p>

                    <button
                        onClick={onComplete}
                        className="w-full h-14 bg-black text-white rounded-full font-bold text-lg hover:opacity-90 transition-all shadow-xl"
                    >
                        完成打卡
                    </button>

                    <button
                        onClick={() => { setIsComplete(false); setCurrentStepIndex(0); }}
                        className="mt-6 text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Repeat size={14} /> 再次浏览
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex flex-col lg:flex-row h-[100dvh] w-screen overflow-hidden animate-in fade-in duration-300 font-sans text-gray-900 bg-[#F5F5F7]">

            {/* --- TOP BAR (Only Visible on Mobile) OR GLOBAL CLOSE --- */}
            <div className="absolute top-0 left-0 w-full z-50 p-6 flex justify-between items-center lg:hidden pointer-events-none">
                <button
                    onClick={onClose}
                    className="pointer-events-auto w-10 h-10 bg-white/80 backdrop-blur shadow-sm rounded-full flex items-center justify-center text-gray-600"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* --- LEFT COLUMN: STUDIO MEDIA (Light Gray Background) --- */}
            <div className="relative flex-1 bg-[#F0F1F3] h-[40vh] lg:h-full flex flex-col justify-center items-center p-6 lg:p-16">

                {/* Desktop Close Button (Floating Top Left) */}
                <button
                    onClick={onClose}
                    className="hidden lg:flex absolute top-8 left-8 z-50 w-12 h-12 bg-white hover:bg-gray-100 shadow-sm rounded-full items-center justify-center text-gray-900 transition-all active:scale-95"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Video Player Card */}
                <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl shadow-gray-200/50 ring-1 ring-black/5 group">
                    <Image
                        src="https://images.unsplash.com/photo-1556228578-8d8448ad114f?q=80&w=2070&auto=format&fit=crop"
                        alt="Tutorial Video"
                        className={cn(
                            "w-full h-full object-cover transition-transform duration-700",
                            isPlaying ? "scale-105 opacity-100" : "scale-100 opacity-90"
                        )}
                        width={1920}
                        height={1080}
                        priority
                    />

                    {/* Video Controls Overlay */}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-20 h-20 bg-white/20 backdrop-blur-md border border-white/40 rounded-full flex items-center justify-center text-white hover:scale-110 hover:bg-white/30 transition-all shadow-lg"
                        >
                            {isPlaying ? (
                                <Pause className="w-8 h-8 fill-white" />
                            ) : (
                                <Play className="w-8 h-8 fill-white ml-1" />
                            )}
                        </button>
                    </div>

                    {/* Bottom Bar inside Video */}
                    <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="flex items-center gap-4">
                            <button className="hover:text-gray-200"><Volume2 size={20} /></button>
                            <div className="text-xs font-medium font-mono">00:00 / 02:15</div>
                        </div>
                        <button className="hover:text-gray-200"><Maximize2 size={20} /></button>
                    </div>
                </div>

                {/* Caption / Context underneath */}
                <div className="mt-8 text-center lg:text-left w-full max-w-5xl flex items-center justify-between text-gray-400">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Immersive Mode
                    </div>
                    <span className="text-xs font-mono hidden lg:block">AI SKINCARE ADVISOR v2.0</span>
                </div>
            </div>

            {/* --- RIGHT COLUMN: INTERACTIVE PANEL (White) --- */}
            <div className="w-full lg:w-[480px] xl:w-[550px] bg-white h-auto lg:h-full flex flex-col shrink-0 relative z-20 shadow-xl border-l border-gray-100">

                {/* --- HEADER --- */}
                <div className="px-10 py-8 bg-white flex flex-col border-b border-dashed border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                            Step {currentStepIndex + 1} of {totalSteps}
                        </span>
                        <span className="px-2 py-1 rounded bg-gray-100 text-[10px] font-bold text-gray-500 uppercase">
                            {title}
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-500 ease-out rounded-full"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* --- SCROLLABLE CONTENT --- */}
                <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                    {/* Title Section */}
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 leading-tight mb-2">
                            {currentStep.name}
                        </h2>
                        {currentStep.nameEn && (
                            <p className="text-lg text-gray-400 font-medium">{currentStep.nameEn}</p>
                        )}
                    </div>

                    {/* Step Description */}
                    <div className="text-base text-gray-600 leading-7 font-medium">
                        {currentStep.description}
                    </div>

                    {/* Scientific Dosage Card */}
                    {currentStep.dosage && (
                        <div className="flex gap-4 p-5 rounded-2xl bg-blue-50 border border-blue-100/50 items-stretch">
                            <div className="w-1 bg-blue-500 rounded-full dark:bg-blue-400"></div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Beaker size={16} className="text-blue-600" strokeWidth={2.5} />
                                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Lab Format</span>
                                </div>
                                <div className="text-sm font-semibold text-gray-900">
                                    {currentStep.dosage.description}
                                </div>
                                <div className="text-xs text-blue-600/70 mt-1 leading-relaxed">
                                    {(currentStep.dosage as any)?.usageGuide || 'Apply evenly across target area.'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Instructions List */}
                    {currentStep.detailedInstructions && currentStep.detailedInstructions.length > 0 && (
                        <div className="space-y-6 pt-4 border-t border-gray-100">
                            {currentStep.detailedInstructions.map((instr, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold shadow-sm group-hover:bg-black group-hover:text-white group-hover:border-black transition-colors">
                                            {i + 1}
                                        </span>
                                        {/* Vertical line logic if needed, but clean gap is better for this look */}
                                    </div>
                                    <p className="text-sm text-gray-700 leading-7 mt-0.5 group-hover:text-gray-900 transition-colors">
                                        {instr}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* --- FOOTER CONTROLS --- */}
                <div className="p-8 bg-white border-t border-gray-100">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handlePrev}
                            disabled={currentStepIndex === 0}
                            className={cn(
                                "w-14 h-14 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50",
                                currentStepIndex === 0 && "opacity-40 cursor-not-allowed hover:bg-transparent"
                            )}
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <button
                            onClick={handleNext}
                            className="flex-1 h-14 bg-gray-900 text-white rounded-full font-bold text-lg hover:bg-black shadow-lg shadow-gray-200 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                        >
                            {currentStepIndex === totalSteps - 1 ? (
                                <>
                                    Complete Analysis <Check size={20} />
                                </>
                            ) : (
                                <>
                                    Next Step <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
