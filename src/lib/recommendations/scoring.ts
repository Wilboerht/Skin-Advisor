/**
 * 产品匹配评分：关注点/肤质/年龄/预算/环境/负面标签 + 孕期/过敏硬排除。
 * 纯函数，便于单测；DB 查询与排序在 candidates.ts / recommendations.ts。
 */

import type { QuestionnaireAnswers } from "@/lib/advisor-utils";
import type { EnvContext } from "@/lib/weather-context";
import { PREGNANCY_FORBIDDEN_TERMS, getAllergyTerms } from "@/lib/ingredient-guard";
import type { ProductRecommendation } from "./types";

/**
 * 精华品类仅对「奢华派 / 冻龄派」开放：精华是进阶抗老/奢护步骤，
 * 其余派系（敏敏/极简/沙漠/油条/混合/守护）的方案不落到精华产品。
 */
export const SERUM_ALLOWED_PERSONAS = new Set(["luxury", "ageless"]);

/** 判断是否精华品类（兼容 精华 / 精华露 / 精华液 等历史与现行品类值） */
export function isSerumCategory(category?: string): boolean {
    return !!category && category.includes("精华");
}

/** 关注点到功效标签的映射 */
const CONCERN_TO_BENEFITS: Record<string, string[]> = {
    anti_aging: ["抗老", "抗初老", "紧致", "抗皱", "胶原", "弹力", "年轻", "修护光损伤", "抗氧化"],
    fine_lines: ["淡纹", "抗皱", "平滑", "抚纹"],
    dullness: ["提亮", "提亮肤色", "亮白", "焕亮", "光泽", "透亮", "均匀肤色"],
    pigmentation: ["淡斑", "美白", "均匀", "去印", "焕白", "淡化痘印"],
    hydration: ["补水", "保湿", "锁水", "滋润", "水润", "润泽", "微补水"],
    sensitivity: ["舒缓", "舒缓褪红", "修护", "修护屏障", "镇静", "敏感", "温和", "屏障", "修护皮脂膜"],
    acne: ["祛痘", "净痘", "控痘", "消炎", "净化", "调理", "控油"],
    aging: ["抗老", "抗初老", "紧致", "抗皱", "修护光损伤", "抗氧化"],
    wrinkles: ["淡纹", "抗皱", "平滑"],
    spots: ["淡斑", "美白", "淡化痘印"],
    dryness: ["补水", "保湿", "滋润", "微补水", "修护皮脂膜", "以油养肤"],
    oil_control: ["控油", "清爽", "平衡"],
    dark_circles: ["眼周", "眼部", "黑眼圈", "眼袋"],
    roughness: ["改善粗糙", "平滑", "细致"],
    waterOil: ["平衡", "调理", "控油", "补水"],
};

/** 肤质到功效标签的映射 */
const SKINTYPE_TO_BENEFITS: Record<string, string[]> = {
    dry: ["滋润", "保湿", "修护", "滋养", "营养"],
    oily: ["控油", "清爽", "净化", "平衡", "调理"],
    combination: ["平衡", "调理", "均衡", "双效"],
    combination_dry: ["滋润", "保湿", "平衡", "分区"],
    combination_oily: ["控油", "清爽", "平衡", "细致"],
    sensitive: ["舒缓", "温和", "修护", "镇静"],
    normal: ["维稳", "保养", "平衡", "健康"],
    unknown: ["保湿", "温和", "平衡", "基础"],
};

/** 预算到价格范围的映射（用于按用户预算名查找区间） */
const BUDGET_TO_PRICE: Record<string, { min: number; max: number; tier: number }> = {
    budget: { min: 0, max: 500, tier: 0 },
    mid: { min: 300, max: 1000, tier: 1 },
    premium: { min: 800, max: 2000, tier: 2 },
    luxury: { min: 1500, max: Infinity, tier: 3 },
};

/**
 * 价格档位有序列表（从低到高排列）。
 * 按价格从低到高显式排序，确保区间重叠时返回最低匹配档位。
 */
const PRICE_TIERS = [
    { min: 0, max: 500, tier: 0 },
    { min: 300, max: 1000, tier: 1 },
    { min: 800, max: 2000, tier: 2 },
    { min: 1500, max: Infinity, tier: 3 },
] as const;

/** 环境功效匹配权重（每标签 +15 分） */
const ENV_BENEFIT_SCORE = 15;

/** 年龄段到推荐功效的映射 */
const AGE_TO_BENEFITS: Record<string, string[]> = {
    "under20": ["控油", "清爽", "补水", "净化", "祛痘"],
    "20-25": ["补水", "保湿", "提亮", "抗氧化", "防护"],
    "26-30": ["补水", "保湿", "提亮", "抗氧化", "防护"],
    "31-40": ["抗老", "紧致", "淡纹", "修护", "保湿"],
    "41-50": ["抗皱", "紧致", "淡斑", "滋养", "胶原"],
    "above50": ["紧致", "滋养", "修护", "抗皱", "弹力"],
};

