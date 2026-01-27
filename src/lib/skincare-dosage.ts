/**
 * 科学通用护肤逻辑库 (Scientific Generic Skincare Logic)
 * V2.0 - Dermatologist Grade
 * 
 * 基于皮肤科学原理设计的通用护肤推荐引擎。
 * 核心原则：
 * 1. 精准浓度：基于耐受度推荐具体活性成分浓度 (e.g. 0.1% Retinol vs 0.3%)
 * 2. 冲突规避：自动分离冲突成分 (e.g. A醇与酸类错开使用)
 * 3. 黄金标准：最大化配合 MySkin.Today™ Lab Data (TEWL, Erythema, etc.)
 */

// Import FaceAnalysisResult for type usage, assuming it's exported from there
import { FaceAnalysisResult } from "./advisor-utils";

// ============================================================================
// 1. Core Types & Constants
// ============================================================================

export type ClimateType = "W1" | "A2" | "S1" | "A1" | "S2" | "M1";
export type SkinType = "oily" | "combination_oily" | "normal" | "combination_dry" | "dry" | "sensitive";
export type RoutineLevel = "basic" | "advanced" | "pro"; // Simplified levels
export type RoutineScenario = "morning" | "evening";

/** Ingredient Safety/Tolerance Level */
export type ToleranceLevel = "low" | "medium" | "high";

/** Active Ingredient Definition */
export interface ActiveIngredient {
    name: string;
    nameEn: string;
    type: "retinoid" | "acid" | "antioxidant" | "peptide" | "soothing" | "barrier" | "brightening";
    concentrations: {
        low: string;    // e.g. "0.05%"
        medium: string; // e.g. "0.1%"
        high: string;   // e.g. "0.3%"
    };
    conflicts: string[]; // List of ingredient types it conflicts with
    timeOfDay: "morning" | "evening" | "both";
    frequency: string; // Default frequency description
    safety?: {
        pregnancyUnsafe?: boolean; // Default false
        sensitiveCaution?: boolean; // Default false
    };
}

export const ACTIVE_INGREDIENTS: Record<string, ActiveIngredient> = {
    // --- CLASS A: RETINOIDS (Anti-Aging) ---
    retinol: {
        name: "视黄醇 (A醇)",
        nameEn: "Retinol",
        type: "retinoid",
        concentrations: { low: "0.05%", medium: "0.1%", high: "0.3%" },
        conflicts: ["acid", "vitC_high_dose", "copper_peptide"],
        timeOfDay: "evening",
        frequency: "晚间使用，需建立耐受",
        safety: { pregnancyUnsafe: true, sensitiveCaution: true }
    },

    // --- CLASS B: ACIDS (Exfoliation) ---
    salicylic_acid: {
        name: "水杨酸 (BHA)",
        nameEn: "Salicylic Acid",
        type: "acid",
        concentrations: { low: "0.5%", medium: "1.0%", high: "2.0%" },
        conflicts: ["retinoid", "acid", "peptide"],
        timeOfDay: "evening",
        frequency: "局部点涂或隔夜使用",
        safety: { pregnancyUnsafe: true } // High dose oral is unsafe, topical is debated but usually advised to avoid >2%
    },
    glycolic_acid: {
        name: "果酸 (AHA)",
        nameEn: "Glycolic Acid",
        type: "acid",
        concentrations: { low: "5%", medium: "8%", high: "10%" },
        conflicts: ["retinoid", "peptide"],
        timeOfDay: "evening",
        frequency: "每周2-3次，晚间使用",
        safety: { sensitiveCaution: true }
    },
    azelaic_acid: {
        name: "壬二酸",
        nameEn: "Azelaic Acid",
        type: "acid",
        concentrations: { low: "10%", medium: "15%", high: "20%" },
        conflicts: [], // Very stable, generally compatible
        timeOfDay: "both",
        frequency: "早晚皆可，局部使用",
        safety: { sensitiveCaution: true } // Can itch
    },

    // --- CLASS C: VITAMINS & ANTIOXIDANTS ---
    vitamin_c: {
        name: "维C (L-AA)",
        nameEn: "Vitamin C",
        type: "antioxidant",
        concentrations: { low: "5%", medium: "10%", high: "15%" },
        conflicts: ["retinoid", "copper_peptide"],
        timeOfDay: "morning",
        frequency: "晨间使用，抗氧提亮",
        safety: { sensitiveCaution: true }
    },
    niacinamide: {
        name: "烟酰胺 (B3)",
        nameEn: "Niacinamide",
        type: "barrier",
        concentrations: { low: "2%", medium: "5%", high: "10%" },
        conflicts: ["acid"], // Avoiding low pH flush
        timeOfDay: "both",
        frequency: "早晚皆可"
    },

    // --- CLASS D: BRIGHTENING SPECIALISTS ---
    tranexamic_acid: {
        name: "传明酸",
        nameEn: "Tranexamic Acid",
        type: "brightening",
        concentrations: { low: "2%", medium: "3%", high: "5%" },
        conflicts: [],
        timeOfDay: "both",
        frequency: "专注于顽固色斑区域"
    },
    arbutin: {
        name: "α-熊果苷",
        nameEn: "Alpha-Arbutin",
        type: "brightening",
        concentrations: { low: "1%", medium: "2%", high: "3%" },
        conflicts: [],
        timeOfDay: "both",
        frequency: "温和美白"
    },

    // --- CLASS E: REPAIR & PEPTIDES ---
    peptides: {
        name: "胜肽复合物",
        nameEn: "Peptides",
        type: "peptide",
        concentrations: { low: "ppm级", medium: "3%", high: "10%" },
        conflicts: ["acid", "vitC_high_dose"],
        timeOfDay: "both",
        frequency: "早晚皆可"
    },
    copper_peptide: {
        name: "蓝铜胜肽",
        nameEn: "GHK-Cu",
        type: "peptide",
        concentrations: { low: "0.1%", medium: "0.2%", high: "0.5%" },
        conflicts: ["acid", "retinoid", "vitamin_c"], // Very fragile
        timeOfDay: "evening",
        frequency: "修护期使用，避开强功效"
    },
    proxylane: {
        name: "玻色因",
        nameEn: "Pro-Xylane",
        type: "peptide", // Loosely categorized for logic, technically sugar derivative
        concentrations: { low: "10%", medium: "30%", high: "50%" },
        conflicts: [],
        timeOfDay: "both",
        frequency: "温和抗老，无需建立耐受"
    }
};

