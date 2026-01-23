"use client";

import { useState, useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Sparkles, Clock, Droplet, MapPin, Moon, Sun, Home, Plane, Shield, Beaker, Leaf } from "lucide-react";
import {
    type RoutineLevel,
    type RoutineScenario,
    type SkincareRoutine,
    type ProductCategory,
    LEVEL_LABELS,
    SCENARIO_LABELS,
    CLIMATE_LABELS,
    generateSkincareRoutines,
    getClimateByRegion,
    adjustClimateForSeason,
} from "@/lib/skincare-dosage";

interface SkincareRoutinePanelProps {
    skinType: string;
    province?: string;
    city?: string;
}

// 映射类别图标
const getCategoryIcon = (category: ProductCategory) => {
    if (category.includes("cleanser")) return <Sparkles className="h-4 w-4" />; // 清洁
    if (category.includes("toner")) return <Droplet className="h-4 w-4" />; // 水
    if (category.includes("serum")) return <Beaker className="h-4 w-4" />; // 精华
    if (category.includes("moisturizer")) return <Leaf className="h-4 w-4" />; // 保湿
    if (category.includes("sunscreen")) return <Shield className="h-4 w-4" />; // 防晒
    if (category.includes("mask")) return <Sparkles className="h-4 w-4 text-purple-400" />;
    if (category.includes("oil")) return <Droplet className="h-4 w-4 text-amber-500" />;
    return <Sparkles className="h-4 w-4" />;
};

