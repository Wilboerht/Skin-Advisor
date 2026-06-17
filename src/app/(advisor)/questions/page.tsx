"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_QUESTIONS, type Question } from "@/config/questions";
import { QuestionStep } from "@/components/advisor/QuestionStep";
import Image from "next/image";
import { GenderSelection } from "@/components/advisor/GenderSelection";

import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, LogOut, ArrowRight, History } from "lucide-react";
import { HomeSvg } from "@/components/icons/HomeSvg";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { cn } from "@/lib/utils";
import { preloadAllFaceModels } from "@/lib/preload-models";

export default function QuestionsPage() {
    const router = useRouter();
    const [gender, setGender] = useState<"female" | "male" | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [committedAnswers, setCommittedAnswers] = useState<Record<string, unknown>>({});
    const [direction, setDirection] = useState(0);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [, setHasSavedProgress] = useState(false);
    const { trackQuestionnaireStart, trackQuestionnaireComplete } = useAdvisorAnalytics();
    const hasTrackedStart = useRef(false);
    const hasCheckedResume = useRef(false);

    // 追踪答题质量
    const sessionStartTime = useRef(0);
    const startStepIndex = useRef(0);
    const [showQualityWarning, setShowQualityWarning] = useState(false);
    const [pendingAnswers, setPendingAnswers] = useState<Record<string, unknown> | null>(null);
    const [showFadeMask, setShowFadeMask] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    // 预加载面部识别模型，在用户填问卷时后台加载
    // 这样当完成问卷进入拍照步骤时，模型就已经就绪，避免用户等待
    useEffect(() => {
        preloadAllFaceModels();
    }, []);

    const getFilteredQuestions = (currentAnswers: Record<string, unknown>, currentGender: typeof gender) => {
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

    // resumeSavedProgress ref（必须在函数定义之后）
    const resumeSavedProgressRef = useRef(resumeSavedProgress);
    useEffect(() => {
        resumeSavedProgressRef.current = resumeSavedProgress;
    });

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
                // 如果是从扫脸页点击“返回修改”进来的 (带 ?edit=true)，则自动恢复，不弹窗询问
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('edit') === 'true') {
                    resumeSavedProgressRef.current();
                    return;
                }

                // 否则显示选择弹窗（延迟到下一帧避免同步 setState）
                const id = requestAnimationFrame(() => {
                    setHasSavedProgress(true);
                    setShowResumeModal(true);
                });
                return () => cancelAnimationFrame(id);
            }
        } catch (e) { console.error(e); }
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
    }, [currentStepIndex, answers, gender]);

    // 底部渐隐遮罩：一屏能显示完时不显示；翻到最底下时消失
    useEffect(() => {
        const check = () => {
            const container = scrollContainerRef.current;
            if (!container) return;

            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const scrollTop = container.scrollTop;

            // 一屏能显示完，不显示遮罩
            if (scrollHeight <= clientHeight + 1) {
                setShowFadeMask(false);
                return;
            }

            // 滚动到底部附近，隐藏遮罩
            const nearBottom = scrollTop + clientHeight >= scrollHeight - 10;
            setShowFadeMask(!nearBottom);
        };

        check();
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener("scroll", check, { passive: true });
        }
        window.addEventListener("resize", check);

        const observer = new ResizeObserver(check);
        if (container) {
            observer.observe(container);
        }

        return () => {
            if (container) {
                container.removeEventListener("scroll", check);
            }
            window.removeEventListener("resize", check);
            observer.disconnect();
        };
    }, [currentStepIndex, questions.length, answers]);

    // 如果没有选择性别，显示隐私同意或性别选择
    if (!gender) {
        return (
            <AnimatePresence mode="wait">
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-screen overflow-hidden flex flex-col bg-[#F5F2E9] p-4"
                >
                    {/* Top Bar */}
                    <div className="relative flex items-center justify-center p-4">
                        <button
                            onClick={() => router.push("/")}
                            className="absolute left-2 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                            aria-label="返回"
                        >
                            <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
                            <span className="text-[14px] font-medium tracking-wide">返回</span>
                        </button>
                        <Image
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD"
                            width={120}
                            height={30}
                            className="h-7 sm:h-8 object-contain"
                            priority
                        />
                        <button
                            onClick={() => router.push("/")}
                            className="absolute right-2 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                            aria-label="回到首页"
                        >
                            <HomeSvg className="w-6 h-6" />
                            <span className="text-[14px] font-medium tracking-wide">退出</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hide w-full max-w-4xl mx-auto px-4">
                        <div className="min-h-full flex items-center justify-center">
                            <GenderSelection onSelect={handleGenderSelect} />
                        </div>
                    </div>

                    {/* Footer */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.2, delay: 1 }}
                        className="py-6 opacity-40"
                    >
                        <p className="text-center text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A] leading-tight">
                            &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                        </p>
                    </m.div>
                </m.div>
            </AnimatePresence>
        );
    }

    if (!currentQuestion) return null;

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-[#F5F2E9] p-4 text-[#1A1A1A]">

            {/* Top Bar: Back & Logo & Exit */}
            <div className="relative flex items-center justify-center p-4 z-20 shrink-0">
                <button
                    onClick={handleBack}
                    className={cn(
                        "absolute left-2 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5",
                        (currentStepIndex === 0 && !gender) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                    aria-label="上一题"
                >
                    <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
                    <span className="text-[14px] font-medium tracking-wide">返回</span>
                </button>

                <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={120}
                    height={30}
                    className="h-7 sm:h-8 object-contain"
                    priority
                />

                <button
                    onClick={() => setShowExitConfirm(true)}
                    aria-label="退出测评"
                    className="absolute right-2 px-3 py-2 flex items-center gap-1.5 text-[#3D4430]/40 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5"
                >
                    <HomeSvg className="w-6 h-6" />
                    <span className="text-[14px] font-medium tracking-wide">退出</span>
                </button>
            </div>

            {/* Main Content Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-hide relative w-full max-w-4xl mx-auto z-10 px-4 mb-4">
                <div className="min-h-full flex items-center justify-center">
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
                                selectedValue={(answers[currentQuestion.fieldName] as string | string[] | null) || null}
                                onSelect={handleSelect}
                                direction={direction}
                            />
                        </m.div>
                    </AnimatePresence>
                </div>

                {/* Bottom Fade Mask - 底部渐隐遮挡 */}
                <div className={cn(
                    "absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-20 bg-gradient-to-t from-[#F0EDE1] via-[#F0EDE1]/80 to-transparent transition-opacity duration-300",
                    showFadeMask ? "opacity-100" : "opacity-0"
                )} />
            </div>

            {/* Footer */}
            <div className="py-6 opacity-40 shrink-0 text-center">
                {currentQuestion.type !== "multiple" && (
                    <p className="text-center text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A] leading-tight">
                        &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                    </p>
                )}
            </div>

            {/* Floating Navigation Controls */}
            {/* Left Corner: Back - Desktop Only */}
            <div className="fixed bottom-8 left-[5%] lg:bottom-12 z-30 hidden sm:block">
                <button
                    onClick={handleBack}
                    className={cn(
                        "px-7 py-2.5 rounded-md text-[13px] font-medium tracking-widest hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 bg-white/60 backdrop-blur-md border border-[#3D4430]/10 text-[#3D4430]/70 hover:text-[#3D4430] hover:border-[#3D4430]/20 hover:bg-white/80",
                        (currentStepIndex === 0 && !gender) ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"
                    )}
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span>上一题</span>
                </button>
            </div>

            {/* Right Corner: Next */}
            <div className={cn(
                "fixed z-30",
                "bottom-4 left-4 right-4 sm:bottom-8 sm:left-auto sm:right-[5%] lg:bottom-12"
            )}>
                <AnimatePresence>
                    {((currentQuestion.type === "multiple") || (currentStepIndex === questions.length - 1 && !isNextDisabled())) && (
                        <m.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            whileHover={!isNextDisabled() ? { scale: 1.02 } : {}}
                            whileTap={!isNextDisabled() ? { scale: 0.98 } : {}}
                            onClick={handleNext}
                            disabled={isNextDisabled()}
                            className={cn(
                                "w-full sm:w-auto text-[13px] sm:text-[13px] font-medium tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-2",
                                "py-3.5 sm:py-3 rounded-xl sm:rounded-md sm:px-9",
                                isNextDisabled()
                                    ? "bg-[#E5E0D5]/80 text-[#1A1A1A]/30 cursor-not-allowed"
                                    : "bg-[#7A6B5E] text-[#FDFBF7] hover:bg-[#6A5B4E] hover:shadow-[0_12px_32px_-8px_rgba(74,55,40,0.22)] sm:bg-[#4A3728] sm:hover:bg-[#3D2E20] sm:hover:shadow-[0_12px_32px_-8px_rgba(74,55,40,0.35)]"
                            )}
                        >
                            <span>{currentStepIndex === questions.length - 1 ? "面部检测" : "下一步"}</span>
                            {!isNextDisabled() && <ChevronRight className="h-4 w-4" />}
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
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-sm bg-white/70 backdrop-blur-xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] border border-[#D4CFC5] text-center rounded-xl overflow-hidden"
                        >
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
                            <div className="relative z-10">
                                <h3 className="text-xl font-serif text-[#1A1A1A] mb-2">结束测试？</h3>
                                <p className="text-sm text-[#5E5E5E] mb-8 font-light leading-relaxed">
                                    您的进度已自动保存，<br />下次返回可直接从此处继续。
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="w-full h-11 rounded-md bg-[#4A3728] hover:bg-[#3D2E20] text-[#FDFBF7] text-[13px] font-medium tracking-[0.15em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <span>继续测试</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => router.push("/")}
                                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
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
                            className="relative w-full max-w-sm bg-white/70 backdrop-blur-xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] border border-[#D4CFC5] text-center rounded-xl overflow-hidden"
                        >
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
                            <div className="relative z-10">
                                <h3 className="text-xl font-serif text-[#1A1A1A] mb-2">确认提交？</h3>
                                <p className="text-sm text-[#5E5E5E] mb-8 font-light leading-relaxed">
                                    我们检测到您的填写速度较快。<br />
                                    建议您再次核对，确保 AI 能为您提供<span className="text-[#1A1A1A] font-medium"> 最精准 </span>的分析结果。
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <button
                                        onClick={() => {
                                            setShowQualityWarning(false);
                                            sessionStartTime.current = Date.now();
                                            startStepIndex.current = currentStepIndex;
                                            if (pendingAnswers) processSubmission(pendingAnswers);
                                        }}
                                        className="w-full h-11 rounded-md bg-[#4A3728] hover:bg-[#3D2E20] text-[#FDFBF7] text-[13px] font-medium tracking-[0.15em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <span>我已确认，去提交</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowQualityWarning(false)}
                                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
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
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-sm bg-white/70 backdrop-blur-xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] border border-[#D4CFC5] text-center rounded-xl overflow-hidden"
                        >
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
                            <div className="relative z-10">
                                <h3 className="text-xl font-serif text-[#1A1A1A] mb-2">未完成的测试</h3>
                                <p className="text-sm text-[#5E5E5E] mb-8 font-light leading-relaxed">
                                    为您自动找回了上次的进度，<br />是否立即继续完成？
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <button
                                        onClick={resumeSavedProgress}
                                        className="w-full h-11 rounded-md bg-[#4A3728] hover:bg-[#3D2E20] text-[#FDFBF7] text-[13px] font-medium tracking-[0.15em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <span>继续上次测试</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={startFresh}
                                        className="text-[12px] tracking-[0.15em] text-[#3D4430]/40 hover:text-[#3D4430] transition-colors bg-transparent border-none cursor-pointer"
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
