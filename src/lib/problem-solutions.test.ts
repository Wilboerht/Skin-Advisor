import { describe, it, expect } from "vitest";
import { buildProblemCards, PROBLEM_ENTRIES, type LifestyleAnswers } from "./problem-solutions";

function makeDimensions() {
    return {
        radiance: { score: 70, grade: "good", details: "光泽度中等" },
        acne: { score: 55, grade: "fair", details: "下巴有闭口" },
        firmness: { score: 80, grade: "good", details: "弹性良好" },
        darkCircles: { score: 38, grade: "poor", details: "青黑色黑眼圈明显" },
        sensitivity: { score: 85, grade: "excellent", details: "耐受良好" },
        uvDamage: { score: 60, grade: "average", details: "" },
        wrinkles: { score: 92, grade: "excellent", details: "" },
        spots: { score: 75, grade: "good", details: "" },
        skinTone: { score: 50, grade: "fair", details: "" },
        waterOil: { score: 68, grade: "average", details: "" },
    };
}

describe("buildProblemCards", () => {
    it("仅筛选 poor / fair 维度，忽略 good / average / excellent", () => {
        const cards = buildProblemCards(makeDimensions());
        expect(cards.map((c) => c.key)).toEqual(["darkCircles", "skinTone", "acne"]);
    });

    it("按严重程度排序：poor 在前，同级按分数升序", () => {
        const dims = makeDimensions();
        dims.acne = { score: 55, grade: "poor", details: "" };
        dims.skinTone = { score: 42, grade: "poor", details: "" };
        const cards = buildProblemCards(dims);
        expect(cards.map((c) => `${c.key}:${c.grade}`)).toEqual([
            "darkCircles:poor",
            "skinTone:poor",
            "acne:poor",
        ]);
    });

    it("无数据时返回空数组", () => {
        expect(buildProblemCards(undefined)).toEqual([]);
    });

    it("优先使用 AI details 作为问题描述", () => {
        const dims = makeDimensions();
        const cards = buildProblemCards(dims);
        const acne = cards.find((c) => c.key === "acne");
        expect(acne?.description).toBe("下巴有闭口");
        const skinTone = cards.find((c) => c.key === "skinTone");
        expect(skinTone?.description).toBe(PROBLEM_ENTRIES.skinTone.description);
    });

    it("睡眠差时才展示睡眠加重因素与睡眠建议", () => {
        const dims = makeDimensions();
        const noSleepIssue: LifestyleAnswers = { sleepQuality: "good" };
        const withSleepIssue: LifestyleAnswers = { sleepQuality: "poor" };

        const cardsWithout = buildProblemCards(dims, noSleepIssue);
        const darkCirclesWithout = cardsWithout.find((c) => c.key === "darkCircles");
        expect(
            darkCirclesWithout?.aggravatorGroups.some((g) => g.category === "sleep")
        ).toBe(false);

        const cardsWith = buildProblemCards(dims, withSleepIssue);
        const darkCirclesWith = cardsWith.find((c) => c.key === "darkCircles");
        expect(
            darkCirclesWith?.aggravatorGroups.some((g) => g.category === "sleep")
        ).toBe(true);
        expect(
            darkCirclesWith?.lifestyleTipGroups.some((g) => g.category === "sleep")
        ).toBe(true);
    });

    it("无问卷数据时不凭空展示睡眠/压力/护肤习惯加重因素", () => {
        const cards = buildProblemCards(makeDimensions(), {});
        const darkCircles = cards.find((c) => c.key === "darkCircles");
        const categories = darkCircles?.aggravatorGroups.map((g) => g.category) ?? [];
        expect(categories).not.toContain("sleep");
        expect(categories).not.toContain("stress");
        expect(categories).not.toContain("care");
    });

    it("日晒加重因素恒展示（环境因素）", () => {
        const dims = makeDimensions();
        dims.wrinkles = { score: 45, grade: "poor", details: "" };
        const cards = buildProblemCards(dims, {});
        const wrinkles = cards.find((c) => c.key === "wrinkles");
        expect(wrinkles?.aggravatorGroups.some((g) => g.category === "sun")).toBe(true);
    });
});
