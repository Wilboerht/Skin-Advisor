
import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
    Calendar as CalendarIcon,
    CheckCircle2,
    Circle,
    Play,
    Info,
    ChevronLeft,
    ChevronRight,
    Moon,
    Sun,
    BatteryCharging,
    Sparkles,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date()); // For calendar navigation
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

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

    // Generate Monthly Calendar Grid Data
    const monthCalendarData = useMemo(() => {
        if (!cycleStartDate) return { weeks: [], weekDays: ['日', '一', '二', '三', '四', '五', '六'] };

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        // First day of month & total days
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0=Sunday

        // Build grid: 6 weeks max (42 cells)
        const cells: Array<{ date: Date | null; cycleDay: number; cycleInfo: CyclingDay | undefined }> = [];

        // Leading empty cells
        for (let i = 0; i < startDayOfWeek; i++) {
            cells.push({ date: null, cycleDay: 0, cycleInfo: undefined });
        }

        // Actual days
        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const cDay = getCycleDayForDate(d, cycleStartDate);
            const cycle = routineData.cycling?.find(c => c.day === cDay);
            cells.push({ date: d, cycleDay: cDay, cycleInfo: cycle });
        }

        // Split into weeks (7 days each)
        const weeks: typeof cells[] = [];
        for (let i = 0; i < cells.length; i += 7) {
            weeks.push(cells.slice(i, i + 7));
        }

        return { weeks, weekDays: ['日', '一', '二', '三', '四', '五', '六'] };
    }, [cycleStartDate, currentMonth, routineData.cycling]);

    // Today's Global Progress (for Header)
    const todayProgress = useMemo(() => {
        const todayStr = today.toISOString().slice(0, 10);
        const todayCDay = cycleStartDate ? getCycleDayForDate(today, cycleStartDate) : 1;
        const todayBase = activeTab === 'morning' ? routineData.morning.steps : routineData.evening.steps;
        const todayEff = getEffectiveSteps(todayBase, routineData.cycling, todayCDay, activeTab === 'evening');
        const todayDone = todayEff.reduce((acc, _, idx) => {
            const key = `${todayStr}_${activeTab}_${idx}`;
            return acc + (completedSteps[key] ? 1 : 0);
        }, 0);
        return todayEff.length > 0 ? Math.round((todayDone / todayEff.length) * 100) : 0;
    }, [today, cycleStartDate, routineData, activeTab, completedSteps]);

    const progressMessage = useMemo(() => {
        if (todayProgress === 0) return "新的一天，从呵护肌肤开始 ✨";
        if (todayProgress < 100) return "进行中，离美肌更近一步 💪";
        return "今日任务已满分完成，太棒了 🌟";
    }, [todayProgress]);

    // Current Context Progress
    const completedCount = effectiveSteps.reduce((acc, _, idx) => {
        const key = `${selectedDate.toISOString().slice(0, 10)}_${activeTab}_${idx}`;
        return acc + (completedSteps[key] ? 1 : 0);
    }, 0);
    const progress = effectiveSteps.length > 0 ? Math.round((completedCount / effectiveSteps.length) * 100) : 0;

    return (
        <div className="flex h-full w-full bg-[#fdfdfd] overflow-hidden select-none">
            {/* ===== LEFT SIDEBAR: Navigation & Calendar ===== */}
            <aside className="w-[340px] flex-shrink-0 border-r border-[#E9E9E7] bg-[#FAFAFA] flex flex-col relative z-20">
                {/* Branding Area */}
                <div className="px-8 h-[88px] flex items-center border-b border-[#E9E9E7]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex-shrink-0">
                            <Image
                                src="/apple-touch-icon.png"
                                alt="Logo"
                                width={40}
                                height={40}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <h2 className="text-[19px] font-bold text-[#37352F] tracking-tight">护肤指挥中心</h2>
                    </div>
                </div>

                {/* Calendar Section */}
                <div className="flex-1 overflow-y-auto px-8 pt-6 pb-4 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="mb-8">
                        {/* Month Nav */}
                        <div className="flex items-center justify-between mb-6 px-1">
                            <h3 className="text-[15px] font-bold text-[#37352F]">
                                {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                            </h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                    className="p-1.5 rounded-lg hover:bg-[#F1F1EF] text-[#787774] hover:text-[#37352F] transition-all border border-transparent hover:border-[#E9E9E7]"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                    className="p-1.5 rounded-lg hover:bg-[#F1F1EF] text-[#787774] hover:text-[#37352F] transition-all border border-transparent hover:border-[#E9E9E7]"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Weekday Grid */}
                        <div className="grid grid-cols-7 mb-3">
                            {['日', '一', '二', '三', '四', '五', '六'].map((day, idx) => (
                                <div key={idx} className="text-center text-[11px] font-bold text-[#787774]/50 uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="space-y-1.5">
                            {monthCalendarData.weeks.map((week, weekIdx) => (
                                <div key={weekIdx} className="grid grid-cols-7 gap-1.5">
                                    {week.map((cell, dayIdx) => {
                                        if (!cell.date) return <div key={dayIdx} className="aspect-square" />;

                                        const isSelected = cell.date.toDateString() === selectedDate.toDateString();
                                        const isTodayCell = cell.date.toDateString() === today.toDateString();
                                        const cellDateOnly = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
                                        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                        const isPast = cellDateOnly < todayDateOnly;

                                        // Completion Logic
                                        const dateKey = cell.date.toISOString().slice(0, 10);
                                        const hasAnyCompletion = Object.keys(completedSteps).some(
                                            key => key.startsWith(dateKey) && completedSteps[key]
                                        );

                                        // Color Coding
                                        let dotClass = '';
                                        if (activeTab === 'evening' && cell.cycleInfo) {
                                            dotClass = CYCLE_DOTS[cell.cycleInfo.phase] || '';
                                        } else if (activeTab === 'morning') {
                                            dotClass = 'bg-amber-400';
                                        }

                                        return (
                                            <button
                                                key={dayIdx}
                                                onClick={() => setSelectedDate(cell.date!)}
                                                className={`
                                                    relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-300
                                                    ${isSelected
                                                        ? 'bg-[#E6F3F7] text-[#337EA9] font-bold shadow-sm ring-1 ring-[#337EA9]/40 scale-105'
                                                        : isTodayCell
                                                            ? 'bg-[#F1F1EF] text-[#37352F] font-bold'
                                                            : 'text-[#787774] hover:bg-[#F1F1EF]'
                                                    }
                                                `}
                                            >
                                                <span className="text-[14px] relative z-10">{cell.date.getDate()}</span>

                                                {/* Status Dot/Indicator */}
                                                <div className="absolute bottom-1.5 flex gap-0.5">
                                                    {dotClass && (
                                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-[#337EA9]' : dotClass}`} />
                                                    )}
                                                </div>

                                                {/* Selected Glow */}
                                                {isSelected && (
                                                    <div className="absolute inset-0 rounded-xl bg-[#337EA9]/5"></div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats or Legend (Optional footer of sidebar) */}
                    <div className="mt-auto pt-6 border-t border-[#E9E9E7]">
                        <div className="bg-[#F1F1EF]/50 rounded-2xl p-4 border border-[#E9E9E7]/50">
                            <h4 className="text-[11px] font-bold text-[#787774] uppercase tracking-widest mb-3">周期图例</h4>
                            <div className="space-y-2.5">
                                {activeTab === 'evening' ? (
                                    <>
                                        <div className="flex items-center gap-2.5 text-[12px] text-[#37352F]">
                                            <div className="w-2 h-2 rounded-full bg-[#D44C47]" /> <span>深度焕肤夜</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-[12px] text-[#37352F]">
                                            <div className="w-2 h-2 rounded-full bg-[#D9730D]" /> <span>抗老维A夜</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-[12px] text-[#37352F]">
                                            <div className="w-2 h-2 rounded-full bg-[#448361]" /> <span>舒缓修护夜</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2.5 text-[12px] text-[#37352F]">
                                        <div className="w-2 h-2 rounded-full bg-[#CB912F]" /> <span>日常日间防护</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ===== RIGHT CONTENT AREA: Tasks & Details ===== */}
            <main className="flex-1 flex flex-col h-full bg-white overflow-hidden relative">

                {/* 1. Integrated Header: Simplified & Clean */}
                <header className="flex-shrink-0 bg-white border-b border-[#E9E9E7] px-10 h-[88px] flex items-center justify-between z-20">
                    <div className="flex items-center gap-10">
                        {/* Minimalist Tab Switcher */}
                        <div className="bg-[#F1F1EF] p-1 rounded-xl flex items-center border border-[#E9E9E7]/50">
                            <button
                                onClick={() => setActiveTab('morning')}
                                className={`
                                    flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-bold transition-all
                                    ${activeTab === 'morning' ? 'bg-white text-[#37352F] shadow-sm' : 'text-[#787774] hover:text-[#37352F]'}
                                `}
                            >
                                <Sun className={`w-3.5 h-3.5 ${activeTab === 'morning' ? 'text-[#D9730D]' : ''}`} />
                                <span>早间</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('evening')}
                                className={`
                                    flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-bold transition-all
                                    ${activeTab === 'evening' ? 'bg-white text-[#37352F] shadow-sm' : 'text-[#787774] hover:text-[#37352F]'}
                                `}
                            >
                                <Moon className={`w-3.5 h-3.5 ${activeTab === 'evening' ? 'text-[#337EA9]' : ''}`} />
                                <span>晚间</span>
                            </button>
                        </div>

                        {/* Today's Global Progress */}
                        <div className="flex items-center gap-4">
                            <div className="relative w-11 h-11 flex items-center justify-center">
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle cx="22" cy="22" r="19" fill="transparent" stroke="#F1F1EF" strokeWidth="2.5" />
                                    <circle
                                        cx="22" cy="22" r="19"
                                        fill="transparent"
                                        stroke="#337EA9"
                                        strokeWidth="2.5"
                                        strokeDasharray={119.3}
                                        strokeDashoffset={119.3 - (119.3 * todayProgress) / 100}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                    />
                                </svg>
                                <span className="text-[11px] font-bold text-[#37352F] font-mono">{todayProgress}%</span>
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[11px] font-bold text-[#37352F] tracking-tight">今日进度</span>
                                <span className="text-[11px] text-[#787774] font-medium opacity-60">
                                    {progressMessage}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <div className="w-8" /> {/* Spacer for external Close button */}
                    </div>
                </header>

                {/* 2. Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-10 py-8 scrollbar-hide space-y-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                    {/* 2. Refined Phase Focus Area */}
                    <div className="mb-10 flex items-center justify-between px-1">
                        <div className="flex items-center gap-5">
                            <div className={`
                                w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500
                                ${activeTab === 'evening'
                                    ? (currentCycleInfo?.phase === 'exfoliate' ? 'bg-[#F9F2F5] text-[#C14C8A]' : currentCycleInfo?.phase === 'retinoid' ? 'bg-[#FAEBDD] text-[#D9730D]' : 'bg-[#EDF3EC] text-[#448361]')
                                    : 'bg-[#FBF3DB] text-[#CB912F]'
                                }
                            `}>
                                {activeTab === 'evening' ? (
                                    <>
                                        {currentCycleInfo?.phase === 'exfoliate' && <Sparkles size={24} strokeWidth={2.5} />}
                                        {currentCycleInfo?.phase === 'retinoid' && <Moon size={24} strokeWidth={2.5} />}
                                        {currentCycleInfo?.phase === 'recovery' && <BatteryCharging size={24} strokeWidth={2.5} />}
                                    </>
                                ) : (
                                    <Sun size={24} strokeWidth={2.5} />
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-[#787774] uppercase tracking-widest mb-0.5 opacity-50">Current Focus</span>
                                <h3 className="text-[22px] font-bold text-[#37352F] tracking-tight leading-tight">
                                    {activeTab === 'evening' ? (currentCycleInfo?.title || '常规修护方案') : '晨间全效防护'}
                                </h3>
                            </div>
                        </div>

                        {isToday && (
                            <button
                                onClick={() => setIsImmersiveOpen(true)}
                                className="group/btn flex items-center gap-3.5 pl-6 pr-1.5 py-1.5 rounded-full bg-white border border-[#E9E9E7] hover:border-[#37352F] transition-all duration-500 active:scale-[0.98] shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.06)]"
                            >
                                <span className="text-[14px] font-bold text-[#37352F] tracking-tight ml-1">开始跟练</span>
                                <div className="w-9 h-9 rounded-full bg-[#37352F] flex items-center justify-center text-white transition-all duration-500 group-hover/btn:scale-105 group-hover/btn:shadow-[0_5px_15px_rgba(0,0,0,0.12)]">
                                    <Play className="w-3.5 h-3.5 fill-current text-white translate-x-0.5" />
                                </div>
                            </button>
                        )}
                    </div>

                    {/* 3. Refined Task List (Seamless & Elegant) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <h4 className="text-[11px] font-bold text-[#787774] uppercase tracking-[0.2em] flex items-center gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#337EA9]" />
                                步骤清单 · {effectiveSteps.length} Steps
                            </h4>
                            <div className="flex items-center gap-4 text-[11px] font-bold text-[#787774]">
                                <div className="flex items-center gap-1.5">
                                    <span className="opacity-40 font-medium">预计耗时</span>
                                    <span className="text-[#37352F] font-mono">
                                        {effectiveSteps.reduce((acc, curr) => acc + (parseInt(curr.duration) || 0), 0)} MINS
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            {effectiveSteps.map((step: RoutineStep, idx: number) => {
                                const dateKey = selectedDate.toISOString().slice(0, 10);
                                const key = `${dateKey}_${activeTab}_${idx}`;
                                const isDone = !!completedSteps[key];

                                return (
                                    <React.Fragment key={idx}>
                                        <div
                                            className={`
                                                group relative flex items-start gap-6 px-4 py-5 transition-all duration-300
                                                ${idx !== effectiveSteps.length - 1 && expandedStep !== idx ? 'border-b border-[#F1F1EF]' : ''}
                                                ${isDone ? 'opacity-40' : 'hover:bg-[#F9F9F8] cursor-pointer'}
                                                ${expandedStep === idx ? 'bg-[#F9F9F8] rounded-t-2xl' : 'rounded-xl'}
                                            `}
                                            onClick={() => isToday && setExpandedStep(expandedStep === idx ? null : idx)}
                                        >
                                            {/* Timeline Indicator */}
                                            <div className="relative w-8 flex flex-col items-center flex-shrink-0">
                                                {/* Vertical line - spans from top to bottom of the step */}
                                                {idx !== effectiveSteps.length - 1 && (
                                                    <div className={`absolute top-10 -bottom-5 w-[1px] ${expandedStep === idx ? 'bg-transparent' : 'bg-[#F1F1EF]'}`} />
                                                )}

                                                <div className="relative z-10 pt-1">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isToday) toggleStep(idx);
                                                        }}
                                                    >
                                                        {isDone ? (
                                                            <div className="w-8 h-8 rounded-full bg-[#EDF3EC] text-[#448361] flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
                                                                <CheckCircle2 size={16} />
                                                            </div>
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-transparent text-[#D4D4D2] flex items-center justify-center border border-transparent group-hover:border-[#F1F1EF] group-hover:bg-white group-hover:text-[#37352F] transition-all duration-300">
                                                                <span className="text-[13px] font-mono font-bold tracking-tighter">
                                                                    {String(idx + 1).padStart(2, '0')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Content Area */}
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex items-center gap-2.5 mb-1">
                                                    <h5 className={`font-bold text-[16px] tracking-tight transition-all ${isDone ? 'text-[#787774] line-through' : 'text-[#37352F]'}`}>
                                                        {step.name}
                                                    </h5>
                                                    {!isDone && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F1F1EF] text-[#787774] opacity-80">
                                                            {step.duration}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-[14px] leading-relaxed transition-all ${isDone ? 'text-[#D4D4D2]' : 'text-[#787774]'} ${expandedStep === idx ? '' : 'line-clamp-1'}`}>
                                                    {step.description}
                                                </p>
                                            </div>

                                            {/* Right Side: Dosage or Chevron */}
                                            <div className="flex items-center gap-3 shrink-0 pt-1">
                                                {step.dosage && !isDone && expandedStep !== idx && (
                                                    <div className="px-4 py-2 bg-[#F1F1EF]/50 rounded-lg text-[11px] font-bold text-[#787774]">
                                                        {step.dosage.description}
                                                    </div>
                                                )}
                                                <div className={`transition-transform duration-500 ${expandedStep === idx ? 'rotate-180 text-[#37352F]' : 'text-[#D4D4D2] opacity-40'}`}>
                                                    <ChevronDown size={18} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details Section */}
                                        <AnimatePresence>
                                            {expandedStep === idx && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                                    className="overflow-hidden bg-[#F9F9F8] rounded-b-2xl mb-4"
                                                >
                                                    <div className="pl-18 pr-6 pb-8 pt-2 flex flex-col gap-6">
                                                        {/* Media Preview Area */}
                                                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#F1F1EF] border border-[#E9E9E7] group/media">
                                                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                                                <div className="flex flex-col items-center gap-3 text-[#A1A19E] group-hover/media:text-[#37352F] transition-colors duration-500">
                                                                    <div className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                                                                        <Video size={24} />
                                                                    </div>
                                                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">View Tutorial Guide</span>
                                                                </div>
                                                            </div>
                                                            <Image
                                                                src={`https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop`}
                                                                alt="tutorial"
                                                                className="w-full h-full object-cover opacity-60 group-hover/media:scale-105 transition-transform duration-[2s]"
                                                                width={800}
                                                                height={450}
                                                            />
                                                        </div>

                                                        {/* Step Details List */}
                                                        <div className="space-y-5">
                                                            <h6 className="text-[11px] font-bold text-[#787774] uppercase tracking-[0.2em] flex items-center gap-2.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#37352F]" />
                                                                具体步骤与细节
                                                            </h6>
                                                            <div className="grid grid-cols-1 gap-4 pl-1">
                                                                {(step.detailedInstructions || [
                                                                    "取适量产品于掌心，均匀点涂在额头、两颊及下巴区域。",
                                                                    "由内向外、由下向上顺着皮肤纹理轻轻划圈按摩至吸收。",
                                                                    "针对T区或毛孔粗大区域可适当增加用量，轻轻按压。",
                                                                    "待产品完全吸收（约30秒）后，再进行下一步护肤操作。"
                                                                ]).map((instr, i) => (
                                                                    <div key={i} className="flex gap-4 items-start group/instr">
                                                                        <span className="text-[11px] font-mono font-bold text-[#A1A19E] pt-1 group-hover/instr:text-[#37352F] transition-colors">{String(i + 1).padStart(2, '0')}</span>
                                                                        <p className="text-[14px] text-[#37352F] leading-relaxed font-medium">
                                                                            {instr}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Extra Advice */}
                                                        <div className="p-5 rounded-2xl bg-white border border-[#E9E9E7] shadow-sm">
                                                            <div className="flex items-center gap-2.5 mb-2.5 text-[#337EA9]">
                                                                <Info size={16} strokeWidth={2.5} />
                                                                <span className="text-[13px] font-bold tracking-tight">护肤实验室建议</span>
                                                            </div>
                                                            <p className="text-[13px] text-[#787774] leading-relaxed text-pretty">
                                                                {(step.dosage as any)?.usageGuide || step.description}。建议在皮肤微湿状态下使用以锁住水分，如有任何不适请立即停用。
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            {/* Immersive Player Portal */}
            {isImmersiveOpen && (
                <ImmersiveRoutinePlayer
                    steps={effectiveSteps}
                    title={activeTab === 'evening' ? `晚间护肤 · ${currentCycleInfo?.title || '常规'}` : '早间护肤 Routine'}
                    onClose={() => setIsImmersiveOpen(false)}
                    onComplete={() => {
                        effectiveSteps.forEach((_, idx) => {
                            const dateKey = selectedDate.toISOString().slice(0, 10);
                            const key = `${dateKey}_${activeTab}_${idx}`;
                            setCompletedSteps(prev => ({ ...prev, [key]: true }));
                        });
                        setIsImmersiveOpen(false);
                    }}
                />
            )}
        </div>
    );
}