/**
 * Skin Cycling Phases (V3.0)
 */
export type CyclePhase = "active_a" | "active_b" | "recovery" | "maintenance";

export interface SkinCycleDay {
    day: number;
    phase: CyclePhase;
    title: string;
    focus: string; // e.g. "Exfoliation Night"
    activeIngredient?: string; // key from ACTIVE_INGREDIENTS
}

/** Product Categories (Refined) */
export type ProductCategory =
    | "cleanser_gentle" | "cleanser_deep"
    | "toner_hydrating" | "toner_acid"
    | "serum_antiox" | "serum_active" | "serum_repair"
    | "moisturizer_lotion" | "moisturizer_cream"
    | "sunscreen"
    | "eye_cream"
    | "mask_clay" | "mask_hydrating";

export interface ScientificProduct {
    category: ProductCategory;
    name: string;
    unit: string;
    baseDosage: number;
    usageGuide: string;
}

const SCIENTIFIC_PRODUCTS: Record<ProductCategory, ScientificProduct> = {
    cleanser_gentle: { category: "cleanser_gentle", name: "温和洁面", unit: "cm", baseDosage: 1.5, usageGuide: "起泡后轻柔打圈30秒" },
    cleanser_deep: { category: "cleanser_deep", name: "深层洁面", unit: "cm", baseDosage: 1.5, usageGuide: "重点清洁T区，避开眼周" },
    toner_hydrating: { category: "toner_hydrating", name: "保湿水", unit: "ml", baseDosage: 2.0, usageGuide: "轻拍至吸收或湿敷" },
    toner_acid: { category: "toner_acid", name: "焕肤水", unit: "ml", baseDosage: 1.5, usageGuide: "配合化妆棉擦拭，避开破口" },
    serum_antiox: { category: "serum_antiox", name: "抗氧精华", unit: "pump", baseDosage: 1.5, usageGuide: "全脸均匀按压" },
    serum_active: { category: "serum_active", name: "功效精华", unit: "drop", baseDosage: 3.0, usageGuide: "局部或全脸，注意避光" },
    serum_repair: { category: "serum_repair", name: "修护精华", unit: "pump", baseDosage: 2.0, usageGuide: "由于质地较稠，建议掌心预热" },
    moisturizer_lotion: { category: "moisturizer_lotion", name: "保湿乳液", unit: "pump", baseDosage: 1.0, usageGuide: "轻薄涂抹，直至清爽" },
    moisturizer_cream: { category: "moisturizer_cream", name: "滋润面霜", unit: "g", baseDosage: 0.5, usageGuide: "指尖乳化后按压上脸" },
    sunscreen: { category: "sunscreen", name: "防晒霜", unit: "g", baseDosage: 1.0, usageGuide: "出门前15分钟涂抹，硬币大小" },
    eye_cream: { category: "eye_cream", name: "眼霜", unit: "g", baseDosage: 0.1, usageGuide: "无名指点涂眼周" },
    mask_clay: { category: "mask_clay", name: "清洁泥膜", unit: "g", baseDosage: 5.0, usageGuide: "厚敷盖住肤色，干透前洗净" },
    mask_hydrating: { category: "mask_hydrating", name: "补水面膜", unit: "片", baseDosage: 1.0, usageGuide: "敷15分钟后揭下洗净" },
};

