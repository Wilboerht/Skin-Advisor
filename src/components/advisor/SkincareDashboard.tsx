
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
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date()); // For calendar navigation

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

    // Completion Status
    const completedCount = effectiveSteps.reduce((acc, _, idx) => {
        const key = `${selectedDate.toISOString().slice(0, 10)}_${activeTab}_${idx}`;
        return acc + (completedSteps[key] ? 1 : 0);
    }, 0);
    const progress = Math.round((completedCount / effectiveSteps.length) * 100);

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
                <div className="flex-1 overflow-y-auto px-8 pt-6 pb-4 scrollbar-hide">
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
                                                    {isPast && hasAnyCompletion ? (
                                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-[#337EA9]' : 'bg-[#448361]'}`} />
                                                    ) : dotClass ? (
                                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-[#337EA9]' : dotClass}`} />
                                                    ) : null}
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

                        {/* Minimalist Progress Circle */}
                        <div className="relative w-11 h-11 flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="22" cy="22" r="19" fill="transparent" stroke="#F1F1EF" strokeWidth="2.5" />
                                <circle
                                    cx="22" cy="22" r="19"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    className="text-[#37352F]"
                                    strokeDasharray={119.3}
                                    strokeDashoffset={119.3 - (119.3 * progress) / 100}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                />
                            </svg>
                            <span className="text-[11px] font-bold text-[#37352F] font-mono">{progress}%</span>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <div className="w-8" /> {/* Spacer for external Close button */}
                    </div>
                </header>

                {/* 2. Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-10 py-8 scrollbar-hide">

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
                                className="group/btn flex items-center gap-4 pl-8 pr-3 py-3 rounded-full bg-white border border-[#E9E9E7] hover:border-[#37352F] transition-all duration-500 active:scale-95 shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                            >
                                <span className="text-sm font-bold text-[#37352F] tracking-tight">沉浸跟练</span>
                                <div className="w-10 h-10 rounded-full bg-[#37352F] flex items-center justify-center text-white transition-all group-hover/btn:scale-110 group-hover/btn:rotate-[360deg]">
                                    <Play className="w-4 h-4 fill-white ml-0.5" />
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
                                    <div
                                        key={idx}
                                        className={`
                                            group relative flex items-start gap-6 px-4 py-5 transition-all duration-300
                                            ${idx !== effectiveSteps.length - 1 ? 'border-b border-[#F1F1EF]' : ''}
                                            ${isDone ? 'opacity-30' : 'hover:bg-[#F9F9F8] cursor-pointer rounded-xl'}
                                        `}
                                        onClick={() => isToday && toggleStep(idx)}
                                    >
                                        {/* Timeline Indicator */}
                                        <div className="relative w-8 flex flex-col items-center flex-shrink-0">
                                            {/* Vertical line - spans from top to bottom of the step */}
                                            {idx !== effectiveSteps.length - 1 && (
                                                <div className="absolute top-10 -bottom-5 w-[1px] bg-[#F1F1EF]" />
                                            )}

                                            <div className="relative z-10 pt-1">
                                                {isDone ? (
                                                    <div className="w-8 h-8 rounded-full bg-[#EDF3EC] text-[#448361] flex items-center justify-center shadow-sm">
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
                                            <p className={`text-[14px] leading-relaxed transition-all ${isDone ? 'text-[#D4D4D2]' : 'text-[#787774]'} line-clamp-2`}>
                                                {step.description}
                                            </p>
                                        </div>

                                        {/* Dosage Badge */}
                                        {step.dosage && !isDone && (
                                            <div className="shrink-0 pt-1">
                                                <div className="px-4 py-2 bg-[#F1F1EF]/50 rounded-lg text-[11px] font-bold text-[#787774] border border-transparent transition-all group-hover:bg-white group-hover:border-[#E9E9E7] group-hover:shadow-sm">
                                                    {step.dosage.description}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

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
            </main>
        </div>
    );
}
