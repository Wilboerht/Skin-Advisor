"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_QUESTIONS, type Question } from "@/config/questions";
import { QuestionStep } from "@/components/advisor/QuestionStep";
import { ProgressBar } from "@/components/advisor/ProgressBar";
import { GenderSelection } from "@/components/advisor/GenderSelection";
import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, LogOut, ArrowRight, AlertTriangle, ShieldCheck, History } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { cn } from "@/lib/utils";

export default function QuestionsPage() {
    const router = useRouter();
    const [gender, setGender] = useState<"female" | "male" | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [committedAnswers, setCommittedAnswers] = useState<Record<string, any>>({});
    const [direction, setDirection] = useState(0);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [hasSavedProgress, setHasSavedProgress] = useState(false);
    const { trackQuestionnaireStart, trackQuestionnaireComplete } = useAdvisorAnalytics();
    const hasTrackedStart = useRef(false);
    const hasCheckedResume = useRef(false);

    // 追踪答题质量
    const sessionStartTime = useRef(Date.now());
    const startStepIndex = useRef(0);
    const [showQualityWarning, setShowQualityWarning] = useState(false);
    const [pendingAnswers, setPendingAnswers] = useState<Record<string, any> | null>(null);

    // 从 API 获取问题列表（数据库优先，静态降级）
    const [allQuestions, setAllQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
    const hasFetchedQuestions = useRef(false);

    useEffect(() => {
        if (hasFetchedQuestions.current) return;
        hasFetchedQuestions.current = true;

        const fetchQuestions = async () => {
            try {
                const res = await fetch("/api/advisor/questions");
                if (res.ok) {
                    const data: Question[] = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setAllQuestions(data);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch questions from API, using defaults:", e);
            }
        };
        fetchQuestions();
    }, []);
    const getFilteredQuestions = (currentAnswers: Record<string, any>, currentGender: typeof gender) => {
        return allQuestions.filter(q => {
            if (currentGender === "male" && q.fieldName === "pregnancy") return false;

            if (q.dependsOn) {
                const dependencyAnswer = currentAnswers[q.dependsOn.field];
                if (!dependencyAnswer) return false;

                const { value, operator } = q.dependsOn;

                if (operator === 'notEquals') {
                    return dependencyAnswer !== value;
                } else if (operator === 'contains') {
                    return Array.isArray(dependencyAnswer) && dependencyAnswer.includes(value as string);
                } else {
                    if (Array.isArray(value)) {
                        return value.includes(dependencyAnswer);
                    }
                    return dependencyAnswer === value;
                }
            }
            return true;
        });
    };

    const questions = getFilteredQuestions(committedAnswers, gender);
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

    // 检测是否有保存的进度
    useEffect(() => {
        if (hasCheckedResume.current) return;
        hasCheckedResume.current = true;

        try {
            const savedAnswers = localStorage.getItem("advisor_answers");
            const savedGender = localStorage.getItem("advisor_gender");
            const savedStep = localStorage.getItem("advisor_step");

            // 检查是否有有效的保存进度（至少有性别或已回答的问题）
            const hasProgress = savedGender || (savedAnswers && Object.keys(JSON.parse(savedAnswers)).length > 0);

            if (hasProgress && savedStep) {
                // 有未完成的测试，显示选择弹窗
                setHasSavedProgress(true);
                setShowResumeModal(true);
            }
        } catch (e) { console.error(e); }
    }, []);

    // 恢复之前的状态（用户选择继续时调用）
    const resumeSavedProgress = () => {
        try {
            const savedAnswers = localStorage.getItem("advisor_answers");
            const savedGender = localStorage.getItem("advisor_gender");
            const savedStep = localStorage.getItem("advisor_step");

            let initialAnswers = {};
            if (savedAnswers) {
                initialAnswers = JSON.parse(savedAnswers);
            }

            if (savedGender === "female" || savedGender === "male") {
                setGender(savedGender);
                // Ensure gender is in answers so dependsOn logic works
                initialAnswers = { ...initialAnswers, gender: savedGender };
            }

            setAnswers(initialAnswers);
            setCommittedAnswers(initialAnswers);

            // Restore step index (after next render when questions are filtered)
            if (savedStep) {
                const stepIndex = parseInt(savedStep, 10);
                if (!isNaN(stepIndex) && stepIndex >= 0) {
                    setTimeout(() => {
                        setCurrentStepIndex(stepIndex);
                        // 重置质量检测计时器
                        sessionStartTime.current = Date.now();
                        startStepIndex.current = stepIndex;
                    }, 0);
                }
            }
        } catch (e) { console.error(e); }

        setShowResumeModal(false);
    };

    // 重新开始（清除保存的进度）
    const startFresh = () => {
        localStorage.removeItem("advisor_answers");
        localStorage.removeItem("advisor_gender");
        localStorage.removeItem("advisor_step");
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_result");
        // 保留昵称和头像，因为这可能是刚才在首页设置的
        // localStorage.removeItem("advisor_nickname");
        // localStorage.removeItem("advisor_avatar");

        setGender(null);
        setAnswers({});
        setCommittedAnswers({});
        setCurrentStepIndex(0);
        setShowResumeModal(false);
        setPendingAnswers(null);
        setShowQualityWarning(false);

        // 重置防刷检测相关的计时器与索引
        sessionStartTime.current = Date.now();
        startStepIndex.current = 0;
    };

    // 自动保存答案和步骤
    useEffect(() => {
        if (Object.keys(answers).length > 0) {
            localStorage.setItem("advisor_answers", JSON.stringify(answers));
        }
        if (gender) {
            localStorage.setItem("advisor_step", String(currentStepIndex));
        }
    }, [answers, currentStepIndex, gender]);

    // Removed `beforeunload` listener since the application continuously auto-saves progress.
    // Prompting users aggressively when we already have an effective "Resume Test" feature feels intrusive.

    const handleGenderSelect = (selectedGender: "female" | "male") => {
        setGender(selectedGender);
        setAnswers(prev => ({ ...prev, gender: selectedGender }));
        localStorage.setItem("advisor_gender", selectedGender);
        // 追踪问卷开始（从选择性别开始算）
        if (!hasTrackedStart.current) {
            trackQuestionnaireStart();
            hasTrackedStart.current = true;
            // 记录开始时间
            sessionStartTime.current = Date.now();
        }
    };

    const handleSelect = (value: string) => {
        if (!currentQuestion) return;

        const newAnswers = { ...answers };

        if (currentQuestion.type === "multiple") {
            let currentVal = (newAnswers[currentQuestion.fieldName] as string[]) || [];
            const exclusiveValues = ["unknown", "none"];

            if (exclusiveValues.includes(value)) {
                // 如果选择了互斥选项（如“不太清楚”或“无”），仅保留该选项
                newAnswers[currentQuestion.fieldName] = [value];

                // 互斥选项视作单选，选完后给个小延迟自动跳转
                setTimeout(() => {
                    handleNextWithAnswers(newAnswers);
                }, 300);
            } else {
                // 如果选择了普通选项
                // 1. 先清除互斥选项
                currentVal = currentVal.filter(v => !exclusiveValues.includes(v));

                // 2. 正常的 toggle 逻辑
                if (currentVal.includes(value)) {
                    newAnswers[currentQuestion.fieldName] = currentVal.filter((v: string) => v !== value);
                } else {
                    if (currentVal.length < 3) { // 最多选3个
                        newAnswers[currentQuestion.fieldName] = [...currentVal, value];
                    }
                }
            }
        } else {
            newAnswers[currentQuestion.fieldName] = value;
            // 单选自动跳转
            setTimeout(() => {
                handleNextWithAnswers(newAnswers);
            }, 300);
        }

        setAnswers(newAnswers);
    };

    // 真正执行提交的逻辑
    const processSubmission = (finalAnswers: any) => {
        localStorage.setItem("advisor_answers", JSON.stringify(finalAnswers));
        // 清除进度索引（已完成）
        localStorage.removeItem("advisor_step");
        trackQuestionnaireComplete(finalAnswers);
        router.push("/face-scan");
    };

    // 辅助函数：处理带特定答案的完成逻辑
    const handleNextWithAnswers = (currentAnswers: any) => {
        const nextQs = getFilteredQuestions(currentAnswers, gender);
        if (currentStepIndex < nextQs.length - 1) {
            setCommittedAnswers(currentAnswers);
            setDirection(1);
            setCurrentStepIndex(prev => prev + 1);
        } else {
            setCommittedAnswers(currentAnswers);
            // 到达最后一题，触发完成逻辑
            // 1. 质量检测：计算耗时
            const now = Date.now();
            const timeSpent = now - sessionStartTime.current;
            const questionsAnsweredInSession = currentStepIndex - startStepIndex.current + 1;

            // 规则：如果在本次会话中回答了超过 3 题，且平均每题耗时少于 1.5 秒
            // 或者：如果回答了超过 5 题且总耗时少于 6 秒 (极速盲点)
            const avgTime = timeSpent / questionsAnsweredInSession;
            const isTooFast = (questionsAnsweredInSession >= 3 && avgTime < 1500) ||
                (questionsAnsweredInSession >= 5 && timeSpent < 6000);

            if (isTooFast) {
                setPendingAnswers(currentAnswers);
                setShowQualityWarning(true);
                return;
            }

            // 正常提交
            processSubmission(currentAnswers);
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
                    className="flex min-h-screen flex-col items-center justify-center bg-transparent px-4"
                >
                    <div className="w-full max-w-4xl">
                        <GenderSelection onSelect={handleGenderSelect} />
                    </div>

                    <button
                        onClick={() => router.push("/")}
                        className="fixed bottom-8 flex items-center gap-2 text-xs text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors tracking-widest uppercase font-medium"
                    >
                        <LogOut size={12} strokeWidth={2.5} />
                        退出测试
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
        <div className="min-h-screen bg-transparent flex flex-col items-center relative overflow-x-hidden text-[#1A1A1A]">

            {/* Top Bar: Progress & Exit */}
            <div className="w-[90%] mx-auto py-8 flex items-center justify-between z-20 shrink-0">
                <div className="w-12 h-12 flex items-center justify-center">
                    <span className="text-xs font-bold tracking-widest text-[#4A3728]/50">0{currentStepIndex + 1}</span>
                </div>

                <div className="flex-1 max-w-xs mx-auto px-4 opacity-0 sm:opacity-100 transition-opacity">
                    <ProgressBar current={currentStepIndex + 1} total={questions.length} compact />
                </div>

                <button
                    onClick={() => setShowExitConfirm(true)}
                    className="group w-12 h-12 flex items-center justify-end text-[#4A3728]/50 hover:text-[#4A3728] transition-colors"
                >
                    <LogOut className="h-5 w-5 transition-transform group-hover:translate-x-1 duration-300" />
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full max-w-5xl mx-auto px-6 flex flex-col justify-center z-10 min-h-0">
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

            {/* Ghost footer to balance the top bar height for perfect centering between Header and Bottom Buttons */}
            <div className="h-[112px] shrink-0 pointer-events-none" aria-hidden="true" />

            {/* Floating Navigation Controls */}
            {/* Left Corner: Back */}
            <div className="fixed bottom-8 left-[5%] lg:bottom-12 z-30">
                <button
                    onClick={handleBack}
                    className={cn(
                        "glass-premium px-6 sm:px-8 py-3 rounded-full text-sm font-semibold tracking-widest hover:scale-110 active:scale-95 transition-all duration-500 shadow-xl border border-white/40 flex items-center gap-2",
                        (currentStepIndex === 0 && !gender) ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"
                    )}
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">上一题</span>
                </button>
            </div>

            {/* Right Corner: Next */}
            <div className="fixed bottom-8 right-[5%] lg:bottom-12 z-30">
                <AnimatePresence>
                    {((currentQuestion.type === "multiple") || (currentStepIndex === questions.length - 1 && !isNextDisabled())) && (
                        <m.button
                            initial={{ opacity: 0, scale: 0.8, x: 20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: 20 }}
                            whileHover={!isNextDisabled() ? { scale: 1.05, y: -2 } : {}}
                            whileTap={!isNextDisabled() ? { scale: 0.95 } : {}}
                            onClick={handleNext}
                            disabled={isNextDisabled()}
                            className={cn(
                                "px-8 sm:px-10 py-3.5 sm:py-4 rounded-full text-sm font-bold tracking-[0.2em] transition-all duration-500 shadow-2xl flex items-center gap-3 backdrop-blur-xl border",
                                isNextDisabled()
                                    ? "bg-white/40 text-[#1A1A1A]/10 cursor-not-allowed border-white/20"
                                    : "bg-[#4A3728]/95 text-[#FDFBF7] border-white/20 hover:bg-[#4A3728] hover:shadow-[0_20px_50px_-12px_rgba(74,55,40,0.5)]"
                            )}
                        >
                            <span>{currentStepIndex === questions.length - 1 ? "面部检测" : "下一步"}</span>
                            {!isNextDisabled() && <ChevronRight className="h-5 w-5" />}
                        </m.button>
                    )}
                </AnimatePresence>
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
                            className="relative w-full max-w-sm glass-premium p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/50 text-center rounded-[2.5rem] overflow-hidden"
                        >
                            <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
                            <div className="relative z-10">
                                <h3 className="text-2xl font-serif text-[#1A1A1A] mb-3 tracking-tight">结束测试？</h3>
                                <p className="text-sm text-[#5E5E5E] mb-10 font-light leading-relaxed">
                                    您的进度已自动保存，<br />下次返回可直接从此处继续。
                                </p>
                                <div className="flex flex-col items-center gap-5">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="group inline-flex items-center gap-2 py-2 text-[15px] tracking-[0.2em] font-medium text-[#8B7355] cursor-pointer transition-all duration-300 bg-transparent border-none outline-none"
                                    >
                                        <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">继续测试</span>
                                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                    </button>
                                    <button
                                        onClick={() => router.push("/")}
                                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                    >
                                        退出并返回首页
                                    </button>
                                </div>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Quality Check Modal */}
            <AnimatePresence>
                {showQualityWarning && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#FDFBF7]/90 backdrop-blur-sm"
                            onClick={() => setShowQualityWarning(false)}
                        />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-[400px] glass-premium p-10 shadow-[0_32px_64px_-16px_rgba(162,148,134,0.2)] border border-white/50 text-center rounded-[2.5rem] overflow-hidden"
                        >
                            <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-full bg-[#8B7355]/5 flex items-center justify-center mx-auto mb-6">
                                    <span className="text-3xl">🤔</span>
                                </div>
                                <h3 className="text-2xl font-serif text-[#1A1A1A] mb-3 tracking-tight">确认提交？</h3>
                                <p className="text-[14px] text-[#5E5E5E] mb-10 font-light leading-relaxed px-4">
                                    我们检测到您的填写速度较快。<br />
                                    建议您再次核对，确保 AI 能为您提供<span className="text-[#1A1A1A] font-medium"> 最精准 </span>的分析结果。
                                </p>
                                <div className="flex flex-col items-center gap-5">
                                    <button
                                        onClick={() => {
                                            setShowQualityWarning(false);
                                            sessionStartTime.current = Date.now();
                                            startStepIndex.current = currentStepIndex;
                                            if (pendingAnswers) processSubmission(pendingAnswers);
                                        }}
                                        className="group inline-flex items-center gap-2 py-2 text-[15px] tracking-[0.2em] font-medium text-[#8B7355] cursor-pointer transition-all duration-300 bg-transparent border-none outline-none"
                                    >
                                        <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">我已确认，去提交</span>
                                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                    </button>
                                    <button
                                        onClick={() => setShowQualityWarning(false)}
                                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                    >
                                        返回检查
                                    </button>
                                </div>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Resume Progress Modal */}
            <AnimatePresence>
                {showResumeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#FDFBF7]/90 backdrop-blur-sm"
                        />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-[400px] glass-premium p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/50 text-center rounded-[2.5rem] overflow-hidden"
                        >
                            <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-full bg-[#8B7355]/5 flex items-center justify-center mx-auto mb-6">
                                    <History className="w-8 h-8 text-[#8B7355]/60" strokeWidth={1} />
                                </div>
                                <h3 className="text-2xl font-serif text-[#1A1A1A] mb-3 tracking-tight">未完成的测试</h3>
                                <p className="text-[14px] text-[#5E5E5E] mb-10 font-light leading-relaxed">
                                    为您自动找回了上次的进度，<br />是否立即继续完成？
                                </p>
                                <div className="flex flex-col items-center gap-5">
                                    <button
                                        onClick={resumeSavedProgress}
                                        className="group inline-flex items-center gap-2 py-2 text-[15px] tracking-[0.2em] font-medium text-[#8B7355] cursor-pointer transition-all duration-300 bg-transparent border-none outline-none"
                                    >
                                        <span className="border-b border-[#8B7355]/30 pb-0.5 group-hover:border-[#8B7355] transition-colors">继续上次测试</span>
                                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                    </button>
                                    <button
                                        onClick={startFresh}
                                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/30 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
                                    >
                                        暂时不用，重新开始
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