// ============================================================================
// 2. Helper Logic
// ============================================================================

// Enhanced Normalization
export function normalizeSkinType(input: string = ""): SkinType {
    const normalized = input.toLowerCase().trim();

    // Direct Hit
    if (SKIN_TYPE_MAP[normalized]) return SKIN_TYPE_MAP[normalized];

    // Fuzzy Search
    if (normalized.includes("oil") || normalized.includes("油")) return "oily";
    if (normalized.includes("dry") || normalized.includes("干")) return "dry";
    if (normalized.includes("sensit") || normalized.includes("敏")) return "sensitive";
    if (normalized.includes("norm") || normalized.includes("中性")) return "normal";
    if (normalized.includes("comb") || normalized.includes("混合")) return "combination_oily";

    // Default Fallback
    return "combination_oily";
}

export const SKIN_TYPE_MAP: Record<string, SkinType> = {
    oily: "oily",
    combination: "combination_oily",
    combination_oily: "combination_oily",
    normal: "normal",
    combination_dry: "combination_dry",
    dry: "dry",
    sensitive: "sensitive",
    // Fallback mapping (keep likely keys)
    "油性": "oily",
    "油性皮肤": "oily",
    "混合性偏油": "combination_oily",
    "中性": "normal",
    "中性皮肤": "normal",
    "混合性偏干": "combination_dry",
    "干性": "dry",
    "干性皮肤": "dry",
    "敏感": "sensitive",
    "敏感肌": "sensitive",
};

/**
 * Determine Climate Type based on Region
 */
export function getClimateByRegion(province?: string, city?: string): ClimateType {
    if (!province && !city) return "S1"; // Default Moderate
    const location = (province || "") + (city || "");
    if (/西藏|青海|新疆北部|内蒙古北部/.test(location)) return "M1"; // Highland/Extreme
    if (/黑龙江|吉林|辽宁|内蒙古|北京|天津|河北|山西|陕西北部/.test(location)) return "W1"; // Cold Dry
    if (/广东|广西|海南|福建|台湾|香港/.test(location)) return "S2"; // Hot Humid
    if (/新疆|甘肃|宁夏/.test(location)) return "A1"; // Hot Dry
    if (/上海|江苏|浙江|山东|湖南|湖北|江西/.test(location)) return "A2"; // Cool Humid (roughly)
    return "S1";
}

// ============================================================================
// 3. Scientific Routine Generator
// ============================================================================

export interface ScientificStep {
    order: number;
    title: string;
    productName: string;
    category: ProductCategory;
    activeInfo?: {
        ingredient: string;    // e.g. "Salicylic Acid"
        concentration: string; // e.g. "2%"
        tag: string;           // e.g. "Oil Control"
    };
    dosage: {
        amount: number;
        unit: string;
        tips: string;
    };
}

export interface DailyRoutine {
    morning: ScientificStep[];
    evening: ScientificStep[];
    tips: string[];
}

/** 
 * Bio-Rhythm Factors 
 * - Stress/Sleep -> Cortisol levels -> Barrier health
 * - Cycle -> Hormonal fluctuations -> Sebum/Sensitivity
 */
export interface BioFactors {
    stressLevel: "low" | "medium" | "high";
    sleepQuality: "good" | "fair" | "poor";
    menstrualPhase?: "follicular" | "ovulation" | "luteal" | "menstrual"; // Optional
}

