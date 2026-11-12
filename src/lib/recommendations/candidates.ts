/**
 * 候选产品筛选（RAG Lite）：评分 + 反馈加权 + 规则硬命中 + 派系池限制。
 */

import prisma from "@/lib/prisma";
import type { QuestionnaireAnswers } from "@/lib/advisor-utils";
import type { EnvContext } from "@/lib/weather-context";
import { getActiveProductsCached } from "@/lib/product-cache";
import { calculateScore, isSerumCategory, SERUM_ALLOWED_PERSONAS } from "./scoring";
import { ruleMatches, ruleHasPersonaCondition } from "./rules";
import type { ScoredProduct } from "./types";

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
        const allProducts = await getActiveProductsCached();

        if (allProducts.length === 0) return [];

        const skinType = answers.skinType || "combination";

        // 负面产品（不适合肤质/孕妇等）硬过滤剔除，不参与后续排序/补位
        let scored = allProducts
            .map(p => {
                const { score, matchedBenefits, envTags, budgetLabel, excluded } = calculateScore(p, skinType, concerns, answers, envContext);
                return { ...p, _score: score, matchedBenefits, _envTags: envTags, _budgetLabel: budgetLabel, _excluded: excluded };
            })
            .filter(p => !p._excluded);

        // 精华品类限制：仅奢华派/冻龄派可推荐精华
        if (!persona || !SERUM_ALLOWED_PERSONAS.has(persona)) {
            scored = scored.filter(p => !isSerumCategory(p.category));
        }

        // 用户反馈加权：近 30 天平均评分 ≥4 且样本 ≥3，+15 分
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

        // 规则硬命中：按最高优先级裁决；同优先级规则合并
        const activeRules = await prisma.recommendationRule.findMany({
            where: { active: true },
            orderBy: { priority: 'desc' },
            include: { products: { select: { productId: true } } }
        });

        const forcedProductIds = new Set<string>();
        const personaProductIds = new Set<string>();
        let winningPriority = Number.NEGATIVE_INFINITY;

        for (const rule of activeRules) {
            if (!ruleMatches(rule.conditions, skinType, concerns, persona)) continue;
            if (rule.priority < winningPriority) continue;
            if (rule.priority > winningPriority) {
                winningPriority = rule.priority;
                forcedProductIds.clear();
                personaProductIds.clear();
            }
            rule.products.forEach(p => {
                forcedProductIds.add(p.productId);
                if (ruleHasPersonaCondition(rule.conditions)) {
                    personaProductIds.add(p.productId);
                }
            });
        }

        scored = scored.map(p => {
            if (forcedProductIds.has(p.id)) {
                return { ...p, _score: p._score + 1000 };
            }
            return p;
        });

        // 派系池限制：命中 persona 规则时优先池内产品，不足再池外补位
        if (persona && personaProductIds.size > 0) {
            const pool = scored
                .filter(p => personaProductIds.has(p.id))
                .sort((a, b) => b._score - a._score);

            if (pool.length >= limit) {
                return pool.slice(0, limit);
            }

            const rest = scored
                .filter(p => !personaProductIds.has(p.id))
                .sort((a, b) => b._score - a._score);

            return [...pool, ...rest].slice(0, limit);
        }

        scored.sort((a, b) => b._score - a._score);

        return scored.slice(0, limit);

    } catch (e) {
        console.error("Candidate selection error:", e);
        return [];
    }
}
