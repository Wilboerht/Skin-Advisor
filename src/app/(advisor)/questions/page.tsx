"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_QUESTIONS, type Question } from "@/config/questions";
import { QuestionStep } from "@/components/advisor/QuestionStep";
import Image from "next/image";
import Link from "next/link";
import { GenderSelection } from "@/components/advisor/GenderSelection";

import { m, AnimatePresence } from "framer-motion";
import { ChevronLeft, LogOut, Loader2 } from "lucide-react";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { scheduleFaceModelPreload } from "@/lib/preload-models";
import { runWhenIdle } from "@/lib/idle";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useNavPush } from "@/hooks/use-nav-push";
import { z } from "zod";

const safeStorage = {
    get: (key: string) => {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set: (key: string, value: string) => {
        try { localStorage.setItem(key, value); } catch (e) { console.warn("Failed to write to localStorage", e); }
    },
    remove: (key: string) => {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
    },
};

const questionOptionSchema = z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    emoji: z.string().optional(),
});

const questionSchema = z.object({
    id: z.string(),
    fieldName: z.string(),
    question: z.string(),
    type: z.enum(["single", "multiple"]),
    options: z.array(questionOptionSchema).min(1),
    subtext: z.string().optional(),
    dependsOn: z.object({
        field: z.string(),
        value: z.union([z.string(), z.array(z.string())]),
        operator: z.enum(["equals", "notEquals", "contains"]).optional(),
    }).optional(),
    skippable: z.boolean().optional(),
});

const questionListSchema = z.array(questionSchema);