/**
 * Main Algorithm Entry Point
 */
export interface Contraindications {
    pregnancy?: boolean;
    breastfeeding?: boolean;
    rosacea?: boolean; // 玫瑰痤疮
    eczema?: boolean;  // 湿疹
}

/**
 * Main Algorithm Entry Point V3.0
 */
export function generateScientificRoutine(
    skinTypeRaw: string,
    climateCode: ClimateType,
    goldStandardData?: FaceAnalysisResult,
    bioFactors?: BioFactors,
    envData?: EnvironmentData,
    contraindications?: Contraindications // New
): { daily: DailyRoutine; cycling?: SkinCycleDay[]; special: string[] } {

    // 1. Diagnosis & Profiling
    const sType = normalizeSkinType(skinTypeRaw);
    let isSensitive = sType === "sensitive" || (goldStandardData?.dimensions?.sensitivity?.score ?? 100) < 60;
    const isOily = ["oily", "combination_oily"].includes(sType);
    const isDry = ["dry", "combination_dry"].includes(sType);

    const hasAcneRisk = (goldStandardData?.dimensions?.acne?.score ?? 100) < 65 || (goldStandardData?.labAnalysis?.porphyrins?.value ?? 0) > 20;
    const hasAgingRisk = (goldStandardData?.dimensions?.wrinkles?.score ?? 100) < 65 || (goldStandardData?.labAnalysis?.glogau?.value === "Type III");
    const hasPigmentRisk = (goldStandardData?.dimensions?.spots?.score ?? 100) < 70;
    const hasRedness = (goldStandardData?.dimensions?.sensitivity?.score ?? 100) < 50;

    // --- BIO-RHYTHM ---
    const isHighStress = bioFactors?.stressLevel === "high" || bioFactors?.sleepQuality === "poor";
    const isLutealPhase = bioFactors?.menstrualPhase === "luteal";

    // --- SAFETY CHECK (Pregnancy/Sensitive) ---
    const isPregnancySafeMode = contraindications?.pregnancy || contraindications?.breastfeeding;
    if (contraindications?.rosacea || contraindications?.eczema) isSensitive = true; // Force sensitive mode

    // 2. Tolerance Determination
    let tolerance: ToleranceLevel = "medium";
    if (isSensitive) tolerance = "low";
    if ((goldStandardData?.labAnalysis?.erythema?.value ?? 0) > 350) tolerance = "low";
    if (isOily && !isSensitive && !isPregnancySafeMode && (goldStandardData?.dimensions?.skinTypeScore.score ?? 0) > 85) tolerance = "high";
    if (isHighStress && tolerance === "high") tolerance = "medium"; // Stress downgrades tolerance

    // 3. Build Routine Slots
    const morningSteps: ScientificStep[] = [];
    const eveningSteps: ScientificStep[] = [];
    const cyclingSchedule: SkinCycleDay[] = []; // V3 Feature

    // --- MORNING ---
    // M1. Cleanse
    morningSteps.push(createStep(1,
        (isOily && !isSensitive) ? "cleanser_deep" : "cleanser_gentle",
        sType, climateCode
    ));

    // M2. Treat (Antioxidant / Brightening)
    // Preference: Vitamin C (Standard) -> Niacinamide (If sensitive to C) -> Azelaic (If Rosacea)
    let dayActive = ACTIVE_INGREDIENTS["vitamin_c"];
    let dayTag = "Brightening";

    if (contraindications?.rosacea || hasRedness) {
        dayActive = ACTIVE_INGREDIENTS["azelaic_acid"]; // Azelaic is gold standard for redness
        dayTag = "Anti-Redness";
    } else if (isSensitive) {
        dayActive = ACTIVE_INGREDIENTS["niacinamide"]; // Safer alternative
        dayTag = "Barrier Support";
    }

    morningSteps.push({
        order: 2,
        title: "日间防护",
        productName: `${dayActive.name}精华`,
        category: "serum_antiox",
        activeInfo: {
            ingredient: dayActive.nameEn,
            concentration: dayActive.concentrations[tolerance],
            tag: dayTag
        },
        dosage: { amount: 2, unit: "pump", tips: "全脸按压，注意颈部" }
    });

    // M3. Moisturize (Skip if very oily/humid)
    if (!(isOily && (climateCode === "S2" || climateCode === "A2"))) {
        morningSteps.push(createStep(3, isDry ? "moisturizer_cream" : "moisturizer_lotion", sType, climateCode));
    }

    // M4. Sunscreen
    morningSteps.push(createStep(morningSteps.length + 1, "sunscreen", sType, climateCode));


    // --- EVENING (Standard Routine + Cycling Logic) ---

    // E1. Cleanse
    eveningSteps.push(createStep(1, isDry ? "cleanser_gentle" : "cleanser_deep", sType, climateCode));

    // E2. MAIN ACTIVE SELECTION (The Brain)
    // Strategy: Determine the "Star Ingredient" for the user's primary concern
    let nightActive: ActiveIngredient | null = null;
    let nightActive2: ActiveIngredient | null = null; // Secondary (Synergy)
    let nightTag = "Repair";
    let cycleType: "retinoid" | "acid" | "repair" = "repair";

    // A. ACNE PATHWAY
    if (hasAcneRisk || isLutealPhase) {
        cycleType = "acid";
        if (isPregnancySafeMode) {
            nightActive = ACTIVE_INGREDIENTS["azelaic_acid"]; // Safe for pregnancy acne
            nightTag = "Safe Acne Control";
        } else {
            nightActive = ACTIVE_INGREDIENTS["salicylic_acid"];
            nightTag = "Pore Clearing";
        }
    }
    // B. AGING PATHWAY
    else if (hasAgingRisk) {
        cycleType = "retinoid";
        if (isPregnancySafeMode) {
            nightActive = ACTIVE_INGREDIENTS["peptides"]; // Safe alternative
            nightTag = "Safe Anti-Aging";
            nightActive2 = ACTIVE_INGREDIENTS["proxylane"]; // Boost
        } else if (isSensitive) {
            nightActive = ACTIVE_INGREDIENTS["proxylane"]; // Gentle alternative
            nightTag = "Gentle Firming";
        } else {
            nightActive = ACTIVE_INGREDIENTS["retinol"];
            nightActive2 = ACTIVE_INGREDIENTS["niacinamide"]; // Buffer
            nightTag = "Collagen Boost";
        }
    }
    // C. PIGMENT PATHWAY
    else if (hasPigmentRisk) {
        cycleType = "acid"; // Glycolic usually
        nightActive = ACTIVE_INGREDIENTS["tranexamic_acid"]; // Pigment specialist
        // Add Glycolic if not sensitive/pregnant
        if (!isSensitive) {
            nightActive2 = ACTIVE_INGREDIENTS["glycolic_acid"];
        }
        nightTag = "Spot Correction";
    }
    // D. BARRIER/MAINTENANCE
    else {
        cycleType = "repair";
        nightActive = ACTIVE_INGREDIENTS["niacinamide"];
        nightActive2 = ACTIVE_INGREDIENTS["peptides"];
        nightTag = "Barrier Strengthening";
    }

    // --- CONSTRUCT PM STEPS ---

    // Step: Exfoliation Tone (Optional)
    if (cycleType === "retinoid" && tolerance === "high") {
        // Only high tolerance gets acid + retinol (on different nights ideally, but simplified here)
        // Actually, V3 uses Cycling, so we define the "Standard Night" as the Active Night
    }

    if (nightActive) {
        eveningSteps.push({
            order: 2,
            title: "核心修护",
            productName: `${nightActive.name}精华`,
            category: "serum_active",
            activeInfo: {
                ingredient: nightActive.nameEn,
                concentration: nightActive.concentrations[tolerance],
                tag: nightTag
            },
            dosage: {
                amount: nightActive.type === "acid" ? 5 : 2,
                unit: nightActive.type === "acid" ? "drops" : "pump",
                tips: nightActive.frequency
            }
        });
    }

    // Step: Synergy Layering (Cocktail)
    if (nightActive2) {
        eveningSteps.push({
            order: 3,
            title: "效力叠加",
            productName: `${nightActive2.name}精华`,
            category: "serum_active",
            activeInfo: {
                ingredient: nightActive2.nameEn,
                concentration: nightActive2.concentrations[tolerance],
                tag: "Synergy Boost"
            },
            dosage: { amount: 1, unit: "pump", tips: "叠加使用，增强效果" }
        });
    }

    // Step: Moisturize/Seal
    eveningSteps.push(createStep(eveningSteps.length + 1,
        (isDry || isHighStress) ? "moisturizer_cream" : "moisturizer_lotion",
        sType, climateCode
    ));


    // --- 4. SKIN CYCLING GENERATION (V3 Exclusive) ---
    // Classic 4-Day Cycle: Exfoliate -> Retinoid -> Recover -> Recover

    // Day 1: Exfoliation
    let d1Active = "glycolic_acid";
    if (hasAcneRisk) d1Active = "salicylic_acid";
    if (isSensitive) d1Active = "azelaic_acid"; // Gentler

    // Day 2: Retinoid
    let d2Active = "retinol";
    if (isPregnancySafeMode || isSensitive) d2Active = "peptides"; // Alternative

    cyclingSchedule.push(
        { day: 1, phase: "active_b", title: "焕肤夜 (Exfoliation)", focus: "疏通毛孔/剥脱角质", activeIngredient: d1Active },
        { day: 2, phase: "active_a", title: "维A夜 (Retinoid)", focus: "胶原再生/抗老", activeIngredient: d2Active },
        { day: 3, phase: "recovery", title: "修护夜 (Recovery)", focus: "屏障休息/深度补水", activeIngredient: "niacinamide" }, // Use B3 or nothing
        { day: 4, phase: "recovery", title: "修护夜 (Recovery)", focus: "屏障休息/深度补水", activeIngredient: "peptides" }
    );


    // Special Tips
    const special: string[] = [];
    if (hasAcneRisk && !isSensitive) special.push("每周使用1次深层清洁泥膜 (T区)");
    if (isDry) special.push("每周2-3次 保湿面膜 (B5/玻尿酸)");
    if (isPregnancySafeMode) special.push("⚠️ 已自动开启[孕期安全模式]：屏蔽所有A醇、高浓度水杨酸，替换为胜肽与玻色因。");
    if (hasAgingRisk) special.push("建议配合家用射频仪，每周2次 (非酸类使用日)");


    // Tips Generation
    let tips = [
        `当前耐受度设定: ${tolerance === 'low' ? '低 (新手/敏感)' : tolerance === 'medium' ? '中 (进阶)' : '高 (耐受)'}`,
        isSensitive ? "检测到敏感迹象，已自动降级酸类/A醇浓度，主打修护维稳。" : "",
        isHighStress ? "[压力对抗模式已开启] 晚间方案已强化神经酰胺修护，防止'压力痘'。" : "",
        cycleType === "retinoid" ? "已为您开启[早C晚A]经典抗老模式。" : "",
        "推荐采用 [Skin Cycling] 4天循环护肤法（见下方周期表）。"
    ].filter(Boolean);

    // Env Adjustments
    if (envData) {
        const { daily: adjDaily, special: adjSpecial } = applyEnvironmentalAdjustments(
            { morning: morningSteps, evening: eveningSteps, tips },
            special,
            envData
        );
        return { daily: adjDaily, cycling: cyclingSchedule, special: adjSpecial };
    }

    return {
        daily: { morning: morningSteps, evening: eveningSteps, tips },
        cycling: cyclingSchedule,
        special
    }
}