/** 产品基础类型（与 Prisma Product 模型对齐的简化类型） */
export interface ProductBase {
    id: string;
    name: string;
    benefits: unknown;
    suitableSkinTypes: unknown;
    negativeFor: unknown;
    keyIngredients?: unknown;
    price: string | number;
    featured?: boolean;
    image?: string;
    category?: string;
}

/**
 * 孕期/哺乳期产品硬排除（纯函数，供 calculateScore 与单测复用）：
 * - 产品 negativeFor 标签含 孕妇/哺乳期/孕期 → 排除
 * - 产品成分表命中孕期禁忌成分（精油类/香精）→ 排除
 * - pregnancyCautious 包含"不确定"（按孕期标准谨慎推荐）。
 */
export function isProductExcludedForPregnancy(
    product: { negativeFor?: unknown; keyIngredients?: unknown },
    pregnancyCautious: boolean
): { excluded: boolean; reason?: string } {
    if (!pregnancyCautious) return { excluded: false };

    const negativeTags: string[] = Array.isArray(product.negativeFor)
        ? (product.negativeFor as string[]).filter((s): s is string => typeof s === "string")
        : typeof product.negativeFor === "string" && product.negativeFor
            ? [product.negativeFor]
            : [];
    if (negativeTags.some((t) => /孕妇|孕期|哺乳|pregnan|breastfeed|lactation/i.test(t))) {
        return { excluded: true, reason: "⚠️ 孕期/哺乳期不适用" };
    }

    const ingredients: string[] = Array.isArray(product.keyIngredients)
        ? (product.keyIngredients as string[]).filter((s): s is string => typeof s === "string")
        : typeof product.keyIngredients === "string" && product.keyIngredients
            ? [product.keyIngredients]
            : [];
    const ingredientText = ingredients.join(" ").toLowerCase();
    if (ingredientText) {
        const hit = PREGNANCY_FORBIDDEN_TERMS.find((term) => ingredientText.includes(term.toLowerCase()));
        if (hit) {
            return { excluded: true, reason: `⚠️ 含孕期需回避成分（${hit}）` };
        }
    }

    return { excluded: false };
}

export function isProductExcludedForAllergies(
    product: { name?: unknown; benefits?: unknown; keyIngredients?: unknown },
    allergies: string | string[] | null | undefined
): { excluded: boolean; reason?: string } {
    const terms = getAllergyTerms(allergies);
    if (terms.length === 0) return { excluded: false };

    const ingredientText = Array.isArray(product.keyIngredients)
        ? product.keyIngredients.filter((s): s is string => typeof s === "string").join(" ")
        : typeof product.keyIngredients === "string" ? product.keyIngredients : "";
    const nameText = typeof product.name === "string" ? product.name : "";
    const benefitText = Array.isArray(product.benefits)
        ? product.benefits.filter((s): s is string => typeof s === "string").join(" ")
        : "";
    const haystack = `${nameText} ${ingredientText} ${benefitText}`.toLowerCase();

    const hit = terms.find((term) => haystack.includes(term.toLowerCase()));
    return hit
        ? { excluded: true, reason: `⚠️ 含您需要避开的成分（${hit}）` }
        : { excluded: false };
}

