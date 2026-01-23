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
                    className="flex min-h-[80vh] flex-col justify-center px-4"
                >
                    <div className="flex-1 flex items-center">
                        <GenderSelection onSelect={handleGenderSelect} />
                    </div>
                    {/* 底部导航 - 返回首页 */}
                    <div className="mt-8 flex justify-center pb-6">
                        <button
                            onClick={() => router.push("/")}
                            className="text-sm text-brand-charcoal/40 hover:text-brand-charcoal"
                        >
                            返回首页
                        </button>
                    </div>
                </m.div>
            </AnimatePresence>
        );
    }

    // 安全检查：如果当前问题不存在（可能是因为过滤逻辑导致索引越界）
    if (!currentQuestion) {
        return null; // 或者显示加载状态
    }

    const isNextDisabled = () => {
        if (!currentQuestion) return true;
        const val = answers[currentQuestion.fieldName];
        if (!val || (Array.isArray(val) && val.length === 0)) {
            return true;
        }
        return false;
    };

    return (
        <div className="flex min-h-[80vh] flex-col justify-between px-4">
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between pt-4 mb-4">
                <button
                    onClick={() => setShowExitConfirm(true)}
                    className="p-2 -ml-2 text-brand-charcoal/40 hover:text-brand-charcoal transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
                <div className="text-xs font-medium tracking-widest text-brand-gold uppercase">NIHPLOD</div>
                <div className="w-5" /> {/* 占位以保持居中 */}
            </div>

            {/* 进度条 */}
            <div className="mb-8">
                <ProgressBar current={currentStepIndex + 1} total={questions.length} />
            </div>

            {/* 问题区域 */}
            <AnimatePresence mode="wait" custom={direction}>
                <m.div
                    key={currentStepIndex}
                    custom={direction}
                    initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1"
                >
                    <QuestionStep
                        question={currentQuestion}
                        selectedValue={answers[currentQuestion.fieldName] || null}
                        onSelect={handleSelect}
                        direction={direction}
                    />
                </m.div>
            </AnimatePresence>

            {/* 底部导航 */}
            <div className="mt-8 flex items-center justify-between pb-6">
                <button
                    onClick={handleBack}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-brand-charcoal/60 transition-colors hover:bg-black/5"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>

                {currentQuestion.type === "multiple" && (
                    <button
                        onClick={handleNext}
                        disabled={isNextDisabled()}
                        className="flex items-center gap-2 rounded-full bg-brand-charcoal px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50"
                    >
                        <span>{currentStepIndex === questions.length - 1 ? "完成" : "下一步"}</span>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                )}

                {/* 单选时如果是最后一页也需要显示按钮 (虽然会自动跳转，但作为 fallback) */}
                {currentQuestion.type !== "multiple" && currentStepIndex === questions.length - 1 && (
                    <button
                        onClick={handleNext}
                        disabled={isNextDisabled()}
                        className="flex items-center gap-2 rounded-full bg-brand-charcoal px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50"
                    >
                        <span>完成测试</span>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* 退出确认弹窗 */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
                        >
                            <div className="text-center">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                                    <LogOut className="h-6 w-6 text-red-500" />
                                </div>
                                <h3 className="mb-2 text-lg font-medium text-brand-charcoal">确定要退出吗？</h3>
                                <p className="mb-6 text-sm text-brand-charcoal/60">
                                    退出后，当前的测试进度将不会被保存。
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                                    >
                                        继续测试
                                    </button>
                                    <button
                                        onClick={() => router.push("/")}
                                        className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600"
                                    >
                                        确认退出
                                    </button>
                                </div>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
