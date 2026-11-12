/**
 * 产品推荐入口（orchestrator）。
 *
 * 具体职责已拆分到 src/lib/recommendations/：
 * - scoring.ts：评分与孕期/过敏硬排除
 * - reasons.ts：推荐理由模板
 * - rules.ts：RecommendationRule 条件匹配
 * - candidates.ts：RAG Lite 候选池
 * - social.ts：同肤质社交证明
 *
 * 此文件保留 recommendProducts 主流程，并 re-export 原有公共 API，调用方无需改动。
 */

import prisma from "@/lib/prisma";
import type { Product } from "@prisma/client";
import type { QuestionnaireAnswers } from "@/lib/advisor-utils";
import type { EnvContext } from "@/lib/weather-context";
import { getSeasonLabel } from "@/lib/weather-context";
import { getActiveProductsCached } from "@/lib/product-cache";
import { normalizeProductPurchaseLinks } from "@/lib/product-links";
import type { ProductRecommendation } from "./recommendations/types";
import { calculateScore, isSerumCategory, SERUM_ALLOWED_PERSONAS } from "./recommendations/scoring";
import { generateSmartReason } from "./recommendations/reasons";
import { ruleMatches, ruleHasPersonaCondition } from "./recommendations/rules";
import { getClusterSocialProof } from "./recommendations/social";

export type { ProductRecommendation } from "./recommendations/types";
export { isProductExcludedForPregnancy, isProductExcludedForAllergies } from "./recommendations/scoring";
export { getCandidateProducts } from "./recommendations/candidates";
export { getClusterSocialProof } from "./recommendations/social";

/**
 * Recommend products based on user profile using Database (Enhanced)
 * Includes RecommendationRule engine for parity with getCandidateProducts()
 */
export async function recommendProducts(
    answers: QuestionnaireAnswers,
    concerns: string[],
    preloadedProducts?: (Product & { _score?: number; matchedBenefits?: string[]; _envTags?: string[]; _budgetLabel?: ProductRecommendation["budgetLabel"] })[],
    limit: number = 3,
    persona?: string,
    envContext?: EnvContext
): Promise<ProductRecommendation[]> {
    try {
        const allProducts = (preloadedProducts && preloadedProducts.length > 0)
            ? preloadedProducts
            : await getActiveProductsCached();

        if (allProducts.length === 0) {
            console.warn("No products found in DB");
            return [];
        }

        const skinType = answers.skinType || "combination";
        const isPreScored = preloadedProducts && preloadedProducts.length > 0 && preloadedProducts[0]._score !== undefined;
        const season = envContext ? getSeasonLabel(envContext.season) : undefined;

        // 评分：pre-scored 路径直接复用 getCandidateProducts 的结果
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
            scored = allProducts
                .map(p => {
                    const { score, matchedBenefits, envTags, budgetLabel, excluded } = calculateScore(p, skinType, concerns, answers, envContext);
                    return {
                        ...p,
                        rawScore: score,
                        matchedBenefits,
                        envTags,
                        budgetLabel,
                        price: p.price,
                        _excluded: excluded
                    };
                })
                .filter(p => !p._excluded);
        }

        // 精华品类限制：仅奢华派/冻龄派
        if (!persona || !SERUM_ALLOWED_PERSONAS.has(persona)) {
            scored = scored.filter(p => !isSerumCategory(p.category));
        }

        // 规则硬命中（pre-scored 路径已由 getCandidateProducts 应用）
        if (!isPreScored) {
            try {
                const activeRules = await prisma.recommendationRule.findMany({
                    where: { active: true },
                    orderBy: { priority: 'desc' },
                    include: { products: { select: { productId: true } } }
                });

                const forcedProductIds = new Set<string>();
                let winningPriority = Number.NEGATIVE_INFINITY;

                for (const rule of activeRules) {
                    if (!ruleMatches(rule.conditions, skinType, concerns, persona)) continue;
                    if (rule.priority < winningPriority) continue;
                    if (rule.priority > winningPriority) {
                        winningPriority = rule.priority;
                        forcedProductIds.clear();
                    }
                    rule.products.forEach(p => forcedProductIds.add(p.productId));
                }

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

        scored.sort((a, b) => b.rawScore - a.rawScore);

        // 派系池标记
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

        const top = scored.slice(0, limit);

        // 协同过滤社交证明（非阻断）
        let socialProofMap = new Map<string, { affinity: number; repurchaseRate: number; label: string }>();
        try {
            socialProofMap = await getClusterSocialProof(skinType, persona);
        } catch {
            // 降级为空
        }

        return top.map((p, index) => {
            // 推荐理由优先级：运营 recommendReasons（季节/默认/旧格式）→ 算法模板
            let reason: string;
            const rawRecommendReasons = p.recommendReasons as Record<string, string | Record<string, string>> | undefined;
            if (rawRecommendReasons && typeof rawRecommendReasons === "object" && skinType) {
                const skinTypeEntry = rawRecommendReasons[skinType];
                if (typeof skinTypeEntry === "string" && skinTypeEntry.trim()) {
                    reason = skinTypeEntry;
                } else if (typeof skinTypeEntry === "object" && skinTypeEntry !== null) {
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

            const clusterProof = socialProofMap.get(p.id);
            const socialProof = clusterProof ? {
                label: clusterProof.label,
                affinity: clusterProof.affinity,
                detail: clusterProof.repurchaseRate > 0
                    ? `同肤质用户的测肤报告中 ${clusterProof.affinity}% 被推荐；反馈用户中 ${clusterProof.repurchaseRate}% 表示愿意回购`
                    : `同肤质用户的测肤报告中 ${clusterProof.affinity}% 被推荐`,
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
                purchaseLinks: normalizeProductPurchaseLinks(p.purchaseLinks, p.affiliateLinks),
                origin: p.origin || null,
                capacity: p.capacity || null,
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
