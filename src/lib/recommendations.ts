
import prisma from "@/lib/prisma";
import { QuestionnaireAnswers, getSkinTypeLabel, getConcernLabel } from "@/lib/advisor-utils";

export interface ProductRecommendation {
    id: string;
    name: string;
    nameEn: string | null;
    category: string;
    image: string;
    price: string;
    reason: string;
    score?: number;
    matchedBenefits?: string[];
    affiliateLinks?: Record<string, string> | null;
    howToUse?: string | null;
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

/** 预算到价格范围的映射 */
const BUDGET_TO_PRICE: Record<string, { min: number; max: number }> = {
    budget: { min: 0, max: 500 },
    mid: { min: 300, max: 1000 },
    premium: { min: 800, max: 2000 },
    luxury: { min: 1500, max: Infinity },
};

/** 年龄段到推荐功效的映射 */
const AGE_TO_BENEFITS: Record<string, string[]> = {
    "under_23": ["控油", "清爽", "补水", "净化", "祛痘"],
    "23-30": ["补水", "保湿", "提亮", "抗氧化", "防护"],
    "31-40": ["抗老", "紧致", "淡纹", "修护", "保湿"],
    "41-50": ["抗皱", "紧致", "淡斑", "滋养", "胶原"],
    "above_50": ["紧致", "滋养", "修护", "抗皱", "弹力"],
};



/**
 * Calculate match score for a product (Enhanced)
 */
function calculateScore(
    product: any,
    skinType: string,
    concerns: string[],
    answers: QuestionnaireAnswers
): { score: number; reasons: string[]; matchedBenefits: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const matchedBenefits: string[] = [];

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
            if (productBenefits.some((b) => b.includes(benefit))) {
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
            if (productBenefits.some((b) => b.includes(benefit))) {
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
            if (productBenefits.some((b) => b.includes(benefit))) {
                score += 20;
                if (!matchedBenefits.includes(benefit)) {
                    matchedBenefits.push(benefit);
                }
            }
        });
    }

    // 4. 预算匹配（权重中等：匹配 +15 分）
    if (answers.budget) {
        const priceRange = BUDGET_TO_PRICE[answers.budget];
        // Extract first price number (handles ranges like "¥1000-2000" by taking the minimum)
        const priceMatch = String(product.price).match(/[0-9]+(?:\.[0-9]+)?/);
        const productPrice = priceMatch ? Number(priceMatch[0]) : 0;
        if (priceRange && !isNaN(productPrice) && productPrice > 0 && productPrice >= priceRange.min && productPrice <= priceRange.max) {
            score += 15;
            reasons.push("符合预算范围");
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
            score -= 300;
        }
        if (concerns.includes("sensitivity") && negativeTags.some(t => ["刺激", "敏感肌", "酒精", "香精"].includes(t))) {
            score -= 300;
        }
        if (concerns.includes("anti_aging") && negativeTags.some(t => ["孕妇", "哺乳期"].includes(t))) {
            score -= 200;
        }
    }

    // Base Score fallback
    const hasNegativeReason = reasons.some(r => r.includes("不适合"));
    if (score < 0) score = 0;
    if (score === 0 && !hasNegativeReason) score = 10;

    return { score, reasons, matchedBenefits };
}

/**
 * Generate intelligent recommendation reason
 */
function generateSmartReason(
    matchedBenefits: string[],
    concerns: string[],
    skinType: string,
    index: number = 0
): string {
    // 1. 如果有匹配的功效
    if (matchedBenefits.length > 0) {
        const benefitText = matchedBenefits.slice(0, 2).join("、");
        const templates = [
            `针对您的需求，含${benefitText}功效`,
            `主打${benefitText}，适合您的肤质`,
            `富含${benefitText}成分，改善肌肤状态`,
            `为您精选：具备${benefitText}效果`,
        ];
        return templates[index % templates.length];
    }

    // 2. 降级到基于关注点的理由
    const concernReasons: Record<string, string[]> = {
        anti_aging: ["淡化细纹，紧致肌肤", "抗氧化修护"],
        aging: ["延衰抗老，紧致肌肤", "抗氧化修护"],
        fine_lines: ["淡化细纹", "平滑肌肤"],
        wrinkles: ["淡化细纹，平滑肌肤", "抗皱紧致"],
        dullness: ["提亮肤色，焕发光彩", "改善暗沉"],
        dull: ["提亮肤色，焕发光彩", "改善暗沉"],
        pigmentation: ["淡化色斑", "均匀肤色"],
        spots: ["淡化色斑，均匀肤色", "改善色素沉着"],
        hydration: ["深层补水，持久保湿", "修护肌肤屏障"],
        dryness: ["深层补水，滋润肌肤", "改善干燥缺水"],
        sensitivity: ["舒缓镇静，温和修护", "增强肌肤屏障"],
        acne: ["控油平衡，预防痘痘", "消炎调理"],
        oil_control: ["清爽控油，平衡水油", "调节油脂分泌"],
        dark_circles: ["修护眼周，淡化黑眼圈", "改善眼部循环"],
        roughness: ["改善粗糙，细致毛孔", "平滑肌肤纹理"],
        waterOil: ["平衡水油，调理肌肤", "改善T区出油U区干燥"],
    };

    // 优先使用关注点相关理由
    if (concerns.length > 0) {
        const concern = concerns[index % concerns.length];
        const reasons = concernReasons[concern];
        if (reasons) {
            return reasons[index % reasons.length];
        }
    }

    // 3. 再次降级到肤质理由
    const skinReasons: Record<string, string> = {
        dry: "滋润保湿，改善干燥",
        oily: "清爽控油，平衡水油",
        combination: "分区护理，平衡肤质",
        combination_dry: "针对混干肤质，分区滋润",
        combination_oily: "针对混油肤质，平衡水油",
        sensitive: "温和配方，适合敏感肌",
        normal: "日常保养，维持状态",
    };

    if (skinType && skinReasons[skinType]) {
        return skinReasons[skinType];
    }

    return "适合日常护肤使用，维持肌肤健康";
}

