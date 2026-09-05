import { describe, it, expect } from "vitest";
import { buildProblemCards, PROBLEM_ENTRIES, type LifestyleAnswers } from "./problem-solutions";
import type { SkinCondition } from "./advisor-utils";

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

describe("buildProblemCards - 维度筛选与分级", () => {
    it("筛选 poor / fair / average 维度，忽略 good / excellent", () => {
        const cards = buildProblemCards(makeDimensions());
        expect(cards.map((c) => c.key)).toEqual([
            "darkCircles",
            "skinTone",
            "acne",
            "uvDamage",
            "waterOil",
        ]);
    });

    it("poor / fair 为 full 卡，average 为 compact 卡", () => {
        const cards = buildProblemCards(makeDimensions());
        expect(cards.find((c) => c.key === "darkCircles")?.tier).toBe("full");
        expect(cards.find((c) => c.key === "acne")?.tier).toBe("full");
        expect(cards.find((c) => c.key === "uvDamage")?.tier).toBe("compact");
        expect(cards.find((c) => c.key === "waterOil")?.tier).toBe("compact");
    });

    it("full 卡在前，compact 卡在后；同级按分数升序", () => {
        const dims = makeDimensions();
        dims.acne = { score: 55, grade: "poor", details: "" };
        dims.skinTone = { score: 42, grade: "poor", details: "" };
        const cards = buildProblemCards(dims);
        const full = cards.filter((c) => c.tier === "full");
        expect(full.map((c) => `${c.key}:${c.grade}`)).toEqual([
            "darkCircles:poor",
            "skinTone:poor",
            "acne:poor",
        ]);
        const compact = cards.filter((c) => c.tier === "compact");
        expect(compact.map((c) => c.key)).toEqual(["uvDamage", "waterOil"]);
    });

    it("无数据时返回空数组", () => {
        expect(buildProblemCards(undefined)).toEqual([]);
    });

    it("优先使用 AI details 作为问题描述", () => {
        const cards = buildProblemCards(makeDimensions());
        const acne = cards.find((c) => c.key === "acne");
        expect(acne?.description).toBe("下巴有闭口");
        const skinTone = cards.find((c) => c.key === "skinTone");
        expect(skinTone?.description).toBe(PROBLEM_ENTRIES.skinTone.description);
    });
});

describe("buildProblemCards - 问卷生活方式门控", () => {
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

describe("buildProblemCards - skinConditions 症状合并", () => {
    const blackheads: SkinCondition = {
        condition: "黑头",
        severity: "moderate",
        area: "鼻翼",
        description: "鼻翼两侧可见明显黑头",
    };

    it("moderate 症状并入为 full 卡，使用 AI 描述与部位", () => {
        const dims = makeDimensions();
        dims.acne = { score: 90, grade: "excellent", details: "" };
        const cards = buildProblemCards(dims, {}, [blackheads]);
        const card = cards.find((c) => c.source === "condition" && c.label === "黑头");
        expect(card).toBeDefined();
        expect(card?.tier).toBe("full");
        expect(card?.severity).toBe("moderate");
        expect(card?.area).toBe("鼻翼");
        expect(card?.description).toBe("鼻翼两侧可见明显黑头");
        expect(card?.skincareActions).toEqual(PROBLEM_ENTRIES.acne.skincareActions);
    });

    it("mild 症状并入为 compact 卡", () => {
        const dims = makeDimensions();
        dims.acne = { score: 90, grade: "excellent", details: "" };
        const mild: SkinCondition = { ...blackheads, severity: "mild" };
        const cards = buildProblemCards(dims, {}, [mild]);
        const card = cards.find((c) => c.source === "condition");
        expect(card?.tier).toBe("compact");
    });

    it("映射维度已有卡时跳过症状，避免重复", () => {
        const cards = buildProblemCards(makeDimensions(), {}, [blackheads]);
        expect(cards.some((c) => c.source === "condition")).toBe(false);
    });

    it("同一映射维度的多个症状只保留第一个", () => {
        const dims = makeDimensions();
        dims.acne = { score: 90, grade: "excellent", details: "" };
        const conditions: SkinCondition[] = [
            blackheads,
            { condition: "毛孔粗大", severity: "mild", area: "T区", description: "毛孔扩张" },
        ];
        const cards = buildProblemCards(dims, {}, conditions);
        const conditionCards = cards.filter((c) => c.source === "condition");
        expect(conditionCards).toHaveLength(1);
        expect(conditionCards[0].label).toBe("黑头");
    });

    it("无法映射的症状被忽略", () => {
        const unknown: SkinCondition = {
            condition: "不明症状",
            severity: "severe",
            area: "全脸",
            description: "未知",
        };
        const cards = buildProblemCards(makeDimensions(), {}, [unknown]);
        expect(cards.some((c) => c.source === "condition")).toBe(false);
    });
});
