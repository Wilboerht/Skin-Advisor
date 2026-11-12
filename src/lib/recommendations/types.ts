import type { Product } from "@prisma/client";
import type { ProductPurchaseLink } from "@/lib/product-links";

/** 带算法评分的商品（由 getCandidateProducts 生成） */
export type ScoredProduct = Product & {
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
    purchaseLinks?: ProductPurchaseLink[];
    origin?: string | null;
    capacity?: string | null;
    howToUse?: string | null;
    /** 推荐来源：persona（IP 池内）| algorithm（池外补充） */
    source?: "persona" | "algorithm";
    /** 预算匹配标签：within_budget | near_budget | over_budget | unknown */
    budgetLabel?: "within_budget" | "near_budget" | "over_budget" | "unknown";
    /** 环境相关匹配标签 */
    envTags?: string[];
    /** 社交证明：同肤质报告推荐占比 + 真实反馈回购意愿 */
    socialProof?: {
        /** 如 "混干肌用户的选择" */
        label: string;
        /** 同肤质用户的测肤报告中该产品被推荐的占比（0-100） */
        affinity: number;
        /** 如 "同肤质用户的测肤报告中 87% 被推荐" */
        detail: string;
    };
}