export function SkincareRoutinePanel({ skinType, province, city }: SkincareRoutinePanelProps) {
    const [selectedLevel, setSelectedLevel] = useState<RoutineLevel>("daily");
    const [selectedScenario, setSelectedScenario] = useState<RoutineScenario>("morning");

    const hasValidLocation = !!province;

    const climate = useMemo(() => {
        const baseClimate = getClimateByRegion(province, city);
        return adjustClimateForSeason(baseClimate);
    }, [province, city]);

    const routines = useMemo(() => {
        return generateSkincareRoutines(skinType, climate);
    }, [skinType, climate]);

    // 类型断言，确保TS知道结构
    const currentRoutine = routines[selectedLevel][selectedScenario] as SkincareRoutine;

    const scenarioIcons: Record<RoutineScenario, React.ReactNode> = {
        morning: <Sun className="h-6 w-6 sm:h-7 sm:w-7 text-[#C3BC9F]" />,
        evening: <Moon className="h-6 w-6 sm:h-7 sm:w-7 text-[#C3BC9F]" />,
        home: <Home className="h-6 w-6 sm:h-7 sm:w-7 text-[#C3BC9F]" />,
        travel: <Plane className="h-6 w-6 sm:h-7 sm:w-7 text-[#C3BC9F]" />,
    };

    return (
        <div className="relative overflow-hidden rounded-2xl bg-white/95 shadow-card backdrop-blur-sm">
            {/* 标题区域 */}
            <div className="border-b border-brand-beige/30 px-5 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-serif text-base font-light tracking-wide text-brand-charcoal">
                            科学护肤方案
                        </h3>
                        <p className="mt-0.5 text-xs text-brand-charcoal/50">
                            基于皮肤科学与当前气候环境 ({CLIMATE_LABELS[climate].split(" ")[0]})
                        </p>
                    </div>

                    {hasValidLocation && (
                        <div className="flex items-center gap-1.5 rounded-full bg-brand-champagne/40 px-3 py-1">
                            <MapPin className="h-3.5 w-3.5 text-brand-charcoal/50" />
                            <span className="text-[11px] text-brand-charcoal/60">
                                {province} · {CLIMATE_LABELS[climate].split(" ")[0]}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* 方案级别选择 */}
            <div className="flex border-b border-brand-beige/20">
                {(Object.keys(LEVEL_LABELS) as RoutineLevel[]).map((level) => (
                    <button
                        key={level}
                        onClick={() => setSelectedLevel(level)}
                        className={`relative flex-1 py-3 text-center text-sm transition-all ${selectedLevel === level
                            ? "text-brand-charcoal"
                            : "text-brand-charcoal/40 hover:text-brand-charcoal/60"
                            }`}
                    >
                        <span className="font-medium">{LEVEL_LABELS[level].name}</span>
                        <span className="ml-1 text-[10px] uppercase tracking-wider opacity-60">
                            {LEVEL_LABELS[level].nameEn}
                        </span>
                        {selectedLevel === level && (
                            <m.div
                                layoutId="level-indicator"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* 场景选择 */}
            <div className="grid grid-cols-4 gap-1 p-3">
                {(Object.keys(SCENARIO_LABELS) as RoutineScenario[]).map((scenario) => (
                    <button
                        key={scenario}
                        onClick={() => setSelectedScenario(scenario)}
                        className={`group flex flex-col items-center gap-2 rounded-xl py-3 transition-all ${selectedScenario === scenario
                            ? "bg-brand-champagne/50"
                            : "hover:bg-brand-champagne/20"
                            }`}
                    >
                        <div className={`transition-transform ${selectedScenario === scenario ? "scale-110" : ""}`}>
                            {scenarioIcons[scenario]}
                        </div>
                        <span className={`text-[11px] ${selectedScenario === scenario ? "font-medium text-brand-charcoal" : "text-brand-charcoal/50"
                            }`}>
                            {SCENARIO_LABELS[scenario].name}
                        </span>
                    </button>
                ))}
            </div>

            {/* 护肤步骤详情 */}
            <AnimatePresence mode="wait">
                <m.div
                    key={`${selectedLevel}-${selectedScenario}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                >
                    {/* 方案概览 */}
                    <div className="mb-3 flex items-center justify-between rounded-lg bg-brand-champagne/30 px-3 py-2">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-brand-charcoal/50" />
                            <span className="text-xs text-brand-charcoal/70">预计耗时 {currentRoutine.totalDuration}</span>
                        </div>
                        <span className="text-[10px] text-brand-charcoal/40">{LEVEL_LABELS[selectedLevel].desc}</span>
                    </div>

                    {/* 步骤列表 */}
                    <div className="space-y-2">
                        {currentRoutine.steps.map((step, index) => (
                            <div
                                key={step.order}
                                className="group rounded-xl border border-brand-beige/30 bg-brand-champagne/10 p-3 transition-all hover:border-brand-beige/50 hover:bg-brand-champagne/20"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-medium text-brand-charcoal">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-brand-charcoal">{step.name}</span>
                                                {/* 移动端隐藏英文名以防拥挤 */}
                                                <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-brand-charcoal/40">{step.nameEn}</span>
                                            </div>
                                            <p className="mt-0.5 text-[11px] leading-relaxed text-brand-charcoal/50">
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end min-w-[60px]">
                                        <span className="text-[10px] text-brand-charcoal/40">{step.duration}</span>
                                        {step.frequency && (
                                            <span className="mt-0.5 text-[10px] text-brand-gold">{step.frequency}</span>
                                        )}
                                    </div>
                                </div>

                                {/* 用量推荐区块 */}
                                {step.dosage && (
                                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 border border-brand-beige/20">
                                        <div className="text-brand-gold opacity-80">
                                            {getCategoryIcon(step.category)}
                                        </div>
                                        <span className="text-[11px] text-brand-charcoal/70">
                                            <span className="font-medium text-brand-charcoal mr-1.5">
                                                {step.dosage.dosage} {step.dosage.unit}
                                            </span>
                                            <span className="text-brand-charcoal/40">|</span>
                                            <span className="ml-1.5">{step.dosage.description}</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 小贴士 */}
                    {currentRoutine.tips && currentRoutine.tips.length > 0 && (
                        <div className="mt-4 rounded-xl bg-gradient-to-r from-brand-gold/10 to-brand-champagne/30 p-3">
                            <div className="mb-2 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
                                <span className="text-xs font-medium text-brand-charcoal">科学护肤贴士</span>
                            </div>
                            <ul className="space-y-1">
                                {currentRoutine.tips.map((tip, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-brand-charcoal/60">
                                        <span className="mt-1 h-0.5 w-0.5 flex-shrink-0 rounded-full bg-brand-gold/80" />
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </m.div>
            </AnimatePresence>
        </div>
    );
}
