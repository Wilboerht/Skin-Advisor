
import prisma from "@/lib/prisma";
import { QuestionnaireAnswers } from "@/lib/advisor-utils";
import type { Product } from "@prisma/client";
import type { EnvContext } from "@/lib/weather-context";
import { getSeasonLabel } from "@/lib/weather-context";
/** 带算法评分的商品（由 getCandidateProducts 生成） */
type ScoredProduct = Product & {
    _score: number;
    matchedBenefits: string[];
    _envTags?: string[];
    _budgetLabel?: ProductRecommendation["budgetLabel"];
};

export interface ProductRecommendation {
    id: string;
    name: string;
    category: string;
    image: string;
    images?: string[] | null;
    price: string;
    reason: string;
    description?: string | null;
    score?: number;
    matchedBenefits?: string[];
    affiliateLinks?: Record<string, string> | null;
    howToUse?: string | null;
    /** 推荐来源：persona（IP 池内）| algorithm（池外补充） */
    source?: "persona" | "algorithm";
    /** 预算匹配标签：within_budget | near_budget | over_budget | unknown */
    budgetLabel?: "within_budget" | "near_budget" | "over_budget" | "unknown";
    /** 环境相关匹配标签 */
    envTags?: string[];
    /** 社交证明：协同过滤标签 */
    socialProof?: {
        /** 如 "沙漠派用户的选择" */
        label: string;
        /** 如 87（代表87%的回购率或选择率） */
        affinity: number;
        /** 如 "87% 的同派系用户选择了这款产品" */
        detail: string;
    };
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
 * 价格档位有序列表（从低到高排列）
 *
 * 用于将产品价格归类到对应的预算档位。按价格从低到高显式排序，
 * 确保区间重叠时（如 budget 0-500 与 mid 300-1000 同时匹配 400 元）
 * 始终返回最低匹配档位——即产品自身所处的价格区间。
 *
 * 与 BUDGET_TO_PRICE 解耦：后者用于按用户预算名 O(1) 查找，
 * 本数组用于按价格顺序遍历分类，二者职责不同。
 */
const PRICE_TIERS = [
    { min: 0, max: 500, tier: 0 },       // 性价比
    { min: 300, max: 1000, tier: 1 },     // 中等预算
    { min: 800, max: 2000, tier: 2 },     // 品质优先
    { min: 1500, max: Infinity, tier: 3 }, // 不设上限
] as const;

/** 环境功效匹配权重（每标签 +15 分，低于肤质但高于精选产品 */
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



/**
 * Calculate match score for a product (Enhanced)
 */
// 产品基础类型（与 Prisma Product 模型对齐的简化类型）
interface ProductBase {
    id: string;
    name: string;
    benefits: unknown;
    suitableSkinTypes: unknown;
    negativeFor: unknown;
    price: string | number;
    featured?: boolean;
    image?: string;
    category?: string;
}

function calculateScore(
    product: ProductBase,
    skinType: string,
    concerns: string[],
    answers: QuestionnaireAnswers,
    envContext?: EnvContext
): { score: number; reasons: string[]; matchedBenefits: string[]; envTags: string[]; budgetLabel: ProductRecommendation["budgetLabel"] } {
    let score = 0;
    const reasons: string[] = [];
    const matchedBenefits: string[] = [];
    const envTags: string[] = [];
    let budgetLabel: ProductRecommendation["budgetLabel"] = "unknown";

    // Parse JSON fields safely if stringified or use directly if object
    // Assuming Prisma returns Json value which is already parsed object/array
    const productBenefits: string[] = Array.isArray(product.benefits)
        ? product.benefits as string[]
        : [];

    // 1. 关注点匹配（权重最高：每匹配 +30 分）
    concerns.forEach((concern) => {
        const relatedBenefits = CONCERN_TO_BENEFITS[concern] || [];
        // Support also mapping from old generic names if needed
        relatedBenefits.forEach((benefit) => {
            if (productBenefits.some((b) => b === benefit)) {
                score += 30;
                if (!matchedBenefits.includes(benefit)) {
                    matchedBenefits.push(benefit);
                }
            }
        });
    });

    // 2. 年龄段匹配（新增：每匹配 +25 分）
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

    // 3. 肤质匹配（权重中等：每匹配 +20 分）
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

    // 4. 预算匹配：在预算范围内的产品获得固定 +25 分奖励，不扣分
    if (answers.budget) {
        const userBudget = BUDGET_TO_PRICE[answers.budget];
        const priceMatch = String(product.price).match(/[0-9]+(?:\.[0-9]+)?/);
        const productPrice = priceMatch ? Number(priceMatch[0]) : 0;
        if (userBudget && !isNaN(productPrice) && productPrice > 0) {
            // 判断产品价格在哪个预算区间
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

    // 5. 推荐产品加分（+10 分）
    if (product.featured) { score += 10; }

    // 5b. 适用肤质直接匹配（+25 分）— 使用结构化 suitableSkinTypes 数据
    if (skinType) {
        const suitableTypes: string[] = Array.isArray(product.suitableSkinTypes)
            ? product.suitableSkinTypes as string[]
            : [];
        if (suitableTypes.includes(skinType) || suitableTypes.includes('all')) {
            score += 25;
            reasons.push("适用于您的肤质");
        }
    }

    // 5c. 环境/季节感知匹配（新增：每匹配 +ENV_BENEFIT_SCORE 分）
    if (envContext && envContext.benefitTags.length > 0) {
        envContext.benefitTags.forEach((envTag) => {
            // 用环境标签匹配产品的 benefits 数组
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

    // 6. 负面关键词排除 — 产品明确不适合当前用户特征时大幅扣分
    const negativeTags: string[] = Array.isArray(product.negativeFor)
        ? product.negativeFor as string[]
        : [];

    if (negativeTags.length > 0) {
        // 肤质负面匹配
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
            reasons.push("⚠️ 不适合您的肤质");
        }

        // 关注点负面匹配
        if (concerns.includes("acne") && negativeTags.some(t => ["致痘", "痘痘肌", "闷痘"].includes(t))) {
            score = 0;
            reasons.push("⚠️ 不适合您的肤质/状况");
        }
        if (concerns.includes("sensitivity") && negativeTags.some(t => ["刺激", "敏感肌", "酒精", "香精"].includes(t))) {
            score = 0;
            reasons.push("⚠️ 不适合您的肤质/状况");
        }
        if (concerns.includes("anti_aging") && negativeTags.some(t => ["孕妇", "哺乳期"].includes(t))) {
            score = 0;
            reasons.push("⚠️ 不适合您的肤质/状况");
        }
    }

    // Base Score fallback：有负面理由时保持 0 分，不允许被恢复为保底分
    const hasNegativeReason = reasons.some(r => r.includes("不适合"));
    if (score < 0) score = 0;
    if (score === 0 && !hasNegativeReason) score = 10;

    return { score, reasons, matchedBenefits, envTags, budgetLabel };
}

// ==================== 辅助函数 ====================

/** 根据产品价格确定其所属预算 tier（按价格从低到高匹配，重叠区间返回首个匹配档位） */
function findPriceTier(price: number): number {
    for (const tier of PRICE_TIERS) {
        if (price >= tier.min && price <= tier.max) return tier.tier;
    }
    return Number.MAX_SAFE_INTEGER;
}

/**
 * Generate intelligent recommendation reason (Enhanced)
 * 个性化推荐理由：结合产品信息、用户肤质、派系身份和季节环境
 */
function generateSmartReason(
    matchedBenefits: string[],
    concerns: string[],
    skinType: string,
    index: number = 0,
    productName?: string,
    productCategory?: string,
    persona?: string,
    season?: string,
    envContext?: EnvContext
): string {
    // Persona 风格前缀（每派有独特的语气）
    const personaFlavors: Record<string, string> = {
        sensitive: "温柔守护",
        minimalist: "精简高效",
        luxury: "奢华甄选",
        ageless: "时光逆转",
        desert: "深层润泽",
        oily: "清爽平衡",
        combination: "分区调理",
        guardian: "坚实守护",
    };

    // 1. 优先：匹配的功效 + 产品类别 + persona 风格
    if (matchedBenefits.length > 0) {
        const benefitText = matchedBenefits.slice(0, 2).join("、");
        const catText = productCategory || "";
        const personaHint = persona ? (personaFlavors[persona] || "") : "";

        const templates = [
            `${benefitText}${catText ? ` · ${catText}` : ""}，${personaHint || "精准匹配"}`,
            `主打${benefitText}，${catText ? `${catText}级` : ""}呵护你的${getSkinTypeLabelShort(skinType)}`,
            `富含${benefitText}成分，${personaHint ? `${personaHint}之选` : "改善肌肤状态"}`,
            `针对${getConcernLabelShort(concerns[index]) || "肌肤需求"}，${benefitText}${catText ? ` · ${catText}` : ""}`,
            `${benefitText}配方${catText ? `，${catText}品类优选` : "，科学护肤"}`,
            `专研${benefitText}，${season ? `适合${season}使用` : "回应肌肤诉求"}`,
            `${personaHint ? `${personaHint}·` : ""}${benefitText}${catText ? ` ${catText}` : ""}`,
            `${benefitText}协同呵护，${catText || "精准配方"}${season ? ` · ${season}推荐` : ""}`,
        ];
        return templates[index % templates.length];
    }

    // 2. 降级：基于关注点的理由（增加类别+季节信息）
    const concernReasons: Record<string, string[]> = {
        anti_aging: ["淡化细纹，紧致肌肤", "抗氧化修护，延缓老化"],
        aging: ["延衰抗老，紧致提升", "深层修护，逆转肌龄"],
        fine_lines: ["淡化表情纹与干纹", "平滑肌肤纹理"],
        wrinkles: ["减少皱纹深度，紧致轮廓", "抗皱提拉，重塑弹力"],
        dullness: ["提亮肤色，焕发光彩", "改善暗沉，恢复通透感"],
        dull: ["焕亮肤色，祛黄提气", "击退暗沉，光泽透亮"],
        pigmentation: ["淡化色斑，均匀肤色", "阻断黑色素，焕白透亮"],
        spots: ["淡化痘印色斑，均匀提亮", "改善色素沉着，净白肌肤"],
        hydration: ["深层补水，持久保湿", "修护皮脂膜，锁水屏障"],
        dryness: ["密集补水，改善干燥脱皮", "滋润修护，缓解紧绷感"],
        sensitivity: ["舒缓褪红，温和修护", "增强屏障，降低敏感度"],
        acne: ["控油祛痘，净化毛孔", "平衡微生态，预防闭口"],
        oil_control: ["清爽控油，平衡水油", "调节皮脂，维持清爽"],
        dark_circles: ["修护眼周，淡化黑眼圈", "改善微循环，提亮眼周"],
        roughness: ["改善粗糙肤质，细致平滑", "温和焕肤，细腻毛孔"],
        waterOil: ["平衡水油，分区调理", "T区控油U区保湿"],
    };

    if (concerns.length > 0) {
        const concern = concerns[index % concerns.length];
        const reasons = concernReasons[concern];
        if (reasons) {
            const reason = reasons[index % reasons.length];
            const catHint = productCategory ? ` · ${productCategory}` : "";
            const seasonHint = season ? ` (${season}适用)` : "";
            return `${reason}${catHint}${seasonHint}`;
        }
    }

    // 3. 再次降级：肤质 + 环境理由
    const skinReasons: Record<string, string> = {
        dry: "滋润保湿，改善干燥紧绷",
        oily: "清爽控油，平衡水油分泌",
        combination: "分区护理，平衡T区与U区",
        combination_dry: "针对混干肤质，T区清爽U区滋润",
        combination_oily: "针对混油肤质，平衡多余油脂",
        sensitive: "温和低敏配方，呵护脆弱肌肤",
        normal: "维稳保养，维持水油平衡",
    };

    if (skinType && skinReasons[skinType]) {
        const skReason = skinReasons[skinType];
        const envHint = envContext ? `，${envContext.description}` : "";
        return `${skReason}${envHint}`;
    }

    return "适合日常护肤使用，维持肌肤健康状态";
}

/** 获取肤质短标签（用于推荐理由） */
function getSkinTypeLabelShort(skinType: string): string {
    const labels: Record<string, string> = {
        dry: "干性肌", oily: "油性肌", combination: "混合肌",
        combination_dry: "混干肌", combination_oily: "混油肌",
        sensitive: "敏感肌", normal: "中性肌",
    };
    return labels[skinType] || "肌肤";
}

/** 获取关注点短标签 */
function getConcernLabelShort(concern?: string): string {
    if (!concern) return "";
    const labels: Record<string, string> = {
        anti_aging: "抗老需求", aging: "抗老需求", fine_lines: "细纹困扰",
        wrinkles: "皱纹困扰", dullness: "暗沉问题", dull: "暗沉问题",
        pigmentation: "色斑困扰", spots: "色斑困扰", hydration: "补水需求",
        dryness: "干燥问题", sensitivity: "敏感困扰", acne: "痘痘困扰",
        oil_control: "控油需求", dark_circles: "黑眼圈", roughness: "粗糙肤质",
        waterOil: "水油失衡",
    };
    return labels[concern] || concern;
}

/** 规则匹配条件（扩展 persona） */
interface RuleConditions {
    skinType?: string[];
    concern?: string[];
    persona?: string[];
}

/** 检查规则条件是否匹配当前用户 */
function ruleMatches(
    rawConditions: unknown,
    skinType: string,
    concerns: string[],
    persona?: string
): boolean {
    if (!rawConditions || typeof rawConditions !== 'object' || Array.isArray(rawConditions)) return false;
    const conditions = rawConditions as RuleConditions;
    if (conditions.skinType?.length && !conditions.skinType.includes(skinType)) return false;
    if (conditions.concern?.length && !concerns.some(c => conditions.concern!.includes(c))) return false;
    if (conditions.persona?.length && (!persona || !conditions.persona.includes(persona))) return false;
    return true;
}

/** 判断规则是否包含 persona 条件 */
function ruleHasPersonaCondition(rawConditions: unknown): boolean {
    if (!rawConditions || typeof rawConditions !== 'object' || Array.isArray(rawConditions)) return false;
    const conditions = rawConditions as RuleConditions;
    return !!conditions.persona?.length;
}

/**
 * Pre-filter products for AI context (RAG Lite)
 * Returns top N products based on heuristic scoring to save tokens
 * @param persona — IP 形象 key，如 "guardian"，限制产品池
 */
export async function getCandidateProducts(
    answers: QuestionnaireAnswers,
    concerns: string[],
    limit: number = 10,
    persona?: string,
    envContext?: EnvContext
): Promise<ScoredProduct[]> {
    try {
        const allProducts = await prisma.product.findMany({
            where: { active: true }
        });

        if (allProducts.length === 0) return [];

        const skinType = answers.skinType || "combination";

        // 2. Score using our heuristic engine (now with envContext)
        let scored = allProducts.map(p => {
            const { score, matchedBenefits, envTags, budgetLabel } = calculateScore(p, skinType, concerns, answers, envContext);
            return { ...p, _score: score, matchedBenefits, _envTags: envTags, _budgetLabel: budgetLabel };
        });

        // 2b. User feedback boost: batch query product average ratings (last 30 days)
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const feedbackAggs = await prisma.productFeedback.groupBy({
                by: ["productId"],
                where: { createdAt: { gte: thirtyDaysAgo } },
                _avg: { rating: true },
                _count: { rating: true },
            });
            const feedbackMap = new Map<string, number>();
            for (const agg of feedbackAggs) {
                if (agg._avg.rating && agg._count.rating >= 3 && agg._avg.rating >= 4) {
                    feedbackMap.set(agg.productId, agg._avg.rating);
                }
            }
            if (feedbackMap.size > 0) {
                scored = scored.map(p => {
                    const avgRating = feedbackMap.get(p.id);
                    if (avgRating) {
                        return { ...p, _score: p._score + 15 };
                    }
                    return p;
                });
            }
        } catch (feedbackErr) {
            console.warn("Feedback boost query failed (non-fatal):", feedbackErr);
        }

        // 3. Inject Forced Rules (Hard Rules)
        const activeRules = await prisma.recommendationRule.findMany({
            where: { active: true },
            orderBy: { priority: 'desc' },
            include: { products: { select: { productId: true } } }
        });

        // Simple Rule Engine — persona-aware
        const forcedProductIds = new Set<string>();
        const personaProductIds = new Set<string>();

        for (const rule of activeRules) {
            if (!ruleMatches(rule.conditions, skinType, concerns, persona)) continue;

            rule.products.forEach(p => {
                forcedProductIds.add(p.productId);
                if (ruleHasPersonaCondition(rule.conditions)) {
                    personaProductIds.add(p.productId);
                }
            });
        }

        // Boost forced products score to ensure they are in top list
        scored = scored.map(p => {
            if (forcedProductIds.has(p.id)) {
                return { ...p, _score: p._score + 1000 };
            }
            return p;
        });

        // 4. Persona pool restriction: if persona rules matched, limit to that pool
        if (persona && personaProductIds.size > 0) {
            const pool = scored
                .filter(p => personaProductIds.has(p.id))
                .sort((a, b) => b._score - a._score);

            if (pool.length >= limit) {
                return pool.slice(0, limit);
            }

            // 池内不足，从池外补位并标记为 "algorithm"
            const rest = scored
                .filter(p => !personaProductIds.has(p.id))
                .sort((a, b) => b._score - a._score);

            return [...pool, ...rest].slice(0, limit);
        }

        // 5. Non-persona scenario: keep original logic
        scored.sort((a, b) => b._score - a._score);

        return scored.slice(0, limit);

    } catch (e) {
        console.error("Candidate selection error:", e);
        return [];
    }
}

/**
 * 协同过滤：基于用户聚类（skinType + persona + budget）计算产品社交热度
 *
 * 查询同 skinType 用户的历史推荐产品，统计每款产品被推荐的频次。
 * 返回 Map<productId, { affinity, repurchaseRate }>，供前端展示社交标签。
 */
export async function getClusterSocialProof(
    skinType: string,
    persona?: string
): Promise<Map<string, { affinity: number; repurchaseRate: number; label: string }>> {
    const result = new Map<string, { affinity: number; repurchaseRate: number; label: string }>();
    try {
        // 1. 查同 skinType 的已完成 session（最近 90 天，最多 200 条）
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const clusterSessions = await prisma.advisorSession.findMany({
            where: {
                completedAt: { gte: ninetyDaysAgo },
            },
            orderBy: { completedAt: "desc" },
            take: 300,
            select: {
                analysisResult: true,
            },
        });

        if (clusterSessions.length === 0) return result;

        // 2. 过滤出同 skinType 的 session 并提取推荐产品
        const productCounts = new Map<string, number>();
        let matchingSessionCount = 0;

        for (const session of clusterSessions) {
            const resultData = session.analysisResult as Record<string, unknown> | null;
            const skinProfile = (resultData?.skinProfile as Record<string, unknown>) || {};
            const sessionSkinType = (skinProfile.type as string) || "";

            // 检查 skinType 匹配
            if (sessionSkinType.toLowerCase() !== skinType.toLowerCase()) continue;
            matchingSessionCount++;

            // 提取推荐产品 ID
            const products = Array.isArray(resultData?.products)
                ? (resultData!.products as Array<Record<string, unknown>>)
                : [];
            for (const p of products) {
                const pid = p.id as string;
                if (pid) {
                    productCounts.set(pid, (productCounts.get(pid) || 0) + 1);
                }
            }
        }

        if (matchingSessionCount === 0 || productCounts.size === 0) return result;

        // 3. 批量查询产品回购率（从 ProductFeedback）
        const productIds = Array.from(productCounts.keys());
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const repurchaseMap = new Map<string, number>();
        try {
            const feedbackAggs = await prisma.productFeedback.groupBy({
                by: ["productId"],
                where: {
                    productId: { in: productIds },
                    createdAt: { gte: thirtyDaysAgo },
                },
                _avg: { rating: true },
                _count: { id: true },
            });
            for (const agg of feedbackAggs) {
                const avgRating = agg._avg.rating || 0;
                repurchaseMap.set(agg.productId, Math.round(avgRating * 20)); // 1-5 → 20-100%
            }

            // 回购意愿
            const repurchaseAggs = await prisma.productFeedback.groupBy({
                by: ["productId"],
                where: {
                    productId: { in: productIds },
                    repurchase: true,
                },
                _count: { id: true },
            });

            const totalCounts = new Map<string, number>();
            for (const agg of feedbackAggs) {
                totalCounts.set(agg.productId, agg._count.id);
            }
            for (const agg of repurchaseAggs) {
                const total = totalCounts.get(agg.productId) || 1;
                repurchaseMap.set(agg.productId, Math.round((agg._count.id / total) * 100));
            }
        } catch {
            // 反馈查询失败不阻断主流程
        }

        // 4. 计算 affinity（该产品被同 skinType 用户推荐的占比）
        const personaLabel = persona ? getPersonaLabelFromKey(persona) : "用户";
        for (const [productId, count] of productCounts) {
            const affinity = Math.round((count / matchingSessionCount) * 100);
            if (affinity >= 10) {
                // 仅返回 affinity >= 10% 的产品
                result.set(productId, {
                    affinity,
                    repurchaseRate: repurchaseMap.get(productId) || 0,
                    label: `${getSkinTypeLabelShort(skinType)}${personaLabel}的选择`,
                });
            }
        }

        return result;
    } catch (e) {
        console.warn("Cluster social proof query failed (non-fatal):", e);
        return result;
    }
}

/** persona key → 中文名 */
function getPersonaLabelFromKey(persona?: string): string {
    const map: Record<string, string> = {
        sensitive: "敏敏派",
        minimalist: "极简派",
        luxury: "奢华派",
        ageless: "冻龄派",
        desert: "沙漠派",
        oily: "油条派",
        combination: "混合派",
        guardian: "守护派",
    };
    return persona ? (map[persona] || persona) : "用户";
}

/**
 * Recommend products based on user profile using Database (Enhanced)
 * Includes RecommendationRule engine for parity with getCandidateProducts()
 */
export async function recommendProducts(
    answers: QuestionnaireAnswers,
    concerns: string[],
    preloadedProducts?: (Product & { _score?: number; matchedBenefits?: string[]; _envTags?: string[]; _budgetLabel?: ProductRecommendation["budgetLabel"] })[], // Optional: reuse already-fetched products to avoid duplicate DB query
    limit: number = 3,
    persona?: string,
    envContext?: EnvContext
): Promise<ProductRecommendation[]> {
    try {
        // 1. Use preloaded products if available, otherwise fetch from DB
        const allProducts = (preloadedProducts && preloadedProducts.length > 0)
            ? preloadedProducts
            : await prisma.product.findMany({
                where: {
                    active: true
                }
            });

        if (allProducts.length === 0) {
            console.warn("No products found in DB");
            return [];
        }

        const skinType = answers.skinType || "combination";
        const isPreScored = preloadedProducts && preloadedProducts.length > 0 && preloadedProducts[0]._score !== undefined;
        const season = envContext ? getSeasonLabel(envContext.season) : undefined;

        // 2. Score each product (skip if preloaded from getCandidateProducts which already scored)
        let scored;
        if (isPreScored && preloadedProducts) {
            scored = preloadedProducts.map(p => ({
                ...p,
                rawScore: p._score!,
                matchedBenefits: p.matchedBenefits || [],
                envTags: p._envTags || [],
                budgetLabel: p._budgetLabel || "unknown",
                price: p.price
            }));
        } else {
            scored = allProducts.map(p => {
                const { score, matchedBenefits, envTags, budgetLabel } = calculateScore(p, skinType, concerns, answers, envContext);
                return {
                    ...p,
                    rawScore: score,
                    matchedBenefits,
                    envTags,
                    budgetLabel,
                    price: p.price
                };
            });
        }

        // 3. Apply RecommendationRule engine (skip if already applied by getCandidateProducts)
        if (!isPreScored) {
            try {
                const activeRules = await prisma.recommendationRule.findMany({
                    where: { active: true },
                    orderBy: { priority: 'desc' },
                    include: { products: { select: { productId: true } } }
                });

                const forcedProductIds = new Set<string>();

                for (const rule of activeRules) {
                    if (!ruleMatches(rule.conditions, skinType, concerns, persona)) continue;
                    rule.products.forEach(p => forcedProductIds.add(p.productId));
                }

                // Boost forced products
                if (forcedProductIds.size > 0) {
                    scored = scored.map(p => {
                        if (forcedProductIds.has(p.id)) {
                            return { ...p, rawScore: p.rawScore + 1000 };
                        }
                        return p;
                    });
                }
            } catch (ruleErr) {
                console.warn("RecommendationRule query failed (non-fatal):", ruleErr);
            }
        }

        // 4. Sort by score desc
        scored.sort((a, b) => b.rawScore - a.rawScore);

        // Compute persona pool for source tagging
        const personaPoolIds = new Set<string>();
        if (persona) {
            try {
                const personaRules = await prisma.recommendationRule.findMany({
                    where: { active: true },
                    include: { products: { select: { productId: true } } },
                });
                for (const rule of personaRules) {
                    if (ruleMatches(rule.conditions, skinType, concerns, persona) && ruleHasPersonaCondition(rule.conditions)) {
                        rule.products.forEach(p => personaPoolIds.add(p.productId));
                    }
                }
            } catch { /* silent */ }
        }

        // 5. Select Top N
        const top = scored.slice(0, limit);

        // 5b. 协同过滤社交证明（异步、非阻断）
        let socialProofMap = new Map<string, { affinity: number; repurchaseRate: number; label: string }>();
        try {
            socialProofMap = await getClusterSocialProof(skinType, persona);
        } catch {
            // 非阻断，降级为空
        }

        return top.map((p, index) => {
            // 推荐理由优先级：
            // 1. AI 生成（由 analyze/route.ts 在 resultJson.products[].reason 中覆盖）
            // 2. 产品级运营配置 recommendReasons[skinType][season]（季节精确匹配）
            // 3. 产品级运营配置 recommendReasons[skinType].default（季节回退）
            // 4. 产品级运营配置 recommendReasons[skinType]（旧格式兼容：字符串直接使用）
            // 5. 算法模板 generateSmartReason（兜底）
            let reason: string;
            const rawRecommendReasons = p.recommendReasons as Record<string, string | Record<string, string>> | undefined;
            if (rawRecommendReasons && typeof rawRecommendReasons === "object" && skinType) {
                const skinTypeEntry = rawRecommendReasons[skinType];
                if (typeof skinTypeEntry === "string" && skinTypeEntry.trim()) {
                    // 旧格式：{ "oily": "文案" } → 直接使用
                    reason = skinTypeEntry;
                } else if (typeof skinTypeEntry === "object" && skinTypeEntry !== null) {
                    // 新格式：{ "oily": { "default": "...", "summer": "..." } }
                    const seasonKey = envContext?.season;
                    if (seasonKey && typeof skinTypeEntry[seasonKey] === "string" && skinTypeEntry[seasonKey].trim()) {
                        reason = skinTypeEntry[seasonKey];
                    } else if (typeof skinTypeEntry["default"] === "string" && skinTypeEntry["default"].trim()) {
                        reason = skinTypeEntry["default"];
                    } else {
                        reason = "";
                    }
                } else {
                    reason = "";
                }
            } else {
                reason = "";
            }

            // 如果运营配置未命中，使用算法模板兜底
            if (!reason) {
                reason = generateSmartReason(
                    p.matchedBenefits || [],
                    concerns,
                    skinType,
                    index,
                    p.name,
                    p.category,
                    persona,
                    season,
                    envContext
                );
            }

            // 协同过滤社交证明
            const clusterProof = socialProofMap.get(p.id);
            const socialProof = clusterProof ? {
                label: clusterProof.label,
                affinity: clusterProof.affinity,
                detail: clusterProof.repurchaseRate > 0
                    ? `${clusterProof.affinity}% 的同肤质用户选择了这款产品，${clusterProof.repurchaseRate}% 愿意回购`
                    : `${clusterProof.affinity}% 的同肤质用户选择了这款产品`,
            } : undefined;

            return {
            id: p.id,
            name: p.name,
            category: p.category,
            image: p.image,
            images: (p.images as string[] | null) || null,
            price: p.price,
            reason,
            description: p.description || null,
            score: p.rawScore,
            matchedBenefits: p.matchedBenefits,
            affiliateLinks: (p.affiliateLinks as Record<string, string> | null) || null,
            howToUse: p.howToUse || null,
            benefits: Array.isArray(p.benefits) ? p.benefits : [],
            keyIngredients: Array.isArray(p.keyIngredients) ? p.keyIngredients : [],
            source: personaPoolIds.has(p.id) ? "persona" as const : "algorithm" as const,
            budgetLabel: p.budgetLabel || "unknown",
            envTags: p.envTags || [],
            socialProof,
            };
        });

    } catch (e) {
        console.error("Product recommendation error:", e);
        return [];
    }
}
