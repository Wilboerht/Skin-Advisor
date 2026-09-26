import { describe, it, expect, vi } from "vitest";

// recommendations.ts 顶层导入 @/lib/prisma（模块加载即建连），单测只测纯函数，这里 mock 掉
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { isProductExcludedForPregnancy } from "./recommendations";

describe("isProductExcludedForPregnancy - 孕期产品硬排除", () => {
    it("negativeFor 含孕妇/哺乳期标签时排除", () => {
        expect(isProductExcludedForPregnancy({ negativeFor: ["孕妇"], keyIngredients: [] }, true).excluded).toBe(true);
        expect(isProductExcludedForPregnancy({ negativeFor: ["哺乳期"], keyIngredients: [] }, true).excluded).toBe(true);
    });

    it("成分表命中孕期禁忌（精油类/香精）时排除", () => {
        const result = isProductExcludedForPregnancy(
            { negativeFor: [], keyIngredients: ["迷迭香叶油", "角鲨烷"] },
            true
        );
        expect(result.excluded).toBe(true);
        expect(result.reason).toContain("迷迭香叶油");

        expect(
            isProductExcludedForPregnancy({ negativeFor: [], keyIngredients: ["Fragrance"] }, true).excluded
        ).toBe(true);
    });

    it("非孕期不排除任何产品", () => {
        expect(isProductExcludedForPregnancy({ negativeFor: ["孕妇"], keyIngredients: ["香精"] }, false).excluded).toBe(false);
    });

    it("干净产品不排除", () => {
        expect(
            isProductExcludedForPregnancy(
                { negativeFor: [], keyIngredients: ["烟酰胺", "透明质酸钠", "神经酰胺NP"] },
                true
            ).excluded
        ).toBe(false);
    });

    it("negativeFor 变体标签（孕期慎用/英文标签）与字符串形态也能命中", () => {
        expect(isProductExcludedForPregnancy({ negativeFor: ["孕期慎用"], keyIngredients: [] }, true).excluded).toBe(true);
        expect(isProductExcludedForPregnancy({ negativeFor: ["Pregnancy"], keyIngredients: [] }, true).excluded).toBe(true);
        expect(isProductExcludedForPregnancy({ negativeFor: "哺乳期慎用", keyIngredients: [] }, true).excluded).toBe(true);
    });

    it("字段缺失安全返回不排除", () => {
        expect(isProductExcludedForPregnancy({}, true).excluded).toBe(false);
        expect(isProductExcludedForPregnancy({ negativeFor: [], keyIngredients: null }, true).excluded).toBe(false);
    });
});