export function calculateScore(
    product: ProductBase,
    skinType: string,
    concerns: string[],
    answers: QuestionnaireAnswers,
    envContext?: EnvContext
): { score: number; reasons: string[]; matchedBenefits: string[]; envTags: string[]; budgetLabel: ProductRecommendation["budgetLabel"]; excluded: boolean } {
    let score = 0;
    const reasons: string[] = [];
    const matchedBenefits: string[] = [];
    const envTags: string[] = [];
    let budgetLabel: ProductRecommendation["budgetLabel"] = "unknown";
    let excluded = false;

    const productBenefits: string[] = Array.isArray(product.benefits)
        ? product.benefits as string[]
        : [];

    // 1. 关注点匹配（每匹配 +30 分）
    concerns.forEach((concern) => {
        const relatedBenefits = CONCERN_TO_BENEFITS[concern] || [];
        relatedBenefits.forEach((benefit) => {
            if (productBenefits.some((b) => b === benefit)) {
                score += 30;
                if (!matchedBenefits.includes(benefit)) {
                    matchedBenefits.push(benefit);
                }
            }
        });
    });

    // 2. 年龄段匹配（每匹配 +25 分）
    if (answers.ageRange) {
        const ageBenefits = AGE_TO_BENEFITS[answers.ageRange] || [];
        ageBenefits.forEach((benefit) => {
            if (productBenefits.some((b) => b === benefit)) {
                score += 25;
                if (!matchedBenefits.includes(benefit)) {
                    matchedBenefits.push(benefit);
                }
            }
        });
    }

    // 3. 肤质匹配（每匹配 +20 分）
    if (skinType) {
        const skinBenefits = SKINTYPE_TO_BENEFITS[skinType] || [];
        skinBenefits.forEach((benefit) => {
            if (productBenefits.some((b) => b === benefit)) {
                score += 20;
                if (!matchedBenefits.includes(benefit)) {
                    matchedBenefits.push(benefit);
                }
            }
        });
    }

    // 4. 预算匹配：在预算范围内 +25 分
    if (answers.budget) {
        const userBudget = BUDGET_TO_PRICE[answers.budget];
        const priceMatch = String(product.price).match(/[0-9]+(?:\.[0-9]+)?/);
        const productPrice = priceMatch ? Number(priceMatch[0]) : 0;
        if (userBudget && !isNaN(productPrice) && productPrice > 0) {
            const productTier = findPriceTier(productPrice);
            const userTier = userBudget.tier;

            if (productPrice >= userBudget.min && productPrice <= userBudget.max) {
                score += 25;
                reasons.push("符合预算范围");
                budgetLabel = "within_budget";
            } else if (productPrice <= userBudget.max * 1.3) {
                budgetLabel = "near_budget";
            } else if (productTier > userTier) {
                budgetLabel = "over_budget";
            } else {
                budgetLabel = "within_budget";
            }
        }
    }

    if (product.featured) { score += 10; }

    // 5b. 适用肤质直接匹配（+25 分）
    if (skinType) {
        const suitableTypes: string[] = Array.isArray(product.suitableSkinTypes)
            ? product.suitableSkinTypes as string[]
            : [];
        if (suitableTypes.includes(skinType) || suitableTypes.includes('all')) {
            score += 25;
            reasons.push("适用于您的肤质");
        }
    }

    // 5c. 环境/季节感知匹配（每匹配 +ENV_BENEFIT_SCORE 分）
    if (envContext && envContext.benefitTags.length > 0) {
        envContext.benefitTags.forEach((envTag) => {
            if (productBenefits.some((b) => b === envTag || b.includes(envTag))) {
                score += ENV_BENEFIT_SCORE;
                if (!envTags.includes(envTag)) {
                    envTags.push(envTag);
                }
            }
        });
        if (envTags.length > 0) {
            reasons.push(`适合${envContext.description}`);
        }
    }

    // 6. 负面关键词排除
    const negativeTags: string[] = Array.isArray(product.negativeFor)
        ? product.negativeFor as string[]
        : [];

    if (negativeTags.length > 0) {
        const skinTypeNegativeMap: Record<string, string[]> = {
            dry: ["干皮", "干性", "干燥肌"],
            oily: ["油皮", "油性", "痘痘肌", "致痘"],
            sensitive: ["敏感肌", "敏感", "刺激", "酒精"],
            combination: ["闷痘", "厚重"],
            combination_dry: ["闷痘", "厚重"],
            combination_oily: ["油腻", "闷痘", "厚重"],
        };
        const skinNegatives = skinTypeNegativeMap[skinType] || [];
        if (skinNegatives.some(tag => negativeTags.includes(tag))) {
            score -= 300;
            excluded = true;
            reasons.push("⚠️ 不适合您的肤质");
        }

        if (concerns.includes("acne") && negativeTags.some(t => ["致痘", "痘痘肌", "闷痘"].includes(t))) {
            score = 0;
            excluded = true;
            reasons.push("⚠️ 不适合您的肤质/状况");
        }
        if (concerns.includes("sensitivity") && negativeTags.some(t => ["刺激", "敏感肌", "酒精", "香精"].includes(t))) {
            score = 0;
            excluded = true;
            reasons.push("⚠️ 不适合您的肤质/状况");
        }
    }

    // 7. 孕期/哺乳期硬排除
    const pregnancyRaw = answers.pregnancy ?? answers.pregnancyStatus;
    const pregnancyCautious = pregnancyRaw === "yes" || pregnancyRaw === "unknown";
    const pregnancyCheck = isProductExcludedForPregnancy(product, pregnancyCautious);
    if (pregnancyCheck.excluded) {
        score = 0;
        excluded = true;
        reasons.push(pregnancyCheck.reason || "⚠️ 孕期/哺乳期不适用");
    }

    const allergyCheck = isProductExcludedForAllergies(product, answers.allergies);
    if (allergyCheck.excluded) {
        score = 0;
        excluded = true;
        reasons.push(allergyCheck.reason || "⚠️ 含您需要避开的成分");
    }

    const hasNegativeReason = excluded || reasons.some(r => r.includes("不适合"));
    if (score < 0) score = 0;
    if (score === 0 && !hasNegativeReason) score = 10;

    return { score, reasons, matchedBenefits, envTags, budgetLabel, excluded };
}

/** 根据产品价格确定其所属预算 tier */
function findPriceTier(price: number): number {
    for (const tier of PRICE_TIERS) {
        if (price >= tier.min && price <= tier.max) return tier.tier;
    }
    return Number.MAX_SAFE_INTEGER;
}
