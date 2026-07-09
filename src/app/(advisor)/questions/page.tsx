"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_QUESTIONS, type Question } from "@/config/questions";
import { QuestionStep } from "@/components/advisor/QuestionStep";
import Image from "next/image";
import Link from "next/link";
import { GenderSelection } from "@/components/advisor/GenderSelection";

import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, ArrowRight, LogOut, Loader2 } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { preloadAllFaceModels } from "@/lib/preload-models";

export default function QuestionsPage() {
    const router = useRouter();
    const toast = useToast();
    const [gender, setGender] = useState<"female" | "male" | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [committedAnswers, setCommittedAnswers] = useState<Record<string, unknown>>({});
    const [direction, setDirection] = useState(0);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const { trackQuestionnaireStart, trackQuestionnaireComplete } = useAdvisorAnalytics();
    const hasTrackedStart = useRef(false);

    // 追踪答题质量
    const sessionStartTime = useRef(0);
    const startStepIndex = useRef(0);
    const [showQualityWarning, setShowQualityWarning] = useState(false);
    const [pendingAnswers, setPendingAnswers] = useState<Record<string, unknown> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const genderScrollRef = useRef<HTMLDivElement>(null);

    // AI 配置校验
    const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
    const [configMessage, setConfigMessage] = useState("");

    useEffect(() => {
        fetch("/api/advisor/check-config")
            .then((r) => r.json())
            .then((data) => {
                setAiConfigured(data.configured);
                setConfigMessage(data.message || "");
            })
            .catch(() => {
                setAiConfigured(false);
                setConfigMessage("无法验证 AI 配置，请稍后重试。");
            });
    }, []);

    // 从 API 获取问题列表（数据库优先，静态降级）
    const [allQuestions, setAllQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
    const [questionsError, setQuestionsError] = useState<string | null>(null);

    // 入口守卫：必须通过首页引导弹窗后才能进入问卷
    useEffect(() => {
        try {
            const hasConsent = localStorage.getItem("advisor_privacy_consent");
            const hasAnswers = localStorage.getItem("advisor_answers");
            if (!hasConsent && !hasAnswers) {
                router.replace("/");
            }
        } catch {
            router.replace("/");
        }
    }, [router]);
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
                } else {
                    console.error("Failed to fetch questions from API, using defaults:", res.status);
                    setQuestionsError("问题列表加载失败，已使用默认问题。");
                }
            } catch (e) {
                console.error("Failed to fetch questions from API, using defaults:", e);
                setQuestionsError("问题列表加载失败，已使用默认问题。");
            }
        };
        fetchQuestions();
    }, []);

    // 预加载面部识别模型，在用户填问卷时后台加载
    // 这样当完成问卷进入拍照步骤时，模型就已经就绪，避免用户等待
    useEffect(() => {
        preloadAllFaceModels();
    }, []);

    const getFilteredQuestions = (currentAnswers: Record<string, unknown>, currentGender: typeof gender) => {
        return allQuestions.filter(q => {
            if (currentGender === "male" && (q.fieldName === "pregnancy" || q.fieldName === "menstrualCycle")) return false;

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
                        return typeof dependencyAnswer === 'string' && value.includes(dependencyAnswer);
                    }
                    return dependencyAnswer === value;
                }
            }
            return true;
        });
    };

    const questions = getFilteredQuestions(committedAnswers, gender);
    const currentQuestion = questions[currentStepIndex];

    // 4. 确保 stepIndex 有效（使用 requestAnimationFrame 避免同步 setState）
    useEffect(() => {
        if (questions.length > 0 && currentStepIndex >= questions.length) {
            const id = requestAnimationFrame(() => {
                setCurrentStepIndex(questions.length - 1);
            });
            return () => cancelAnimationFrame(id);
        }
    }, [questions.length, currentStepIndex]);

    // 每次切题时重置滚动位置到顶部
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [currentStepIndex]);

    // 进入性别选择页时重置内部滚动容器到顶部（修复移动端从首页弹窗进入后未置顶的问题）
    useEffect(() => {
        if (gender === null) {
            const resetScroll = () => {
                // 重置内部滚动容器
                if (genderScrollRef.current) {
                    genderScrollRef.current.scrollTop = 0;
                }
                // 同时重置 window / document 滚动，防止 iOS 把上一页的滚动状态带过来
                if (typeof window !== "undefined") {
                    window.scrollTo(0, 0);
                    if (document.documentElement) {
                        document.documentElement.scrollTop = 0;
                    }
                    if (document.body) {
                        document.body.scrollTop = 0;
                    }
                }
            };

            resetScroll();
            requestAnimationFrame(resetScroll);
            const timers = [50, 150, 300, 600].map((ms) => setTimeout(resetScroll, ms));
            return () => timers.forEach(clearTimeout);
        }
    }, [gender, aiConfigured]);

    // 恢复之前的状态（从扫脸页点击“返回修改”时调用）
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
        } catch (e) {
            console.error("Failed to restore saved progress:", e);
        }
    };

    // resumeSavedProgress ref（必须在函数定义之后）
    const resumeSavedProgressRef = useRef(resumeSavedProgress);
    useEffect(() => {
        resumeSavedProgressRef.current = resumeSavedProgress;
    });

    // 从扫脸页点击“返回修改”时自动恢复进度
    const hasCheckedResume = useRef(false);
    useEffect(() => {
        if (hasCheckedResume.current) return;
        hasCheckedResume.current = true;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('edit') === 'true') {
                resumeSavedProgressRef.current();
            }
        } catch (e) {
            console.error("Failed to parse edit URL params:", e);
        }
    }, []);

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
                    } else {
                        toast.info("最多选择 3 项");
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

    // 真正执行提交的逻辑
    const processSubmission = (finalAnswers: Record<string, unknown>) => {
        setIsSubmitting(true);
        localStorage.setItem("advisor_answers", JSON.stringify(finalAnswers));
        // 不再此处清除进度，以便用户从扫脸页返回时能恢复问卷位置
        trackQuestionnaireComplete(finalAnswers);
        router.push("/face-scan");
    };

    // 辅助函数：处理带特定答案的完成逻辑
    const handleNextWithAnswers = (currentAnswers: Record<string, unknown>) => {
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

    // 安全检查
    const isNextDisabled = () => {
        if (!currentQuestion) return true;
        const val = answers[currentQuestion.fieldName];
        if (!val || (Array.isArray(val) && val.length === 0)) {
            return true;
        }
        return false;
    };

    // 键盘支持 — 使用 ref 避免闭包捕获旧值及 ESLimmutability 警告
    const handleNextRef = useRef(handleNext);
    const isNextDisabledRef = useRef(isNextDisabled);
    useEffect(() => {
        handleNextRef.current = handleNext;
        isNextDisabledRef.current = isNextDisabled;
    });
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !isNextDisabledRef.current()) {
                handleNextRef.current();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);


    // 如果没有选择性别，显示隐私同意或性别选择
    if (!gender) {
        return (
            <AnimatePresence mode="wait">
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-dvh overflow-hidden flex flex-col bg-[#F5F2E9]"
                >
                    {/* Top Bar */}
                    <div className="relative flex items-center justify-center py-6 md:py-7 px-4 md:px-12 lg:px-20 border-b border-[#3D4430]/5">
                        <button
                            onClick={() => router.push("/")}
                            className="absolute left-4 md:left-12 lg:left-20 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                            aria-label="回首页"
                        >
                            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline text-[14px] font-medium tracking-wide">回首页</span>
                        </button>
                        <Image
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD"
                            width={120}
                            height={36}
                            className="h-7 md:h-9 w-auto object-contain"
                            priority
                        />
                        <button
                            onClick={() => router.push("/")}
                            className="absolute right-4 md:right-12 lg:right-20 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                            aria-label="回到首页"
                        >
                            <LogOut className="w-5 h-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline text-[14px] font-medium tracking-wide">退出</span>
                        </button>
                    </div>

                    <div
                        ref={genderScrollRef}
                        className="flex-1 overflow-hidden scrollbar-hide w-full max-w-5xl mx-auto px-4 md:px-8"
                    >
                        <div className="h-full min-h-0 py-4 sm:py-0 flex flex-col sm:flex-row items-center justify-center">
                            {aiConfigured === null ? (
                                <div className="flex items-center gap-2 text-[#5E5E5E]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    正在检查服务状态...
                                </div>
                            ) : aiConfigured === false ? (
                                <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm text-center">
                                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-2">服务暂未就绪</h3>
                                    <p className="text-sm text-[#5E5E5E] mb-6">{configMessage}</p>
                                    <button
                                        onClick={() => router.push("/")}
                                        className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                    >
                                        返回首页
                                    </button>
                                </div>
                            ) : (
                                <GenderSelection onSelect={handleGenderSelect} />
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.2, delay: 1 }}
                        className="hidden sm:flex pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] opacity-40 px-4"
                    >
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A] leading-tight">
                            <p>&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                            <span className="hidden sm:inline text-[#1A1A1A]/30">·</span>
                            <div className="hidden sm:flex items-center gap-4">
                                <Link href="/privacy" className="hover:text-[#3D4430] transition-colors duration-300">隐私政策</Link>
                                <span className="text-[#1A1A1A]/30">·</span>
                                <Link href="/terms" className="hover:text-[#3D4430] transition-colors duration-300">服务条款</Link>
                            </div>
                        </div>
                    </m.div>
                </m.div>
            </AnimatePresence>
        );
    }

    if (!currentQuestion) return null;

    return (
        <div className="h-dvh overflow-hidden flex flex-col bg-[#F5F2E9] text-[#1A1A1A]">

            {/* 提交中加载遮罩 */}
            <AnimatePresence>
                {isSubmitting && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-[#F5F2E9]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                    >
                        <Loader2 className="w-8 h-8 text-[#3D4430] animate-spin" />
                        <p className="text-sm text-[#5E5E5E] tracking-wide">正在准备面部扫描...</p>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Top Bar: Back & Logo & Exit */}
            <div className="relative flex items-center justify-center py-5 md:py-7 px-4 md:px-12 lg:px-20 z-20 shrink-0 border-b border-[#3D4430]/5">
                <button
                    onClick={handleBack}
                    className={cn(
                        "absolute left-4 md:left-12 lg:left-20 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5",
                        (currentStepIndex === 0 && !gender) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                    aria-label={!gender ? "回首页" : "上一题"}
                >
                    <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                    <span className="hidden sm:inline text-[14px] font-medium tracking-wide">
                        {!gender ? "回首页" : "上一题"}
                    </span>
                </button>

                <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={120}
                    height={30}
                    className="h-7 md:h-9 w-auto object-contain"
                    priority
                />

                <button
                    onClick={() => setShowExitConfirm(true)}
                    aria-label="退出测评"
                    className="absolute right-4 md:right-12 lg:right-20 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                >
                    <LogOut className="w-5 h-5" strokeWidth={1.5} />
                    <span className="hidden sm:inline text-[14px] font-medium tracking-wide">退出</span>
                </button>
            </div>

            {/* 问题列表加载失败提示 */}
            {questionsError && (
                <div className="shrink-0 px-4 pb-2">
                    <div className="max-w-4xl mx-auto rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
                        <span>{questionsError}</span>
                        <button
                            onClick={() => setQuestionsError(null)}
                            className="ml-3 text-amber-600 hover:text-amber-900"
                            aria-label="关闭提示"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-hide relative w-full max-w-5xl mx-auto z-10 px-4 md:px-8 mb-4">
                <div className="min-h-full flex flex-col justify-center">
                    <AnimatePresence mode="wait" custom={direction}>
                        <m.div
                            key={currentStepIndex}
                            custom={direction}
                            layout
                            initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="w-full"
                        >
                            <QuestionStep
                                question={currentQuestion}
                                selectedValue={(answers[currentQuestion.fieldName] as string | string[] | null) || null}
                                onSelect={handleSelect}
                                onNext={handleNext}
                                direction={direction}
                                currentStep={currentStepIndex + 1}
                                totalSteps={questions.length}
                            />
                        </m.div>
                    </AnimatePresence>
                </div>

            </div>

            {/* Footer */}
            <div className="pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] opacity-40 shrink-0 text-center px-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A] leading-tight">
                    <p>&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                    <span className="hidden sm:inline text-[#1A1A1A]/30">·</span>
                    <div className="hidden sm:flex items-center gap-4">
                        <Link href="/privacy" className="hover:text-[#3D4430] transition-colors duration-300">隐私政策</Link>
                        <span className="text-[#1A1A1A]/30">·</span>
                        <Link href="/terms" className="hover:text-[#3D4430] transition-colors duration-300">服务条款</Link>
                    </div>
                </div>
            </div>


            {/* Exit Modal */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                            onClick={() => setShowExitConfirm(false)}
                        />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm"
                        >
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <div className="sm:w-[60%] text-center sm:text-left">
                                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-3 sm:mb-2">退出测试？</h3>
                                    <p className="text-sm text-[#5E5E5E] leading-relaxed">
                                        您的进度已自动保存，下次返回可直接从此处继续。
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        继续测试
                                    </button>
                                    <button
                                        onClick={() => router.push("/")}
                                        className="px-6 h-10 rounded-lg border border-[#E8E2D9] text-[#5E5E5E] hover:text-[#1A1A1A] hover:border-[#D9D0C3] text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        退出并返回首页
                                    </button>
                                </div>
                            </div>
                        </m.div>
                        <Image src="/images/watermark.png" alt="" width={200} height={200} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-auto object-contain opacity-15 pointer-events-none" unoptimized />
                    </div>
                )}
            </AnimatePresence>

            {/* Quality Check Modal */}
            <AnimatePresence>
                {showQualityWarning && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <m.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#F5F2E9]/80 backdrop-blur-sm"
                            onClick={() => setShowQualityWarning(false)}
                        />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm"
                        >
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <div className="sm:w-[60%] text-center sm:text-left">
                                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-3 sm:mb-2">确认提交？</h3>
                                    <p className="text-sm text-[#5E5E5E] leading-relaxed">
                                        我们检测到您的填写速度较快。建议您再次核对，确保 AI 能为您提供<span className="text-[#1A1A1A] font-medium"> 最精准 </span>的分析结果。
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                                    <button
                                        onClick={() => {
                                            setShowQualityWarning(false);
                                            sessionStartTime.current = Date.now();
                                            startStepIndex.current = currentStepIndex;
                                            if (pendingAnswers) processSubmission(pendingAnswers);
                                        }}
                                        className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        我已确认，去提交
                                    </button>
                                    <button
                                        onClick={() => setShowQualityWarning(false)}
                                        className="px-6 h-10 rounded-lg border border-[#E8E2D9] text-[#5E5E5E] hover:text-[#1A1A1A] hover:border-[#D9D0C3] text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        返回检查
                                    </button>
                                </div>
                            </div>
                        </m.div>
                        <Image src="/images/watermark.png" alt="" width={200} height={200} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-auto object-contain opacity-15 pointer-events-none" unoptimized />
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