/**
 * Environmental Data Structure (Phase 3)
 */
export interface EnvironmentData {
    uvIndex: number;          // 0-11+
    humidity: number;         // Percentage 0-100
    aqi: number;              // 0-500
    temperature: number;      // Celsius
    location?: string;
}

/**
 * Apply real-time environmental modifiers to the routine
 */
function applyEnvironmentalAdjustments(
    routine: DailyRoutine,
    special: string[],
    env: EnvironmentData
): { daily: DailyRoutine; special: string[] } {

    const newRoutine = { ...routine };
    const newSpecial = [...special];

    // 1. UV Defense
    if (env.uvIndex >= 8) { // Very High / Extreme
        // Boost Sunscreen
        const sunscreen = newRoutine.morning.find(s => s.category === "sunscreen");
        if (sunscreen) {
            sunscreen.dosage.amount *= 1.5;
            sunscreen.dosage.tips += " | ⚠️ 紫外线极强，每2小时必须补涂";
        }
        newRoutine.tips.push("☀️今日紫外线预警：已将防晒用量调至 1.5倍，请务必配合硬防晒（伞/帽）。");
    }

    // 2. Humidity Control
    if (env.humidity < 30) { // Very Dry
        // Boost Moisturizer
        const amMoist = newRoutine.morning.find(s => s.category.includes("moisturizer"));
        if (amMoist) {
            amMoist.dosage.tips += " | 建议滴入1-2滴护肤油增强封闭";
        }
        // PM Moisturizer
        const pmMoist = newRoutine.evening.find(s => s.category.includes("moisturizer"));
        if (pmMoist) {
            pmMoist.productName += " (加厚)";
            pmMoist.dosage.amount *= 1.3;
        }
        newRoutine.tips.push("💧今日空气极度干燥：建议在面霜中叠加护肤油，或增加保湿精华用量。");
    } else if (env.humidity > 80 && env.temperature > 28) { // Hot & Humid (Sauna day)
        // Lighten textures
        const amMoist = newRoutine.morning.find(s => s.category.includes("moisturizer"));
        if (amMoist && amMoist.category === "moisturizer_cream") {
            amMoist.productName = "清爽控油乳液"; // Force swap
            amMoist.dosage.amount *= 0.5;
        }
        newRoutine.tips.push("🌫️今日闷热潮湿：已将面霜调整为清爽乳液，避免闷痘。");
    }

    // 3. Pollution Defense (AQI)
    if (env.aqi > 150) { // Unhealthy
        // Force Deep Cleanse in PM
        const pmCleanser = newRoutine.evening.find(s => s.category.includes("cleanser"));
        if (pmCleanser) {
            pmCleanser.title = "深层清洁 (抗污染)";
            pmCleanser.productName = "排浊洁面 / 洁颜油";
            pmCleanser.dosage.tips = "仔细揉搓发际线和鼻翼，清除PM2.5颗粒";
        }
        // Add Antioxidant boost in AM
        newRoutine.tips.push("🌫️今日空气重度污染：PM2.5微粒易附着，晚间清洁至关重要，建议配合洁面仪。");
    }

    return { daily: newRoutine, special: newSpecial };
}


