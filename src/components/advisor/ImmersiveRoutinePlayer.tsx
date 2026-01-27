
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Check, RotateCcw, Clock } from 'lucide-react';
import { RoutineStep } from '@/lib/routine-helpers';

interface ImmersiveRoutinePlayerProps {
    steps: RoutineStep[];
    title: string;
    onClose: () => void;
    onComplete: () => void;
}

export function ImmersiveRoutinePlayer({ steps, title, onClose, onComplete }: ImmersiveRoutinePlayerProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    // Timer Logic (optional per step?)
    // Let's just have a "Session Timer" or specific step timer. 
    // For MVP, let's keep it simple: manual navigation. 
    // Unless a step has a specific "Wait 5 mins" mentioned?
    // Let's look for "1分钟" or similar in duration string but keep it manual for now to be safe.

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

    const handleFinish = () => {
        onComplete();
    };

    if (isComplete) {
        return (
            <div className="fixed inset-0 z-[200] bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="bg-white/10 backdrop-blur-md rounded-full p-6 mb-6">
                    <Check className="w-16 h-16 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2 text-center">今日护肤任务完成！</h2>
                <p className="text-blue-100 text-center max-w-sm mb-10 leading-relaxed">
                    坚持就是胜利，你的皮肤会感谢你的每一份努力。
                </p>
                <button
                    onClick={handleFinish}
                    className="bg-white text-blue-600 px-10 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 transition-transform"
                >
                    完成打卡
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 bg-white/90 backdrop-blur-sm sticky top-0">
                <div className="w-10">
                    <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-gray-900">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <div className="w-10 text-right text-sm font-medium text-gray-400">
                    {currentStepIndex + 1}/{totalSteps}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-100 w-full">
                <div
                    className="h-full bg-blue-600 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 bg-[#FAFAFA]">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center text-center">

                    {/* Step Number Badge */}
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl mb-6 shadow-sm ring-4 ring-blue-50/50">
                        {currentStepIndex + 1}
                    </div>

                    {/* Step Title */}
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentStep.name}</h2>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6">{currentStep.nameEn || currentStep.category}</p>

                    {/* Description */}
                    <p className="text-base text-gray-600 leading-relaxed mb-6">
                        {currentStep.description}
                    </p>

                    {/* Dosage / Instruction Tag */}
                    {currentStep.dosage && (
                        <div className="inline-flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-100">
                            <span>💡 用量参考:</span>
                            <span className="text-blue-600">{currentStep.dosage.description}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="p-6 bg-white border-t border-gray-100 safe-area-pb">
                <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                    <button
                        onClick={handlePrev}
                        disabled={currentStepIndex === 0}
                        className={`p-4 rounded-full border border-gray-200 text-gray-600 transition-colors ${currentStepIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <div className="flex-1">
                        <button
                            onClick={handleNext}
                            className="w-full bg-gray-900 text-white h-14 rounded-full font-semibold text-lg hover:bg-black transition-colors shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                        >
                            {currentStepIndex === totalSteps - 1 ? (
                                <>
                                    <Check className="w-5 h-5" />
                                    完成护肤
                                </>
                            ) : (
                                <>
                                    下一步
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
