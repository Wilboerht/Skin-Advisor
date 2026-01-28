
export interface RoutineStep {
    order: number;
    name: string;
    nameEn?: string;
    category: string;
    duration: string;
    description: string;
    dosage?: {
        dosage: string | number;
        unit: string;
        description: string;
        productName: string;
        usageGuide?: string;
    };
    detailedInstructions?: string[];
}

export interface CyclingDay {
    day: number;
    phase: 'exfoliate' | 'retinoid' | 'recovery' | 'maintenance';
    title: string;
    activeIngredient?: string;
    description?: string;
}

export function getEffectiveSteps(
    baseSteps: RoutineStep[],
    cycleData: CyclingDay[] | undefined,
    dayNumber: number, // 1-4
    isEvening: boolean
): RoutineStep[] {
    if (!isEvening || !cycleData) return baseSteps;

    const currentCycle = cycleData.find(c => c.day === dayNumber);
    if (!currentCycle) return baseSteps;

    return baseSteps.map(originalStep => {
        let step = { ...originalStep };

        // Dynamic Step Overrides for Cycling (Evening)
        if (step.category === 'serum_active' || (step.name && step.name.includes("精华"))) {
            // Recovery Nights (Day 3, 4) -> Replace Active with Repair
            if (currentCycle.phase === 'recovery') {
                step.name = "舒缓修护精华";
                step.nameEn = "Barrier Repair Serum";
                step.description = "今晚为肌肤休息日，停用猛药，重点修复屏障。建议使用含神经酰胺、积雪草或B5成分的产品。";
                if (step.dosage) step.dosage.description = "足量涂抹";
            }
            // Exfoliation Night (Day 1)
            else if (currentCycle.day === 1) {
                // Usually Acid
                step.name = currentCycle.activeIngredient === 'salicylic_acid' ? "水杨酸精华 (BHA)" : "果酸精华 (AHA)";
                step.nameEn = "Exfoliation Serum";
                step.description = `今晚重点疏通毛孔与剥脱老废角质。请注意${currentCycle.activeIngredient === 'salicylic_acid' ? '局部点涂' : '避开眼周'}，可能有轻微刺痛感。`;
            }
            // Retinoid Night (Day 2)
            else if (currentCycle.day === 2) {
                step.name = "维A醇精华 (Retinol)";
                step.nameEn = "Anti-Aging Serum";
                step.description = "今晚重点抗老。初次使用建议混合面霜降低刺激，务必避光使用。";
            }
        }
        return step;
    });
}

// Logic to determine "Day 1-4" from absolute date
export function getCycleDayForDate(targetDate: Date, cycleStartDate: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    // Normalize to midnight to avoid time diff issues
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const start = new Date(cycleStartDate.getFullYear(), cycleStartDate.getMonth(), cycleStartDate.getDate());

    const diffDays = Math.floor((target.getTime() - start.getTime()) / oneDay);
    // Cycle is 4 days: 1, 2, 3, 4
    // Mathematical modulo can be negative in JS, need to handle that
    // Formula: ((n % 4) + 4) % 4 returns 0, 1, 2, 3
    // We want 1-based index (1, 2, 3, 4) -> so add 1 to result
    const cycleIndex = ((diffDays % 4) + 4) % 4;
    return cycleIndex + 1;
}

export const CYCLE_COLORS = {
    exfoliate: 'bg-[#F9F2F5] text-[#C14C8A] border-[#F9F2F5]',
    retinoid: 'bg-[#FAEBDD] text-[#D9730D] border-[#FAEBDD]',
    recovery: 'bg-[#EDF3EC] text-[#448361] border-[#EDF3EC]',
    maintenance: 'bg-[#FBF3DB] text-[#CB912F] border-[#FBF3DB]',
};

export const CYCLE_DOTS = {
    exfoliate: 'bg-[#D44C47]',
    retinoid: 'bg-[#D9730D]',
    recovery: 'bg-[#448361]',
    maintenance: 'bg-[#CB912F]',
};
