import { describe, expect, it } from "vitest";
import { needsRecommendationConfig } from "./product-readiness";

describe("needsRecommendationConfig", () => {
    const ready = {
        keyIngredients: ["烟酰胺"],
        benefits: ["提亮"],
        suitableSkinTypes: ["oily"],
        recommendReasons: { oily: "控油提亮" },
    };

    it("推荐属性完整时返回 false", () => {
        expect(needsRecommendationConfig(ready)).toBe(false);
    });

    it("任一推荐属性缺失时返回 true", () => {
        expect(needsRecommendationConfig({ ...ready, keyIngredients: [] })).toBe(true);
        expect(needsRecommendationConfig({ ...ready, benefits: [] })).toBe(true);
        expect(needsRecommendationConfig({ ...ready, suitableSkinTypes: [] })).toBe(true);
        expect(needsRecommendationConfig({ ...ready, recommendReasons: null })).toBe(true);
        expect(needsRecommendationConfig({ ...ready, recommendReasons: {} })).toBe(true);
    });
});
