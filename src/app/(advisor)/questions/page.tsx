"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_QUESTIONS, type Question } from "@/config/questions";
import { QuestionStep } from "@/components/advisor/QuestionStep";
import { ProgressBar } from "@/components/advisor/ProgressBar";
import { GenderSelection } from "@/components/advisor/GenderSelection";
import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, LogOut } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";

export default function QuestionsPage() {
    const router = useRouter();
    const [gender, setGender] = useState<"female" | "male" | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [direction, setDirection] = useState(0);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const { trackQuestionnaireStart, trackQuestionnaireComplete } = useAdvisorAnalytics();
    const hasTrackedStart = useRef(false);

    // 过滤问题逻辑
    const allQuestions = DEFAULT_QUESTIONS;
    const questions = allQuestions.filter(q => {
        // 1. 性别过滤
        if (gender === "male" && q.fieldName === "pregnancy") {
            return false;
        }

        // 2. 依赖过滤 (dependsOn)
        if (q.dependsOn) {
            const dependencyAnswer = answers[q.dependsOn.field];

            // 如果依赖的问题还没回答，暂不显示（等待回答后通过重渲染显示）
            if (!dependencyAnswer) return false;

            const { value, operator } = q.dependsOn;

            if (operator === 'notEquals') {
                return dependencyAnswer !== value;
            } else if (operator === 'contains') {
                return Array.isArray(dependencyAnswer) && dependencyAnswer.includes(value as string);
            } else {
                // Default equals (supports string or array of allowed strings)
                if (Array.isArray(value)) {
                    return value.includes(dependencyAnswer);
                }
                return dependencyAnswer === value;
            }
        }

        return true;
    });

    const currentQuestion = questions[currentStepIndex];

    // 4. 确保 stepIndex 有效
    useEffect(() => {
        if (questions.length > 0 && currentStepIndex >= questions.length) {
            setCurrentStepIndex(questions.length - 1);
        }
    }, [questions.length, currentStepIndex]);

    // 键盘支持
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !isNextDisabled()) {
                handleNext();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentStepIndex, answers, gender]); // 依赖项

    // 恢复之前的状态
    useEffect(() => {
        try {
            const savedAnswers = localStorage.getItem("advisor_answers");
            const savedGender = localStorage.getItem("advisor_gender");

            if (savedAnswers) {
                setAnswers(JSON.parse(savedAnswers));
            }
            if (savedGender === "female" || savedGender === "male") {
                setGender(savedGender);
            }
        } catch (e) { console.error(e); }
    }, []);

    const handleGenderSelect = (selectedGender: "female" | "male") => {
        setGender(selectedGender);
        localStorage.setItem("advisor_gender", selectedGender);
        // 追踪问卷开始（从选择性别开始算）
        if (!hasTrackedStart.current) {
            trackQuestionnaireStart();
            hasTrackedStart.current = true;
        }
    };

    const handleSelect = (value: string) => {
        if (!currentQuestion) return;

        const newAnswers = { ...answers };

        if (currentQuestion.type === "multiple") {
            const currentVal = (newAnswers[currentQuestion.fieldName] as string[]) || [];
            if (currentVal.includes(value)) {
                newAnswers[currentQuestion.fieldName] = currentVal.filter((v: string) => v !== value);
            } else {
                if (currentVal.length < 3) { // 最多选3个
                    newAnswers[currentQuestion.fieldName] = [...currentVal, value];
                }
            }
        } else {
            newAnswers[currentQuestion.fieldName] = value;
            // 单选自动跳转
            setTimeout(() => {
                if (currentStepIndex < questions.length - 1) {
                    handleNextWithDelay(newAnswers);
                } else {
                    // 如果单选且是最后一题，也自动完成
                    handleNextWithAnswers(newAnswers);
                }
            }, 300);
        }

        setAnswers(newAnswers);
    };

    const handleNextWithDelay = (currentAnswers: any) => {
        setDirection(1);
        setCurrentStepIndex(prev => prev + 1);
    };

    // 辅助函数：处理带特定答案的完成逻辑
    const handleNextWithAnswers = (currentAnswers: any) => {
        if (currentStepIndex < questions.length - 1) {
            setDirection(1);
            setCurrentStepIndex(prev => prev + 1);
        } else {
            // 完成，保存并跳转
            localStorage.setItem("advisor_answers", JSON.stringify(currentAnswers));
            trackQuestionnaireComplete(currentAnswers);
            router.push("/face-scan");
        }
    }

    const handleNext = () => { // 仅用于多选或最后一题手动点击
        // 验证
        if (!gender || !currentQuestion) return;

        const val = answers[currentQuestion.fieldName];
        if (!val || (Array.isArray(val) && val.length === 0)) {
            return;
        }

        handleNextWithAnswers(answers);
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setDirection(-1);
            setCurrentStepIndex(prev => prev - 1);
        } else {
            // 如果在第一题点击返回，回到性别选择
            setGender(null);
            localStorage.removeItem("advisor_gender");
        }
    };

    // 如果没有选择性别，显示性别选择组件
    if (!gender) {
        return (
            <AnimatePresence mode="wait">
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-4"
                >
                    <div className="w-full max-w-4xl">
                        <GenderSelection onSelect={handleGenderSelect} />
                    </div>

                    <button
                        onClick={() => router.push("/")}
                        className="fixed bottom-8 text-xs text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors tracking-widest uppercase font-medium"
                    >
                        CANCEL
                    </button>
                </m.div>
            </AnimatePresence>
        );
    }

    // 安全检查
    if (!currentQuestion) return null;

    const isNextDisabled = () => {
        if (!currentQuestion) return true;
        const val = answers[currentQuestion.fieldName];
        if (!val || (Array.isArray(val) && val.length === 0)) {
            return true;
        }
        return false;
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center relative overflow-x-hidden text-[#1A1A1A]">

            {/* Top Bar: Progress & Exit */}
            <div className="w-full max-w-5xl mx-auto px-6 py-8 flex items-center justify-between z-20 shrink-0">
                <div className="w-12 h-12 flex items-center justify-center">
                    <span className="text-xs font-bold tracking-widest opacity-20">0{currentStepIndex + 1}</span>
                </div>

                <div className="flex-1 max-w-xs mx-auto px-4 opacity-0 sm:opacity-100 transition-opacity">
                    <ProgressBar current={currentStepIndex + 1} total={questions.length} compact />
                </div>

                <button
                    onClick={() => setShowExitConfirm(true)}
                    className="group w-12 h-12 flex items-center justify-end text-[#1A1A1A]/20 hover:text-[#1A1A1A] transition-colors"
                >
                    <X className="h-6 w-6 transition-transform group-hover:rotate-90 duration-500" />
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full max-w-5xl mx-auto px-6 flex flex-col justify-center pb-8 z-10 min-h-0">
                <AnimatePresence mode="wait" custom={direction}>
                    <m.div
                        key={currentStepIndex}
                        custom={direction}
                        initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }} // Reduced movement for cleaner feel
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
                        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                        className="w-full"
                    >
                        <QuestionStep
                            question={currentQuestion}
                            selectedValue={answers[currentQuestion.fieldName] || null}
                            onSelect={handleSelect}
                            direction={direction}
                        />
                    </m.div>
                </AnimatePresence>
            </div>

            {/* Bottom Navigation */}
            <div className="w-full max-w-5xl mx-auto px-6 pb-12 flex justify-between items-center z-20 shrink-0 h-16">

                {/* Back Button */}
                <button
                    onClick={handleBack}
                    className={`group flex items-center gap-3 text-sm font-medium transition-all duration-300 ${currentStepIndex === 0 && !gender
                        ? "opacity-0 pointer-events-none"
                        : "text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                        }`}
                >
                    <div className="w-10 h-10 rounded-full border border-[#1A1A1A]/10 flex items-center justify-center group-hover:bg-[#1A1A1A] group-hover:border-[#1A1A1A] transition-all">
                        <ChevronLeft className="h-4 w-4 group-hover:text-white transition-colors" />
                    </div>
                    {/* <span className="hidden sm:inline-block tracking-wide">Back</span> */}
                </button>

                {/* Next Button (Only for multiple choice or explicit action) */}
                <div className="h-10 flex items-center">
                    {currentQuestion.type === "multiple" && (
                        <button
                            onClick={handleNext}
                            disabled={isNextDisabled()}
                            className="bg-[#1A1A1A] text-white px-8 py-2.5 rounded-full text-sm font-medium tracking-wide hover:bg-[#3D4430] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        >
                            Next Step
                        </button>
                    )}
                    {/* Fallback for last step is handled by auto-submit, but we can keep a manual button if stuck */}
                    {currentQuestion.type !== "multiple" && currentStepIndex === questions.length - 1 && !isNextDisabled() && (
                        <button
                            onClick={handleNext}
                            className="text-sm font-medium text-[#1A1A1A] border-b border-[#1A1A1A] pb-0.5 hover:opacity-50 transition-opacity"
                        >
                            Finish
                        </button>
                    )}
                </div>
            </div>

            {/* Simple Exit Modal */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#FDFBF7]/90 backdrop-blur-sm"
                            onClick={() => setShowExitConfirm(false)}
                        />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-sm bg-white p-8 shadow-2xl border border-[#1A1A1A]/5 text-center"
                        >
                            <h3 className="text-xl font-serif text-[#1A1A1A] mb-2">结束测试？</h3>
                            <p className="text-sm text-[#5E5E5E] mb-8 font-light">
                                当前进度将不会被保存。
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setShowExitConfirm(false)}
                                    className="w-full bg-[#1A1A1A] text-white py-3 text-sm font-medium hover:bg-[#3D4430] transition-colors"
                                >
                                    继续测试
                                </button>
                                <button
                                    onClick={() => router.push("/")}
                                    className="w-full py-2 text-xs text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors"
                                >
                                    确认退出
                                </button>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