/**
 * Create a simple step object
 */
function createStep(order: number, cat: ProductCategory, sType: string, climate: ClimateType): ScientificStep {
    const prod = SCIENTIFIC_PRODUCTS[cat];
    let qty = prod.baseDosage;

    // Micro-adjustments
    if (cat === "sunscreen") {
        if (climate === "M1" || climate === "A1") qty *= 1.2;
    }
    if (cat.includes("moisturizer") && sType.includes("dry")) qty *= 1.3;

    return {
        order,
        title: prod.name,
        productName: prod.name,
        category: cat,
        dosage: {
            amount: Number(qty.toFixed(1)),
            unit: prod.unit,
            tips: prod.usageGuide
        }
    }
}

// ============================================================================
// 4. Backwards Compatibility Wrapper (Important for existing UI)
// ============================================================================

export function generateSkincareRoutines(
    skinType: string,
    climate: ClimateType,
    goldStandardData?: any,
    bioFactors?: BioFactors, // Add optional argument
    envData?: EnvironmentData // Add optional argument
): any {
    const scientific = generateScientificRoutine(skinType, climate, goldStandardData, bioFactors, envData);

    // Convert to Old Format for UI
    // Old Format: { professional: { morning: { steps: [] }, evening: { steps: [] } } }

    const convertSteps = (sciSteps: ScientificStep[]) => sciSteps.map(s => ({
        order: s.order,
        name: s.productName,
        category: s.category,
        duration: "1分钟",
        description: s.dosage.tips + (s.activeInfo ? ` [重点成分: ${s.activeInfo.ingredient} ${s.activeInfo.concentration}]` : ""),
        dosage: {
            dosage: s.dosage.amount,
            unit: s.dosage.unit,
            description: s.activeInfo ? `浓度 ${s.activeInfo.concentration}` : "标准用量",
            productName: s.productName
        }
    }));

    return {
        professional: {
            morning: {
                level: "professional",
                scenario: "morning",
                steps: convertSteps(scientific.daily.morning),
                totalDuration: "5分钟",
                tips: scientific.daily.tips
            },
            evening: {
                level: "professional",
                scenario: "evening",
                steps: convertSteps(scientific.daily.evening),
                totalDuration: "10分钟",
                tips: scientific.daily.tips
            },
            cycling: scientific.cycling
        },
        // Fill others simply
        daily: { morning: {}, evening: {} },
        ultimate: { morning: {}, evening: {} }
    };
}
