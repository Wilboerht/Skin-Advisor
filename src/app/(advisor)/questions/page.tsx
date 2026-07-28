"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_QUESTIONS, type Question } from "@/config/questions";
import { QUESTIONNAIRE_ONLY_QUESTIONS, matchQuestionnairePersona } from "@/lib/questionnaire-mapping";
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
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

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

    // 锁定 body 滚动，防止 iPhone 上出现滚动条 / overscroll（与首页一致）
    useBodyScrollLock({ enabled: true });

    // AI 配置校验
    const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
    const [configMessage, setConfigMessage] = useState("");

    // 排队状态（防止高峰期用户无感知地长时间等待）
    const [queueBusy, setQueueBusy] = useState(false);
    const [queueWaitSeconds, setQueueWaitSeconds] = useState(0);
    const [queueDismissed, setQueueDismissed] = useState(false);

    // 测试次数预检（避免用户完成全流程后才被拒绝）
    const [limitExceeded, setLimitExceeded] = useState(false);
    const [limitMessage, setLimitMessage] = useState("");

    useEffect(() => {
        fetch("/api/advisor/check-config")
            .then((r) => r.json())
            .then((data) => {
                setAiConfigured(data.configured);
                setConfigMessage(data.message || "");
                // 读取排队状态
                if (data.isBusy) {
                    setQueueBusy(true);
                    setQueueWaitSeconds(data.estimatedWaitSeconds || 0);
                }
            })
            .catch(() => {
                setAiConfigured(false);
                setConfigMessage("无法验证 AI 配置，请稍后重试。");
            });
    }, []);

    // 预检测试次数：在用户开始问卷前确认是否还有剩余次数
    useEffect(() => {
        const checkLimit = async () => {
            try {
                const { getGuestIdentity } = await import("@/lib/guest-identity");
                const identity = await getGuestIdentity();
                const params = new URLSearchParams();
                if (identity.cookieId) params.set("cookieId", identity.cookieId);
                if (identity.fingerprint) params.set("fingerprint", identity.fingerprint);

                const res = await fetch(`/api/advisor/test-limit?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.canTest) {
                        setLimitExceeded(true);
                        setLimitMessage(data.error || "今日测试次数已用完，请明天再试。");
                    }
                }
            } catch {
                // 预检失败不阻塞主流程，analyze 阶段会再次检查
            }
        };
        checkLimit();
    }, []);

    // 从 API 获取问题列表（数据库优先，静态降级）
    // 纯问卷模式在客户端挂载后通过 useEffect 追加剧外问题，避免 SSR hydration 不匹配
    const [allQuestions, setAllQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);

    // 缓存扫描模式（仅在客户端读取 localStorage）
    const scanModeRef = useRef<string | null>(null);
    useEffect(() => {
        try { scanModeRef.current = localStorage.getItem("advisor_scan_mode"); } catch { /* ignore */ }
        // 纯问卷模式追加剧外问题（仅在 API 尚未覆盖时生效，hasExtra 防重复追加）
        if (scanModeRef.current === "questionnaire") {
            setAllQuestions(prev => {
                const hasExtra = prev.some(q => q.fieldName.startsWith("q_"));
                return hasExtra ? prev : [...prev, ...QUESTIONNAIRE_ONLY_QUESTIONS];
            });
        }
    }, []);
    const [questionsError, setQuestionsError] = useState<string | null>(null);

    // 入口守卫：必须通过首页引导弹窗后才能进入问卷
    const [accessDenied, setAccessDenied] = useState(false);
    useEffect(() => {
        try {
            const hasConsent = localStorage.getItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
            const hasAnswers = localStorage.getItem("advisor_answers");
            if (!hasConsent && !hasAnswers) {
                setAccessDenied(true);
            }
        } catch {
            setAccessDenied(true);
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
                        // 纯问卷模式追加剧外问题（使用缓存的 scanModeRef）
                        // 使用函数式更新 + hasExtra 防重复追加，避免与 Effect A 产生二次冗余更新
                        setAllQuestions(prev => {
                            if (scanModeRef.current === "questionnaire") {
                                const hasExtra = prev.some(q => q.fieldName.startsWith("q_"));
                                return hasExtra ? prev : [...data, ...QUESTIONNAIRE_ONLY_QUESTIONS];
                            }
                            return data;
                        });
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
    // 纯问卷模式跳过（不需要面部扫描）
    useEffect(() => {
        if (scanModeRef.current !== "questionnaire") {
            preloadAllFaceModels();
        }
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

    // 进入页面时强制重置所有滚动位置，并禁用浏览器自动滚动恢复
    // 避免 next-view-transitions / 浏览器历史 / iOS 把上一页滚动状态带到问卷页
    useEffect(() => {
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }

        const html = document.documentElement;
        const originalScrollBehavior = html?.style?.scrollBehavior ?? "";

        const resetScroll = () => {
            // 临时禁用平滑滚动，确保重置立即生效
            if (html) html.style.scrollBehavior = "auto";

            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
            if (genderScrollRef.current) {
                genderScrollRef.current.scrollTop = 0;
            }
            if (typeof window !== "undefined") {
                window.scrollTo(0, 0);
                if (document.documentElement) {
                    document.documentElement.scrollTop = 0;
                }
                if (document.body) {
                    document.body.scrollTop = 0;
                }
            }

            // 恢复原始 scroll-behavior，让后续用户滚动保持平滑
            if (html) html.style.scrollBehavior = originalScrollBehavior;
        };

        resetScroll();
        requestAnimationFrame(resetScroll);
        const timers = [50, 150, 300, 600].map((ms) => setTimeout(resetScroll, ms));

        return () => {
            timers.forEach(clearTimeout);
            if ("scrollRestoration" in history) {
                history.scrollRestoration = "auto";
            }
            // 确保恢复
            if (html) html.style.scrollBehavior = originalScrollBehavior;
        };
    }, []);

    // 进入性别选择页时重置内部滚动容器到顶部（修复移动端从首页弹窗进入后未置顶的问题）
    useEffect(() => {
        if (gender === null) {
            const html = document.documentElement;
            const originalScrollBehavior = html?.style?.scrollBehavior ?? "";

            const resetScroll = () => {
                if (html) html.style.scrollBehavior = "auto";

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

                if (html) html.style.scrollBehavior = originalScrollBehavior;
            };

            resetScroll();
            requestAnimationFrame(resetScroll);
            const timers = [50, 150, 300, 600].map((ms) => setTimeout(resetScroll, ms));
            return () => {
                timers.forEach(clearTimeout);
                if (html) html.style.scrollBehavior = originalScrollBehavior;
            };
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

    // 自动保存答案和步骤（带防抖，避免快速连续选择时频繁写入 localStorage）
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            if (Object.keys(answers).length > 0) {
                localStorage.setItem("advisor_answers", JSON.stringify(answers));
            }
            if (gender) {
                localStorage.setItem("advisor_step", String(currentStepIndex));
            }
        }, 300);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
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
            // 回退时重置质量检测基准，避免"填写过快"误判
            startStepIndex.current = currentStepIndex - 1;
            sessionStartTime.current = Date.now();
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

        // 检查测肤模式：纯问卷模式通过完整匹配链映射到全部 8 种派系
        const scanMode = localStorage.getItem("advisor_scan_mode");
        if (scanMode === "questionnaire") {
            const result = matchQuestionnairePersona(finalAnswers);
            // 持久化评分与派系结果，供下游页面（结果页/分享等）使用
            localStorage.setItem("advisor_result", JSON.stringify(result));
            router.push(result.route ? `/skin-types/${result.route}` : "/skin-types");
        } else {
            router.push("/face-scan");
        }
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
                    className="fixed top-0 left-0 w-full h-dvh z-0 flex flex-col bg-[#F5F2E9] overflow-hidden pointer-events-auto"
                >
                    {/* Top Bar */}
                    <div className="relative flex items-center justify-center pt-[calc(1.75rem+env(safe-area-inset-top,0px))] pb-7 px-4 md:px-12 lg:px-20 border-b border-[#3D4430]/5 z-20">
                        <button
                            onClick={() => router.push("/")}
                            className="absolute left-2 sm:left-4 md:left-12 lg:left-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95"
                            aria-label="回首页"
                        >
                            <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
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
                            className="absolute right-2 sm:right-4 md:right-12 lg:right-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95"
                            aria-label="回到首页"
                        >
                            <LogOut className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline text-[14px] font-medium tracking-wide">退出</span>
                        </button>
                    </div>

                    <div
                        ref={genderScrollRef}
                        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain w-full max-w-5xl mx-auto px-4 md:px-8"
                    >
                        <div className="h-full min-h-0 py-4 sm:py-0 flex flex-col items-center justify-center">
                            {aiConfigured === null ? (
                                <div className="flex items-center gap-2 text-[#5E5E5E]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    正在检查服务状态...
                                </div>
                            ) : aiConfigured === false && scanModeRef.current !== "questionnaire" ? (
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
                            ) : limitExceeded ? (
                                <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm text-center">
                                    <div className="text-4xl mb-4">⏳</div>
                                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-2">今日次数已用完</h3>
                                    <p className="text-sm text-[#5E5E5E] mb-6">{limitMessage}</p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button
                                            onClick={() => router.push("/")}
                                            className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                        >
                                            返回首页
                                        </button>
                                    </div>
                                </div>
                            ) : queueBusy && !queueDismissed ? (
                                <div className="w-full max-w-lg bg-amber-50/95 backdrop-blur-sm rounded-2xl p-6 border border-amber-200 shadow-sm text-center">
                                    <div className="text-3xl mb-3">⏳</div>
                                    <h3 className="text-base font-serif text-[#1A1A1A] mb-2">当前访问人数较多</h3>
                                    <p className="text-sm text-[#5E5E5E] mb-4">
                                        预计分析等待{queueWaitSeconds >= 60
                                            ? `约 ${Math.ceil(queueWaitSeconds / 60)} 分钟`
                                            : `约 ${queueWaitSeconds} 秒`}，
                                        您仍可继续，但结果可能需要稍等。
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button
                                            onClick={() => setQueueDismissed(true)}
                                            className="px-6 h-10 rounded-lg bg-[#8B7355] text-white hover:bg-[#7A6347] text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                        >
                                            继续测试
                                        </button>
                                        <button
                                            onClick={() => router.push("/")}
                                            className="px-6 h-10 rounded-lg border border-[#8B7355] text-[#8B7355] hover:bg-[#8B7355]/5 text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                        >
                                            稍后再来
                                        </button>
                                    </div>
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
                        className="hidden sm:flex justify-center pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] opacity-40 px-4"
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

    if (!currentQuestion) {
        return (
            <div className="fixed top-0 left-0 w-full h-dvh z-0 flex flex-col items-center justify-center bg-[#F5F2E9] gap-4 px-4">
                <p className="text-sm text-[#5E5E5E] tracking-wide">题目加载异常，请刷新页面或返回首页重试。</p>
                <button
                    onClick={() => router.push("/")}
                    className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                >
                    返回首页
                </button>
            </div>
        );
    }

    // 入口守卫：未同意隐私协议时显示友好提示
    if (accessDenied) {
        return (
            <div className="fixed top-0 left-0 w-full h-dvh z-0 flex flex-col items-center justify-center bg-[#F5F2E9] gap-4 px-4">
                <p className="text-sm text-[#5E5E5E] tracking-wide text-center leading-relaxed">请从首页同意隐私协议后开始测评。</p>
                <button
                    onClick={() => router.push("/")}
                    className="px-6 h-10 rounded-lg border border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                >
                    返回首页
                </button>
            </div>
        );
    }

    return (
        <div className="fixed top-0 left-0 w-full h-dvh z-0 flex flex-col bg-[#F5F2E9] text-[#1A1A1A] overflow-hidden pointer-events-auto">

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
                        <p className="text-sm text-[#5E5E5E] tracking-wide">
                            {scanModeRef.current === "questionnaire"
                                ? "正在分析你的肌肤派系..."
                                : "正在准备面部扫描..."}
                        </p>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Top Bar: Back & Logo & Exit */}
            <div className="relative flex items-center justify-center pt-[calc(1.75rem+env(safe-area-inset-top,0px))] pb-7 px-4 md:px-12 lg:px-20 z-20 shrink-0 border-b border-[#3D4430]/5">
                <button
                    onClick={handleBack}
                    className={cn(
                        "absolute left-2 sm:left-4 md:left-12 lg:left-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95",
                        (currentStepIndex === 0 && !gender) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                    aria-label={!gender ? "回首页" : "上一题"}
                >
                    <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
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
                    className="absolute right-2 sm:right-4 md:right-12 lg:right-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-[#3D4430]/70 hover:text-[#3D4430] transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95"
                >
                    <LogOut className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
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
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-hide relative w-full max-w-5xl mx-auto z-10 px-4 md:px-8 mb-4">
                <div className="min-h-full flex flex-col justify-start md:justify-center">
                    <AnimatePresence mode="wait" custom={direction}>
                        <m.div
                            key={currentStepIndex}
                            custom={direction}
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
            <div className="hidden sm:flex sm:justify-center pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] opacity-40 shrink-0 text-center px-4">
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
