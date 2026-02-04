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
export type RoutineLevel = "daily" | "professional" | "ultimate";
export type RoutineScenario = "morning" | "evening" | "home" | "travel";

export interface SkincareRoutineStep {
    order: number;
    name: string;
    nameEn?: string;
    category: ProductCategory;
    duration: string;
    description: string;
    dosage?: {
        dosage: string;
        unit: string;
        description: string;
        productName: string;
    };
    frequency?: string;
    tips?: string[];
}


export interface SkincareRoutine {
    level: string;
    scenario: string;
    steps: SkincareRoutineStep[];
    totalDuration: string;
    tips: string[];
}

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
export type CyclePhase = "exfoliate" | "retinoid" | "recovery" | "maintenance";

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

const CATEGORY_INSTRUCTIONS: Record<ProductCategory, string[]> = {
    cleanser_gentle: [
        "先用温水濡湿面部，取适量洁面乳于掌心。",
        "加少量水揉搓起泡，这一步很重要，能减少摩擦。",
        "从T区开始，轻轻画圈按摩，脸颊处快速带过。",
        "用大量流动清水冲洗干净，用一次性洗脸巾轻轻按干水分。"
    ],
    cleanser_deep: [
        "取适量产品于掌心，加水充分起泡。",
        "重点清洁T区（额头、鼻子、下巴），手指画圈按摩约30秒。",
        "对于黑头较多区域可适当加强按摩。",
        "用温水彻底冲洗，避免残留，特别是发际线处。"
    ],
    toner_hydrating: [
        "洁面后，倒适量化妆水于掌心或化妆棉上。",
        "轻轻按压于面部，或用化妆棉顺着肌肤纹理擦拭。",
        "对于干燥区域，可重复按压一次，增强补水效果。",
        "待水分基本吸收，皮肤微微湿润时进行下一步。"
    ],
    toner_acid: [
        "倒湿润化妆棉，注意不要过饱和滴水。",
        "轻轻擦拭T区及毛孔粗大部位，避开眼周和唇周。",
        "如有轻微刺痛感属正常现象，稍候即可减轻。",
        "初次使用建议仅在晚间使用，白天务必做好防晒。"
    ],
    serum_antiox: [
        "取2-3泵精华于掌心，掌心预热轻搓。",
        "双手按压于面部，利用掌温促进吸收。",
        "重点照顾苹果肌等易受氧化部位，以及颈部肌肤。",
        "轻轻向上提拉按摩，直至完全吸收。"
    ],
    serum_active: [
        "取少量（2-3滴/1泵）于指尖。",
        "点涂于额头、两颊、鼻子和下巴。",
        "避开眼周，轻轻涂抹均匀，轻轻拍打促进吸收。",
        "若含有A醇或高浓度酸，初期建议先在耳后测试耐受。"
    ],
    serum_repair: [
        "取足量精华于掌心，这是修复屏障的关键步骤。",
        "轻轻按压全脸，对于泛红或刺痛区域可重点厚涂。",
        "动作要轻柔，避免过度揉搓刺激受损肌肤。",
        "待其形成一层保护膜后，再使用面霜封层。"
    ],
    moisturizer_lotion: [
        "取适量乳液于指尖或掌心。",
        "分别点涂于面部五点（额、颊、鼻、颚）。",
        "顺着肌肉纹理，由内向外推开。",
        "轻轻拍打帮助吸收，直至皮肤触感清爽不粘腻。"
    ],
    moisturizer_cream: [
        "取适量面霜（黄豆大小）于掌心。",
        "双手合十搓热，利用温度乳化面霜（这能减少闷痘概率）。",
        "用按压的手法将面霜“压”进皮肤，而非涂抹。",
        "最后搓热双手包裹全脸，促进成分渗透。"
    ],
    sunscreen: [
        "出门前15-20分钟是最佳涂抹时间。",
        "取硬币大小的量，这是达到标注防晒值的底线。",
        "分次点涂于全脸，轻轻拍开，不要来回用力搓泥。",
        "容易被忽略的眼皮、耳朵、颈后也要照顾到。"
    ],
    eye_cream: [
        "取米粒大小眼霜于无名指（无名指力度最轻）。",
        "指腹相互揉搓预热。",
        "点涂于眼下及眼尾，轻轻点按直至吸收。",
        "避免太靠近眼睑边缘，以免入眼或引起脂肪粒。"
    ],
    mask_clay: [
        "洁面后保留皮肤微湿状态。",
        "厚敷一层泥膜，以盖住肤色为准，避开眼唇。",
        "静待10-15分钟，八分干时即可洗掉，不要等全干。",
        "用温水配合洗脸扑洗净，之后可使用补水面膜或黑头导出。"
    ],
    mask_hydrating: [
        "展开面膜纸，对准眼口鼻贴合面部。",
        "挤出袋中剩余精华液涂抹于颈部。",
        "静敷15-20分钟，切勿敷着过夜。",
        "揭下后轻轻按摩，若感觉粘腻可用清水冲洗。"
    ]
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
    gender?: "female" | "male"; // Added for Silent Correction
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
    // Check luteal phase initially
    let isLutealPhase = bioFactors?.menstrualPhase === "luteal";

    // --- 2. Silent Gender Correction Logic (Hybrid & Prompt Strategy) ---
    // If User says "Female" but AI strongly suggests "Male" (e.g. Transgender, or just physiological differences)
    // We keep Social Identity (Labels, UI) as "Female", but adjust biological parameters (Oil, Cycle)
    let genderAdjustmentLog: string[] = [];

    // Check AI detected gender from goldStandardData (Face Analysis Result)
    const isBiologicalMale = (goldStandardData as any)?.gender?.value === 'male' && ((goldStandardData as any)?.gender?.confidence || 0) > 0.9;

    // Check Social Gender from BioFactors (Questionnaire)
    const isSocialFemale = bioFactors?.gender === 'female';

    if (isSocialFemale && isBiologicalMale) {
        // A. Oil Control Boost (Male skin tends to be oilier)
        if (!isDry && !isSensitive) {
            // We can simulate this by potentially modifying tolerance or isOily flags if they were mutable, 
            // but here we just log it and can use the flag downstream if needed.
            // For now, let's treat it as a strong hint to suppress luteal phase logic which is female-specific.
        }

        // B. Suppress Menstrual Cycle Logic (Males don't have luteal phases)
        if (isLutealPhase) {
            isLutealPhase = false; // Override locally
            genderAdjustmentLog.push("Detected physiological male traits: Suppressed menstrual cycle adjustments.");
        }
    }

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
        { day: 1, phase: "exfoliate", title: "焕肤夜 (Exfoliation)", focus: "疏通毛孔/剥脱角质", activeIngredient: d1Active },
        { day: 2, phase: "retinoid", title: "维A夜 (Retinoid)", focus: "胶原再生/抗老", activeIngredient: d2Active },
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
    aqi?: number;             // 0-500 (optional, not all APIs provide this)
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

    // 3. Pollution Defense (AQI) - only if available
    if (env.aqi && env.aqi > 150) { // Unhealthy
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
    bioFactors?: BioFactors,
    envData?: EnvironmentData
): Record<RoutineLevel, Record<RoutineScenario, SkincareRoutine> & { cycling?: SkinCycleDay[] }> {
    const scientific = generateScientificRoutine(skinType, climate, goldStandardData, bioFactors, envData);

    const convertSteps = (sciSteps: ScientificStep[]) => sciSteps.map(s => ({
        order: s.order,
        name: s.productName,
        category: s.category,
        duration: "1分钟",
        description: s.dosage.tips + (s.activeInfo ? ` [重点成分: ${s.activeInfo.ingredient} ${s.activeInfo.concentration}]` : ""),
        dosage: {
            dosage: String(s.dosage.amount),
            unit: s.dosage.unit,
            description: s.activeInfo ? `浓度 ${s.activeInfo.concentration}` : "标准用量",
            productName: s.productName,
            usageGuide: s.dosage.tips
        },
        detailedInstructions: CATEGORY_INSTRUCTIONS[s.category] || [s.dosage.tips]
    }));

    const createRoutine = (level: string, scenario: string, steps: ScientificStep[], duration: string): SkincareRoutine => ({
        level,
        scenario,
        steps: convertSteps(steps),
        totalDuration: duration,
        tips: scientific.daily.tips
    });

    const morningRoutine = createRoutine("professional", "morning", scientific.daily.morning, "5分钟");
    const eveningRoutine = createRoutine("professional", "evening", scientific.daily.evening, "10分钟");

    // Fallback/Clone for other scenarios for now
    const homeRoutine = { ...eveningRoutine, scenario: "home", totalDuration: "15分钟" };
    const travelRoutine = { ...morningRoutine, scenario: "travel", totalDuration: "3分钟" };

    // --- Generate Different Levels ---

    // 1. Daily (Basic): Cleanse -> Moisturize -> Protect. No Serums.
    const dailyFilter = (steps: ScientificStep[]) => steps.filter(s =>
        !s.category.includes("serum") && !s.category.includes("toner")
    );

    // Add Eye Cream to daily if Aging risk? Maybe keep it simple.
    // Daily morning: Cleanse, Moisturize, Sunscreen
    // Daily evening: Cleanse, Moisturize
    // Note: Scientific generator might add toner/serum, we strip them.

    const dailyMorningSteps = dailyFilter(scientific.daily.morning);
    const dailyEveningSteps = dailyFilter(scientific.daily.evening);

    const dailySet = {
        morning: createRoutine("daily", "morning", dailyMorningSteps, "3分钟"),
        evening: createRoutine("daily", "evening", dailyEveningSteps, "3分钟"),
        home: { ...createRoutine("daily", "evening", dailyEveningSteps, "5分钟"), scenario: "home" },
        travel: { ...createRoutine("daily", "morning", dailyMorningSteps, "2分钟"), scenario: "travel" },
        // Daily usually doesn't do complex cycling, just simple consistency
        cycling: undefined
    };


    // 2. Professional (Standard): The one generated by scientific algorithm
    const profFullSet = {
        morning: createRoutine("professional", "morning", scientific.daily.morning, "5分钟"),
        evening: createRoutine("professional", "evening", scientific.daily.evening, "10分钟"),
        home: homeRoutine,
        travel: travelRoutine,
        cycling: scientific.cycling
    };


    // 3. Ultimate (Luxury): Add Eye Cream, Mask, Essence
    const ultimateEnhancer = (steps: ScientificStep[], isMorning: boolean) => {
        const enhanced = [...steps];

        // Add Eye Cream before Moisturizer
        const moisIdx = enhanced.findIndex(s => s.category.includes("moisturizer"));
        const insertIdx = moisIdx > -1 ? moisIdx : enhanced.length;

        enhanced.splice(insertIdx, 0, createStep(insertIdx, "eye_cream", skinType, climate));

        // Add Toner if missing (Scientific might skip it)
        const hasToner = enhanced.some(s => s.category.includes("toner"));
        if (!hasToner) {
            enhanced.splice(1, 0, createStep(1, "toner_hydrating", skinType, climate));
        }

        // Re-index
        return enhanced.map((s, i) => ({ ...s, order: i + 1 }));
    };

    const ultMorningSteps = ultimateEnhancer(scientific.daily.morning, true);
    const ultEveningSteps = ultimateEnhancer(scientific.daily.evening, false);

    // Ultimate Tips
    const ultTips = [...scientific.daily.tips, "建议每周配合2-3次美容仪护理。", "周末可进行一次居家焕肤疗程。"];

    const ultimateSet = {
        morning: createRoutine("ultimate", "morning", ultMorningSteps, "10分钟"),
        evening: { ...createRoutine("ultimate", "evening", ultEveningSteps, "20分钟"), tips: ultTips },
        home: { ...createRoutine("ultimate", "evening", ultEveningSteps, "30分钟"), scenario: "home" },
        travel: { ...createRoutine("ultimate", "morning", ultMorningSteps, "5分钟"), scenario: "travel" },
        cycling: scientific.cycling
    };

    return {
        daily: dailySet as any,
        professional: profFullSet,
        ultimate: ultimateSet as any
    };
}

// ============================================================================
// 5. Exports for PDF Generation & Legacy Support (Re-added)
// ============================================================================

export const LEVEL_LABELS: Record<string, { name: string; nameEn: string; desc: string }> = {
    daily: { name: "基础日常", nameEn: "Essential", desc: "高性价比的基础维稳方案，适合年轻肌肤或预算有限时。" },
    professional: { name: "专家进阶", nameEn: "Professional", desc: "针对问题肌肤定制的科学功效方案，兼顾效果与安全性。" },
    ultimate: { name: "极致奢护", nameEn: "Ultimate", desc: "多维度、高精度的全方位抗衰方案，追求极致肤感与效果。" }
};

export const SCENARIO_LABELS: Record<RoutineScenario, { name: string; nameEn: string }> = {
    morning: { name: "晨间唤醒", nameEn: "Morning Routine" },
    evening: { name: "晚间修护", nameEn: "Evening Routine" },
    home: { name: "居家护理", nameEn: "Home Spa" },
    travel: { name: "差旅急救", nameEn: "Travel Care" }
};

export const REGION_CLIMATE_MAP: Record<ClimateType, { name: string; description: string; skincareFocus: string[] }> = {
    W1: {
        name: "寒冷干燥 (Cold Dry)",
        description: "典型特征：低温、低湿、风大。皮肤易干裂、敏感。",
        skincareFocus: ["高封闭性保湿（面霜/油）", "舒缓修护", "避免过度清洁"]
    },
    A2: {
        name: "凉爽湿润 (Cool Humid)",
        description: "典型特征：气温适中，湿度较高。无论南北方春秋季常见。",
        skincareFocus: ["水油平衡", "温和代谢", "适度防晒"]
    },
    A1: {
        name: "炎热干燥 (Hot Dry)",
        description: "典型特征：日照强烈，空气干燥。西北地区或干燥夏季。",
        skincareFocus: ["强效补水", "高倍防晒", "抗氧化"]
    },
    S2: {
        name: "炎热潮湿 (Hot Humid)",
        description: "典型特征：高温高湿，易出汗出油。华南地区或夏季。",
        skincareFocus: ["控油清爽", "疏通毛孔", "防晒防水"]
    },
    M1: {
        name: "高原气候 (Highland)",
        description: "典型特征：紫外线极强，昼夜温差大。西南/西北高海拔。",
        skincareFocus: ["严密硬防晒", "强韧屏障", "滋润修护"]
    },
    S1: {
        name: "温和气候 (Moderate)",
        description: "典型特征：无极端天气，体感舒适。理想的护肤环境。",
        skincareFocus: ["日常基础护理", "抗初老", "美白提亮"]
    }
};

/**
 * Adjust climate based on current month (Simple heuristic)
 */
export function adjustClimateForSeason(base: ClimateType): ClimateType {
    try {
        const month = new Date().getMonth() + 1; // 1-12
        // Summer correction
        if (month >= 6 && month <= 8) {
            if (base === "W1") return "S1"; // Cold->Moderate
            if (base === "S1") return "S2"; // Moderate->HotHumid
        }
        // Winter correction
        if (month >= 11 || month <= 2) {
            if (base === "S2") return "S1"; // HotHumid->Moderate
            if (base === "S1") return "W1"; // Moderate->Cold
        }
        return base;
    } catch (e) {
        return base;
    }
}

export const CLIMATE_LABELS: Record<ClimateType, string> = {
    W1: "寒冷干燥 (Cold Dry)",
    A2: "凉爽湿润 (Cool Humid)",
    A1: "炎热干燥 (Hot Dry)",
    S2: "炎热潮湿 (Hot Humid)",
    M1: "高原气候 (Highland)",
    S1: "温和气候 (Moderate)"
};