/**
 * Pre-filter products for AI context (RAG Lite)
 * Returns top N products based on heuristic scoring to save tokens
 */
export async function getCandidateProducts(
    answers: QuestionnaireAnswers,
    concerns: string[],
    limit: number = 10
): Promise<any[]> {
    try {
        // 1. Fetch Active & In-Stock Products
        const allProducts = await prisma.product.findMany({
            where: {
                active: true
            }
        });

        if (allProducts.length === 0) return [];

        const skinType = answers.skinType || "combination";

        // 2. Score using our heuristic engine
        let scored = allProducts.map(p => {
            const { score, matchedBenefits } = calculateScore(p, skinType, concerns, answers);
            return { ...p, _score: score, matchedBenefits };
        });

        // 3. Inject Forced Rules (Hard Rules)
        const activeRules = await prisma.recommendationRule.findMany({
            where: { active: true },
            orderBy: { priority: 'desc' }
        });

        // Simple Rule Engine
        const forcedProductIds = new Set<string>();

        for (const rule of activeRules) {
            const conditions = rule.conditions as any; // { skinType: ['oily'] }
            let match = true;

            // Check Skin Type Condition
            if (conditions?.skinType && Array.isArray(conditions.skinType)) {
                if (!conditions.skinType.includes(skinType)) match = false;
            }

            // Check Concern Condition
            if (match && conditions?.concern && Array.isArray(conditions.concern)) {
                // If user has ANY of the rule's target concerns
                const hasConcern = concerns.some(c => conditions.concern.includes(c));
                if (!hasConcern) match = false;
            }

            if (match) {
                // Rule Matched! Add products to forced list
                if (Array.isArray(rule.productIds)) {
                    rule.productIds.forEach((id: any) => forcedProductIds.add(String(id)));
                }
            }
        }

        // Boost forced products score to ensure they are in top list
        scored = scored.map(p => {
            if (forcedProductIds.has(p.id)) {
                return { ...p, _score: p._score + 1000 }; // Massive boost
            }
            return p;
        });

        // 4. Sort & Slice
        scored.sort((a, b) => b._score - a._score);

        return scored.slice(0, limit);

    } catch (e) {
        console.error("Candidate selection error:", e);
        return [];
    }
}

/**
 * Recommend products based on user profile using Database (Enhanced)
 * Includes RecommendationRule engine for parity with getCandidateProducts()
 */
export async function recommendProducts(
    answers: QuestionnaireAnswers,
    concerns: string[],
    preloadedProducts?: any[], // Optional: reuse already-fetched products to avoid duplicate DB query
    limit: number = 3
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

        // 2. Score each product (skip if preloaded from getCandidateProducts which already scored)
        let scored = allProducts.map(p => {
            if (isPreScored) {
                // Reuse pre-computed score from getCandidateProducts
                return {
                    ...p,
                    rawScore: p._score,
                    matchedBenefits: p.matchedBenefits || [],
                    price: p.price
                };
            }
            const { score, matchedBenefits } = calculateScore(p, skinType, concerns, answers);
            return {
                ...p,
                rawScore: score,
                matchedBenefits,
                price: p.price
            };
        });

        // 3. Apply RecommendationRule engine (skip if already applied by getCandidateProducts)
        if (!isPreScored) {
            try {
                const activeRules = await prisma.recommendationRule.findMany({
                    where: { active: true },
                    orderBy: { priority: 'desc' }
                });

                const forcedProductIds = new Set<string>();

                for (const rule of activeRules) {
                    const conditions = rule.conditions as any;
                    let match = true;

                    if (conditions?.skinType && Array.isArray(conditions.skinType)) {
                        if (!conditions.skinType.includes(skinType)) match = false;
                    }

                    if (match && conditions?.concern && Array.isArray(conditions.concern)) {
                        const hasConcern = concerns.some(c => conditions.concern.includes(c));
                        if (!hasConcern) match = false;
                    }

                    if (match && Array.isArray(rule.productIds)) {
                        rule.productIds.forEach((id: any) => forcedProductIds.add(String(id)));
                    }
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

        // 5. Select Top N
        const top = scored.slice(0, limit);

        return top.map((p, index) => ({
            id: p.id,
            name: p.name,
            nameEn: p.nameEn,
            category: p.category,
            image: p.image,
            price: p.price,
            reason: generateSmartReason(p.matchedBenefits, concerns, skinType, index),
            score: p.rawScore,
            affiliateLinks: p.affiliateLinks,
            howToUse: p.howToUse || null
        }));

    } catch (e) {
        console.error("Product recommendation error:", e);
        return [];
    }
}
