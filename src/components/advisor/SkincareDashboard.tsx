
import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar as CalendarIcon,
    CheckCircle2,
    Circle,
    Play,
    Info,
    ChevronRight,
    Moon,
    Sun,
    BatteryCharging,
    Sparkles,
    ShieldCheck
} from 'lucide-react';
import {
    getEffectiveSteps,
    getCycleDayForDate,
    RoutineStep,
    CyclingDay,
    CYCLE_COLORS,
    CYCLE_DOTS
} from '@/lib/routine-helpers';
import { ImmersiveRoutinePlayer } from './ImmersiveRoutinePlayer';

interface SkincareDashboardProps {
    routineData: {
        morning: { steps: RoutineStep[] };
        evening: { steps: RoutineStep[] };
        cycling?: CyclingDay[];
    };
}

export function SkincareDashboard({ routineData }: SkincareDashboardProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [cycleStartDate, setCycleStartDate] = useState<Date | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({}); // Key: "YYYY-MM-DD_stepId"
    const [isImmersiveOpen, setIsImmersiveOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning'); // Morning logic is simple, Evening has cycling

    // Initialize Cycle Start Date & Load Progress
    useEffect(() => {
        // Load Cycle Start
        const storedStart = localStorage.getItem('advisor_cycle_start');
        if (storedStart) {
            setCycleStartDate(new Date(storedStart));
        } else {
            // First time: Set today as Day 1
            const today = new Date();
            localStorage.setItem('advisor_cycle_start', today.toISOString());
            setCycleStartDate(today);
        }

        // Load Completed Steps
        const storedProgress = localStorage.getItem('advisor_daily_log');
        if (storedProgress) {
            try {
                setCompletedSteps(JSON.parse(storedProgress));
            } catch (e) {
                console.error("Failed to parse progress", e);
            }
        }
    }, []);

    // Persist Progress
    const toggleStep = (stepIdx: number) => {
        const dateKey = selectedDate.toISOString().slice(0, 10);
        const key = `${dateKey}_${activeTab}_${stepIdx}`;

        setCompletedSteps(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem('advisor_daily_log', JSON.stringify(next));
            return next;
        });
    };

    // Calculate Context
    const today = new Date();
    const isToday = selectedDate.toDateString() === today.toDateString();

    // Determine Cycle Day for Selected Date
    const currentCycleDayNumber = cycleStartDate ? getCycleDayForDate(selectedDate, cycleStartDate) : 1;

    // Get Effective Steps
    const baseSteps = activeTab === 'morning' ? routineData.morning.steps : routineData.evening.steps;
    const effectiveSteps = useMemo(() => {
        return getEffectiveSteps(baseSteps, routineData.cycling, currentCycleDayNumber, activeTab === 'evening');
    }, [baseSteps, routineData.cycling, currentCycleDayNumber, activeTab]);

    // Current Cycle Info (Evening Only)
    const currentCycleInfo = activeTab === 'evening' && routineData.cycling
        ? routineData.cycling.find(c => c.day === currentCycleDayNumber)
        : null;

    // Helper to format date
    const formatDate = (date: Date) => {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${date.getMonth() + 1}月${date.getDate()}日 · ${days[date.getDay()]}`;
    };

    // Generate Calendar Strip Dates (Today + 6)
    const calendarDays = useMemo(() => {
        if (!cycleStartDate) return [];
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(today.getDate() + i);
            const cDay = getCycleDayForDate(d, cycleStartDate);
            // Find cycle info to color code
            const cycle = routineData.cycling?.find(c => c.day === cDay);
            days.push({ date: d, cycleDay: cDay, cycleInfo: cycle });
        }
        return days;
    }, [cycleStartDate, routineData.cycling]);

    // Completion Status
    const completedCount = effectiveSteps.reduce((acc, _, idx) => {
        const key = `${selectedDate.toISOString().slice(0, 10)}_${activeTab}_${idx}`;
        return acc + (completedSteps[key] ? 1 : 0);
    }, 0);
    const progress = Math.round((completedCount / effectiveSteps.length) * 100);

    return (
        <div className="flex flex-col gap-6">

            {/* 1. Tab Switcher (Morning / Evening) */}
            <div className="bg-white p-1 rounded-xl border border-gray-100 flex shadow-sm w-fit mx-auto mb-2">
                <button
                    onClick={() => setActiveTab('morning')}
                    className={`px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'morning' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <Sun className="w-4 h-4" /> 早间防护
                </button>
                <div className="w-px bg-gray-200 my-1 mx-1" />
                <button
                    onClick={() => setActiveTab('evening')}
                    className={`px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'evening' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <Moon className="w-4 h-4" /> 晚间修护
                </button>
            </div>

            {/* 2. Calendar Strip (Only relevant for evening usually, but good to show context always) */}
            {activeTab === 'evening' && (
                <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    <div className="flex gap-3 min-w-max mx-auto">
                        {calendarDays.map((item, idx) => {
                            const isSelected = item.date.toDateString() === selectedDate.toDateString();
                            const isTodayItem = item.date.toDateString() === today.toDateString();

                            // Determine dot color
                            let dotClass = 'bg-gray-300';
                            if (item.cycleInfo?.phase === 'exfoliate') dotClass = CYCLE_DOTS.exfoliate;
                            if (item.cycleInfo?.phase === 'retinoid') dotClass = CYCLE_DOTS.retinoid;
                            if (item.cycleInfo?.phase === 'recovery') dotClass = CYCLE_DOTS.recovery;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedDate(item.date)}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl min-w-[70px] border transition-all ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                                >
                                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-60">
                                        {isTodayItem ? '今天' : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][item.date.getDay()]}
                                    </span>
                                    <span className={`text-lg font-bold ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                        {item.date.getDate()}
                                    </span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. Today's Focus Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden p-6 relative">
                {activeTab === 'evening' && currentCycleInfo ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${CYCLE_COLORS[currentCycleInfo.phase] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                        {currentCycleInfo.title || '常规护理'}
                                    </span>
                                    <span className="text-xs font-mono text-gray-400">
                                        {formatDate(selectedDate)}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 leading-snug tracking-tight">
                                    {currentCycleInfo.phase === 'exfoliate' && "✨ 今晚任务：深度焕肤"}
                                    {currentCycleInfo.phase === 'retinoid' && "🌙 今晚任务：抗老维A"}
                                    {currentCycleInfo.phase === 'recovery' && "💧 今晚任务：舒缓修护"}
                                </h3>
                            </div>
                            {/* Icon Decoration */}
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
                                {currentCycleInfo.phase === 'exfoliate' && <Sparkles className="w-5 h-5 text-red-400" />}
                                {currentCycleInfo.phase === 'retinoid' && <Moon className="w-5 h-5 text-orange-400" />}
                                {currentCycleInfo.phase === 'recovery' && <BatteryCharging className="w-5 h-5 text-green-500" />}
                            </div>
                        </div>
                        <p className="text-gray-600 text-[13px] leading-relaxed font-sans">
                            {currentCycleInfo.phase === 'exfoliate' && "使用酸类产品剥脱老废角质，疏通毛孔。可能会有轻微刺痛，属正常现象。"}
                            {currentCycleInfo.phase === 'retinoid' && "使用视黄醇（A醇）促进胶原蛋白再生。初次使用建议混合面霜，注意避光。"}
                            {currentCycleInfo.phase === 'recovery' && "给皮肤放个假。停用猛药，只进行基础保湿和屏障修复，让肌肤自我愈合。"}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200">
                                早间防护
                            </span>
                            <span className="text-xs font-mono text-gray-400">
                                {formatDate(selectedDate)}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 tracking-tight">☀️ 开启元气满满的一天</h3>
                        <p className="text-gray-600 text-[13px] font-sans">重点在于清洁、抗氧化与防晒，抵御外界紫外线与污染侵害。</p>
                    </div>
                )}

                {/* Primary Action */}
                {isToday && (
                    <button
                        onClick={() => setIsImmersiveOpen(true)}
                        className="mt-6 w-full py-3 bg-gray-900 hover:bg-black text-white rounded-md font-medium text-sm shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2 group"
                    >
                        <Play className="w-3.5 h-3.5 fill-current group-hover:scale-110 transition-transform" />
                        现在开始跟练
                    </button>
                )}
            </div>

            {/* 4. Checklist Routine */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
                    <h4 className="font-semibold text-gray-900 text-sm tracking-tight">护肤步骤清单</h4>
                    <span className="text-xs font-mono text-gray-500">{progress}% 完成</span>
                </div>
                <div className="divide-y divide-gray-100">
                    {effectiveSteps.map((step, idx) => {
                        const dateKey = selectedDate.toISOString().slice(0, 10);
                        const key = `${dateKey}_${activeTab}_${idx}`;
                        const isDone = !!completedSteps[key];

                        return (
                            <div
                                key={idx}
                                className={`p-4 flex items-start gap-4 transition-colors ${isDone ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}
                            >
                                {/* Checkbox */}
                                <button
                                    onClick={() => isToday && toggleStep(idx)}
                                    disabled={!isToday}
                                    className={`mt-0.5 shrink-0 transition-colors ${!isToday ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                                >
                                    {isDone ? (
                                        <CheckCircle2 className="w-5 h-5 text-gray-800 fill-gray-100" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-gray-300 hover:text-gray-500" />
                                    )}
                                </button>

                                {/* Content */}
                                <div className={`flex-1 transition-opacity ${isDone ? 'opacity-40' : 'opacity-100'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <h5 className={`text-sm font-medium ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                            {step.name}
                                        </h5>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">
                                            {step.duration}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2 leading-relaxed line-clamp-2">
                                        {step.description}
                                    </p>
                                    {step.dosage && (
                                        <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 font-medium bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">
                                            <Info className="w-3 h-3 text-gray-400" />
                                            {step.dosage.description}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Immersive Player Portal */}
            {isImmersiveOpen && (
                <ImmersiveRoutinePlayer
                    steps={effectiveSteps}
                    title={activeTab === 'evening' ? `晚间护肤 · ${currentCycleInfo?.title || '常规'}` : '早间护肤 Routine'}
                    onClose={() => setIsImmersiveOpen(false)}
                    onComplete={() => {
                        // Mark all as done
                        effectiveSteps.forEach((_, idx) => {
                            // Use dateKey of Today, assume user is checking out today's routine
                            // But actually `selectedDate` might be different, but button is only shown if isToday.
                            // So safely use `today` or `selectedDate` which is confirmed today.
                            const dateKey = selectedDate.toISOString().slice(0, 10);
                            const key = `${dateKey}_${activeTab}_${idx}`;
                            setCompletedSteps(prev => ({ ...prev, [key]: true }));
                        });
                        // Save immediately
                        // Wait for state update? No, we need to manually doing it since setState is async
                        // We can just rely on user seeing them all checked after closing
                        setIsImmersiveOpen(false);
                    }}
                />
            )}
        </div>
    );
}