export default function QuestionsPage() {
    const router = useRouter();
    // 预取首页与扫脸页路由，避免顶部栏按钮冷导航"点了没反应"；isNavigating 提供即时反馈
    const { push: navPush, isPending: isNavigating } = useNavPush(["/", "/face-scan"]);
    const toast = useToast();
    const [gender, setGender] = useState<"female" | "male" | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
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
    // 自动切题定时器（单选/互斥多选 300ms 后自动跳转），用于清理与防重入
    const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // 同步跟踪最新 answers，供自动切题定时器回调校验（闭包捕获的是旧 state）
    const answersRef = useRef(answers);
    const [restoredStepIndex, setRestoredStepIndex] = useState<number | null>(null);

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
    // 空闲调度：内部会加载 FingerprintJS 并计算指纹（主线程任务），
    // 推迟到空闲时执行，避免进页瞬间挤占顶部栏按钮的点击响应
    useEffect(() => {
        const cancelIdle = runWhenIdle(() => {
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
        }, { timeout: 2000, fallbackDelay: 800 });
        return cancelIdle;
    }, []);

    // 从 API 获取问题列表（数据库优先，静态降级）

    const [allQuestions, setAllQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

    const fetchQuestions = useCallback(async () => {
        setIsLoadingQuestions(true);
        try {
            const res = await fetch("/api/advisor/questions");
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }
            const data: unknown = await res.json();
            const parsed = questionListSchema.safeParse(data);
            if (!parsed.success || parsed.data.length === 0) {
                console.warn("Questions API returned invalid payload, using defaults:", parsed.error?.issues);
                setAllQuestions(DEFAULT_QUESTIONS);
                return;
            }
            setAllQuestions(parsed.data);
        } catch (e) {
            console.error("Failed to fetch questions from API, using defaults:", e);
            setAllQuestions(DEFAULT_QUESTIONS);
        } finally {
            setIsLoadingQuestions(false);
        }
    }, []);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    // 入口守卫：必须通过首页引导弹窗后才能进入问卷
    const [accessDenied, setAccessDenied] = useState(false);
    useEffect(() => {
        try {
            const hasConsent = localStorage.getItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
            const hasAnswers = localStorage.getItem(STORAGE_KEYS.ADVISOR_ANSWERS);
            if (!hasConsent && !hasAnswers) {
                setAccessDenied(true);
            }
        } catch {
            setAccessDenied(true);
        }
    }, [router]);

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

    const questions = getFilteredQuestions(answers, gender);
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

    // 每次切题时重置滚动位置到顶部（behavior: "instant" 避免被全局 scroll-behavior:smooth 变成动画滚动）
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
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

    // 恢复之前的状态（刷新或直接导航时，只要存在有效进度且同意隐私协议就恢复）
    const resumeSavedProgress = useCallback(() => {
        const hasConsent = safeStorage.get(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
        if (!hasConsent) return;

        const savedAnswers = safeStorage.get(STORAGE_KEYS.ADVISOR_ANSWERS);
        const savedGender = safeStorage.get(STORAGE_KEYS.ADVISOR_GENDER);
        const savedStep = safeStorage.get(STORAGE_KEYS.ADVISOR_STEP);

        if (!savedAnswers && !savedGender) return;

        try {
            let initialAnswers: Record<string, unknown> = {};
            if (savedAnswers) {
                initialAnswers = JSON.parse(savedAnswers) as Record<string, unknown>;
            }

            if (savedGender === "female" || savedGender === "male") {
                setGender(savedGender);
                // Ensure gender is in answers so dependsOn logic works
                initialAnswers = { ...initialAnswers, gender: savedGender };
            }

            setAnswers(initialAnswers);

            if (savedStep) {
                const stepIndex = parseInt(savedStep, 10);
                if (!isNaN(stepIndex) && stepIndex >= 0) {
                    setRestoredStepIndex(stepIndex);
                }
            }

            // 重置质量检测计时器
            sessionStartTime.current = Date.now();
            startStepIndex.current = 0;
        } catch (e) {
            console.error("Failed to restore saved progress:", e);
        }
    }, []);

    useEffect(() => {
        resumeSavedProgress();
    }, [resumeSavedProgress]);

    // 在问题列表加载完成后再应用恢复的步骤，并自动限制在有效范围内
    useEffect(() => {
        if (restoredStepIndex === null || isLoadingQuestions) return;
        const validIndex = Math.max(0, Math.min(restoredStepIndex, questions.length - 1));
        setCurrentStepIndex(validIndex);
        startStepIndex.current = validIndex;
        sessionStartTime.current = Date.now();
        setRestoredStepIndex(null);
    }, [restoredStepIndex, isLoadingQuestions, questions.length]);

    // 自动保存答案和步骤（带防抖，避免快速连续选择时频繁写入 localStorage）
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flushAnswers = useCallback(() => {
        if (Object.keys(answers).length > 0) {
            safeStorage.set(STORAGE_KEYS.ADVISOR_ANSWERS, JSON.stringify(answers));
        }
        if (gender) {
            safeStorage.set(STORAGE_KEYS.ADVISOR_STEP, String(currentStepIndex));
        }
    }, [answers, currentStepIndex, gender]);

    // 用 ref 持有最新 flushAnswers，避免卸载/页面隐藏 effect 因 answers 变化而频繁重注册
    const flushRef = useRef(flushAnswers);
    useEffect(() => {
        flushRef.current = flushAnswers;
    });

    // 同步最新 answers 到 ref，供自动切题定时器回调校验
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    useEffect(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            flushAnswers();
        }, 300);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [answers, currentStepIndex, gender, flushAnswers]);

    // 在页面关闭或隐藏前同步刷新防抖中的保存，避免最新答案丢失
    useEffect(() => {
        const handleBeforeUnload = () => flushRef.current();
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") flushRef.current();
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    // 组件卸载时再次 flush（安全网），同时清理未触发的自动切题定时器
    useEffect(() => {
        return () => {
            flushRef.current();
            if (autoAdvanceTimerRef.current) {
                clearTimeout(autoAdvanceTimerRef.current);
                autoAdvanceTimerRef.current = null;
            }
        };
    }, []);

    const handleGenderSelect = (selectedGender: "female" | "male") => {
        setGender(selectedGender);
        setAnswers(prev => ({ ...prev, gender: selectedGender }));
        safeStorage.set(STORAGE_KEYS.ADVISOR_GENDER, selectedGender);
        // 面部识别模型改为空闲时预加载：face-api/TF.js 的解析编译是主线程长任务，
        // 同步启动会卡住紧随其后的"上一题"/"退出"点击（交互优先于预加载）
        scheduleFaceModelPreload();
        // 追踪问卷开始（从选择性别开始算）
        if (!hasTrackedStart.current) {
            trackQuestionnaireStart();
            hasTrackedStart.current = true;
            // 记录开始时间
            sessionStartTime.current = Date.now();
        }
    };

    // 调度自动切题：回调里通过 answersRef 校验该题答案未被改动（闭包捕获的是旧 state，必须读 ref），
    // 防止 300ms 内改选/回退后 pending 的定时器把用户推到错误位置
    const scheduleAutoAdvance = (fieldName: string, expected: unknown, newAnswers: Record<string, unknown>) => {
        autoAdvanceTimerRef.current = setTimeout(() => {
            autoAdvanceTimerRef.current = null;
            const latest = answersRef.current[fieldName];
            if (JSON.stringify(latest ?? null) !== JSON.stringify(expected ?? null)) return;
            handleNextWithAnswers(newAnswers);
        }, 300);
    };

    const handleSelect = (value: string) => {
        if (!currentQuestion) return;

        // 先清除上一个未触发的自动切题，避免 300ms 内改选另一个选项导致跳两题
        if (autoAdvanceTimerRef.current) {
            clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
        }

        const newAnswers = { ...answers };

        if (currentQuestion.type === "multiple") {
            let currentVal = (newAnswers[currentQuestion.fieldName] as string[]) || [];
            const exclusiveValues = ["unknown", "none"];

            if (exclusiveValues.includes(value)) {
                // 如果选择了互斥选项（如“不太清楚”或“无”），仅保留该选项
                newAnswers[currentQuestion.fieldName] = [value];

                // 互斥选项视作单选，选完后给个小延迟自动跳转
                scheduleAutoAdvance(currentQuestion.fieldName, [value], newAnswers);
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
            scheduleAutoAdvance(currentQuestion.fieldName, value, newAnswers);
        }

        setAnswers(newAnswers);
    };

    const handleBack = () => {
        // 清除未触发的自动切题，避免点"上一题"后又被 pending 的定时器推回去
        if (autoAdvanceTimerRef.current) {
            clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
        }
        if (currentStepIndex > 0) {
            setDirection(-1);
            setCurrentStepIndex(prev => prev - 1);
            // 回退时重置质量检测基准，避免"填写过快"误判
            startStepIndex.current = currentStepIndex - 1;
            sessionStartTime.current = Date.now();
        } else {
            // 如果在第一题点击返回，回到性别选择
            setGender(null);
            safeStorage.remove(STORAGE_KEYS.ADVISOR_GENDER);
        }
    };

    // 真正执行提交的逻辑
    const processSubmission = (finalAnswers: Record<string, unknown>) => {
        setIsSubmitting(true);
        safeStorage.set(STORAGE_KEYS.ADVISOR_ANSWERS, JSON.stringify(finalAnswers));
        trackQuestionnaireComplete(finalAnswers);
        navPush("/face-scan");
    };

    // 辅助函数：处理带特定答案的完成逻辑
    const handleNextWithAnswers = (currentAnswers: Record<string, unknown>) => {
        const nextQs = getFilteredQuestions(currentAnswers, gender);
        if (currentStepIndex < nextQs.length - 1) {
            setDirection(1);
            setCurrentStepIndex(prev => prev + 1);
        } else {
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
                            onClick={() => navPush("/")}
                            disabled={isNavigating}
                            className="absolute left-2 sm:left-4 md:left-12 lg:left-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-brand-charcoal/60 hover:text-brand-charcoal transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95 disabled:opacity-40"
                            aria-label="回首页"
                        >
                            <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline text-[14px] font-medium tracking-[0.1em]">回首页</span>
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
                            onClick={() => navPush("/")}
                            disabled={isNavigating}
                            className="absolute right-2 sm:right-4 md:right-12 lg:right-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-brand-charcoal/60 hover:text-brand-charcoal transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95 disabled:opacity-40"
                            aria-label="回到首页"
                        >
                            <LogOut className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
                            <span className="hidden sm:inline text-[14px] font-medium tracking-[0.1em]">退出</span>
                        </button>
                    </div>

                    <div
                        ref={genderScrollRef}
                        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain w-full max-w-5xl mx-auto px-4 md:px-8"
                    >
                        <div className="h-full min-h-0 py-4 sm:py-0 flex flex-col items-center justify-center">
                            {aiConfigured === null ? (
                                <div className="flex items-center gap-2 text-brand-charcoal/60">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    正在检查服务状态...
                                </div>
                            ) : aiConfigured === false ? (
                                <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm text-center">
                                    <h3 className="text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">敬请期待</h3>
                                    <p className="text-sm text-brand-charcoal/60 font-light mb-6">{configMessage}</p>
                                    <button
                                        onClick={() => navPush("/")}
                                        className="px-6 h-10 rounded-lg border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                    >
                                        返回首页
                                    </button>
                                </div>
                            ) : limitExceeded ? (
                                <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-[#E8E2D9] shadow-sm text-center">
                                    <div className="text-4xl mb-4">⏳</div>
                                    <h3 className="text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">今日次数已用完</h3>
                                    <p className="text-sm text-brand-charcoal/60 font-light mb-6">{limitMessage}</p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button
                                            onClick={() => navPush("/")}
                                            className="px-6 h-10 rounded-lg border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                        >
                                            返回首页
                                        </button>
                                    </div>
                                </div>
                            ) : queueBusy && !queueDismissed ? (
                                <div className="w-full max-w-lg bg-amber-50/95 backdrop-blur-sm rounded-2xl p-6 border border-amber-200 shadow-sm text-center">
                                    <div className="text-3xl mb-3">⏳</div>
                                    <h3 className="text-base font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">当前访问人数较多</h3>
                                    <p className="text-sm text-brand-charcoal/60 font-light mb-4">
                                        预计分析等待{queueWaitSeconds >= 60
                                            ? `约 ${Math.ceil(queueWaitSeconds / 60)} 分钟`
                                            : `约 ${queueWaitSeconds} 秒`}，
                                        您仍可继续，但结果可能需要稍等。
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button
                                            onClick={() => setQueueDismissed(true)}
                                            className="px-6 h-10 rounded-lg bg-brand-charcoal text-white hover:bg-brand-charcoal/90 text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                        >
                                            继续测试
                                        </button>
                                        <button
                                            onClick={() => navPush("/")}
                                            className="px-6 h-10 rounded-lg border border-brand-charcoal/60 text-brand-charcoal/60 hover:bg-brand-charcoal/[0.07] text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                                        >
                                            稍后再来
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <GenderSelection onSelect={handleGenderSelect} selectedGender={gender} />
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.2, delay: 1 }}
                        className="hidden sm:flex justify-center pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-4"
                    >
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center text-[10px] sm:text-[11px] font-light text-brand-charcoal/[0.48] leading-tight">
                            <p className="tracking-[0.1em] md:tracking-[0.15em]">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                            <span className="hidden sm:inline text-brand-charcoal/20">·</span>
                            <div className="hidden sm:flex items-center gap-4 tracking-[0.12em]">
                                <Link href="https://nihplod.cn/privacy" className="transition-colors duration-300 hover:text-brand-charcoal/70">隐私政策</Link>
                                <span className="text-brand-charcoal/20">·</span>
                                <Link href="https://nihplod.cn/terms" className="transition-colors duration-300 hover:text-brand-charcoal/70">服务条款</Link>
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
                <p className="text-sm text-brand-charcoal/60 font-light tracking-wide">题目加载异常，请刷新页面或返回首页重试。</p>
                <button
                    onClick={() => navPush("/")}
                    className="px-6 h-10 rounded-lg border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
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
                <p className="text-sm text-brand-charcoal/60 font-light tracking-wide text-center leading-relaxed">请从首页同意隐私协议后开始测评。</p>
                <button
                    onClick={() => navPush("/")}
                    className="px-6 h-10 rounded-lg border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300"
                >
                    返回首页
                </button>
            </div>
        );
    }

    return (
        <div className="fixed top-0 left-0 w-full h-dvh z-0 flex flex-col bg-[#F5F2E9] text-brand-charcoal overflow-hidden pointer-events-auto">

            {/* 提交中加载遮罩 */}
            <AnimatePresence>
                {isSubmitting && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-[#F5F2E9]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                    >
                        <Loader2 className="w-8 h-8 text-brand-charcoal animate-spin" />
                                <p className="text-sm text-brand-charcoal/60 font-light tracking-wide">
                                    正在准备面部扫描...
                                </p>
                            </m.div>
                )}
            </AnimatePresence>

            {/* Top Bar: Back & Logo & Exit */}
            <div className="relative flex items-center justify-center pt-[calc(1.75rem+env(safe-area-inset-top,0px))] pb-7 px-4 md:px-12 lg:px-20 z-20 shrink-0 border-b border-[#3D4430]/5">
                <button
                    onClick={handleBack}
                    className={cn(
                        "absolute left-2 sm:left-4 md:left-12 lg:left-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-brand-charcoal/60 hover:text-brand-charcoal transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95",
                        (currentStepIndex === 0 && !gender) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                    aria-label={!gender ? "回首页" : "上一题"}
                >
                    <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
                    <span className="hidden sm:inline text-[14px] font-medium tracking-[0.1em]">
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
                    className="absolute right-2 sm:right-4 md:right-12 lg:right-20 min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 text-brand-charcoal/60 hover:text-brand-charcoal transition-colors rounded-md hover:bg-[#3D4430]/5 touch-manipulation active:scale-95"
                >
                    <LogOut className="w-6 h-6 sm:w-5 sm:h-5" strokeWidth={1.5} />
                    <span className="hidden sm:inline text-[14px] font-medium tracking-[0.1em]">退出</span>
                </button>
            </div>


            {/* Main Content Area */}
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-hide relative w-full max-w-5xl mx-auto z-10 px-4 md:px-8 mb-4">
                <div className="min-h-full flex flex-col justify-start md:justify-center">
                    <AnimatePresence mode="wait" custom={direction}>
                        <m.div
                            key={currentStepIndex}
                            custom={direction}
                            initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            // 滑出中的旧题不再响应点击，避免 iOS 上 tap 命中位移中的选项
                            exit={{ opacity: 0, x: direction > 0 ? -20 : 20, pointerEvents: "none" }}
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
            <div className="hidden sm:flex sm:justify-center pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] shrink-0 text-center px-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-light text-brand-charcoal/[0.48] leading-tight">
                    <p className="tracking-[0.1em] md:tracking-[0.15em]">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
                    <span className="hidden sm:inline text-brand-charcoal/20">·</span>
                    <div className="hidden sm:flex items-center gap-4 tracking-[0.12em]">
                        <Link href="https://nihplod.cn/privacy" className="transition-colors duration-300 hover:text-brand-charcoal/70">隐私政策</Link>
                        <span className="text-brand-charcoal/20">·</span>
                        <Link href="https://nihplod.cn/terms" className="transition-colors duration-300 hover:text-brand-charcoal/70">服务条款</Link>
                    </div>
                </div>
            </div>


            {/* Exit Modal */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="exit-modal-title"
                        tabIndex={-1}
                    >
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
                            tabIndex={-1}
                        >
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <div className="sm:w-[60%] text-center sm:text-left">
                                    <h3 id="exit-modal-title" className="text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-3 sm:mb-2">退出测试？</h3>
                                    <p className="text-sm text-brand-charcoal/60 font-light leading-relaxed">
                                        您的进度已自动保存，下次返回可直接从此处继续。
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:gap-2 shrink-0 w-full sm:w-[40%]">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="px-6 h-10 rounded-lg border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        继续测试
                                    </button>
                                    <button
                                        onClick={() => navPush("/")}
                                        className="px-6 h-10 rounded-lg border border-[#E8E2D9] text-brand-charcoal/60 hover:text-brand-charcoal hover:border-[#D9D0C3] text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
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
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="quality-modal-title"
                        tabIndex={-1}
                    >
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
                            tabIndex={-1}
                        >
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <div className="sm:w-[60%] text-center sm:text-left">
                                    <h3 id="quality-modal-title" className="text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-3 sm:mb-2">确认提交？</h3>
                                    <p className="text-sm text-brand-charcoal/60 font-light leading-relaxed">
                                        我们检测到您的填写速度较快。建议您再次核对，确保 AI 能为您提供<span className="text-brand-charcoal font-medium"> 最精准 </span>的分析结果。
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
                                        className="px-6 h-10 rounded-lg border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
                                    >
                                        我已确认，去提交
                                    </button>
                                    <button
                                        onClick={() => setShowQualityWarning(false)}
                                        className="px-6 h-10 rounded-lg border border-[#E8E2D9] text-brand-charcoal/60 hover:text-brand-charcoal hover:border-[#D9D0C3] text-[13px] font-medium tracking-[0.1em] transition-all duration-300 whitespace-nowrap w-full"
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
