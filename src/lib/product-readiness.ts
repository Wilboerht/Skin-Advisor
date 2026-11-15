/**
 * 子站推荐属性完整度判断（与产品编辑页「待配置」口径一致）。
 * 主站同步只负责基础信息；以下字段由子站运营补齐后推荐才会完整。
 */
export interface ProductReadinessInput {
    keyIngredients?: unknown;
    benefits?: unknown;
    suitableSkinTypes?: unknown;
    recommendReasons?: unknown;
}

function hasNonEmptyArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
}

function hasReasonEntries(value: unknown): boolean {
    return Boolean(value) && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0;
}

export function needsRecommendationConfig(product: ProductReadinessInput): boolean {
    return (
        !hasNonEmptyArray(product.keyIngredients) ||
        !hasNonEmptyArray(product.benefits) ||
        !hasNonEmptyArray(product.suitableSkinTypes) ||
        !hasReasonEntries(product.recommendReasons)
    );
}
