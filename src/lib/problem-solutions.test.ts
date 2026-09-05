import { describe, it, expect } from "vitest";
import { buildFocusProblems, type LifestyleAnswers } from "./problem-solutions";
import type { SkinCondition } from "./advisor-utils";

function makeDimensions(): Record<string, { score?: number; grade?: string; details?: string; blackheads?: number; pimples?: number }> {
    return {
        radiance: { score: 58, grade: "average", details: "光泽度不足" },
        acne: { score: 62, grade: "average", details: "下巴有闭口" },
        firmness: { score: 84, grade: "good", details: "弹性良好" },
        darkCircles: { score: 38, grade: "poor", details: "青黑色黑眼圈明显" },
        sensitivity: { score: 85, grade: "excellent", details: "耐受良好" },
        uvDamage: { score: 60, grade: "average", details: "" },
        wrinkles: { score: 92, grade: "excellent", details: "" },
        spots: { score: 75, grade: "good", details: "" },
        skinTone: { score: 50, grade: "fair", details: "" },
        waterOil: { score: 45, grade: "fair", details: "" },
    };
}

describe("buildFocusProblems - 问题存在性与程度量化", () => {
    it("分数 <70 的问题出卡（以用户视角问题名为单位）", () => {
        const problems = buildFocusProblems(makeDimensions());
        const names = problems.map((p) => p.name);
        expect(names).toContain("暗沉");
        expect(names).toContain("黑头");
        expect(names).toContain("痘痘");
        expect(names).toContain("黑眼圈");
        expect(names).toContain("水油失衡");
        expect(names).not.toContain("松弛");
        expect(names).not.toContain("细纹");
    });

    it("程度按分数档位量化：<40 重度 / 40-54 中度 / 55-69 轻度", () => {
        const problems = buildFocusProblems(makeDimensions());
        expect(problems.find((p) => p.name === "黑眼圈")?.level).toBe("severe");
        expect(problems.find((p) => p.name === "水油失衡")?.level).toBe("moderate");
        expect(problems.find((p) => p.name === "暗沉")?.level).toBe("mild");
    });

    it("分数 ≥70 但 AI 检测到时出卡并标记 detected", () => {
        const conditions: SkinCondition[] = [
            { condition: "色斑", severity: "mild", area: "颧骨", description: "颧骨浅层色斑" },
        ];
        const problems = buildFocusProblems(makeDimensions(), {}, conditions);
        const spots = problems.find((p) => p.name === "色斑");
        expect(spots).toBeDefined();
        expect(spots?.detected).toBe(true);
        expect(spots?.area).toBe("颧骨");
        expect(spots?.description).toBe("颧骨浅层色斑");
    });

    it("分数档位与症状严重度取更严重者", () => {
        const dims = makeDimensions();
        const conditions: SkinCondition[] = [
            { condition: "黑眼圈", severity: "moderate", area: "眼周", description: "眼周色素沉着" },
        ];
        const problems = buildFocusProblems(dims, {}, conditions);
        const darkCircles = problems.find((p) => p.name === "黑眼圈");
        expect(darkCircles?.level).toBe("severe");
    });

    it("按严重程度排序：重度 → 中度 → 轻度", () => {
        const problems = buildFocusProblems(makeDimensions());
        const levels = problems.map((p) => p.level);
        const firstSevere = levels.indexOf("severe");
        const firstModerate = levels.indexOf("moderate");
        const firstMild = levels.indexOf("mild");
        if (firstSevere !== -1 && firstModerate !== -1) {
            expect(firstSevere).toBeLessThan(firstModerate);
        }
        if (firstModerate !== -1 && firstMild !== -1) {
            expect(firstModerate).toBeLessThan(firstMild);
        }
    });

    it("无数据时返回空数组", () => {
        expect(buildFocusProblems(undefined)).toEqual([]);
    });
});

describe("buildFocusProblems - 成因与解决方法", () => {
    it("解决方案按 护肤/睡眠/饮食/运动/情绪/压力 分组", () => {
        const problems = buildFocusProblems(makeDimensions());
        const darkCircles = problems.find((p) => p.name === "黑眼圈");
        const categories = darkCircles?.solutionGroups.map((g) => g.category) ?? [];
        expect(categories).toEqual(["skincare", "sleep", "diet", "exercise", "mood", "stress"]);
        expect(categories[0]).toBe("skincare");
    });

    it("睡眠差时才展示睡眠加重因素", () => {
        const dims = makeDimensions();
        const noSleep: LifestyleAnswers = { sleepQuality: "good" };
        const poorSleep: LifestyleAnswers = { sleepQuality: "poor" };

        const without = buildFocusProblems(dims, noSleep).find((p) => p.name === "黑眼圈");
        expect(without?.aggravatorGroups.some((g) => g.category === "sleep")).toBe(false);

        const withSleep = buildFocusProblems(dims, poorSleep).find((p) => p.name === "黑眼圈");
        expect(withSleep?.aggravatorGroups.some((g) => g.category === "sleep")).toBe(true);
    });

    it("无问卷数据时不凭空展示睡眠/压力/护肤习惯加重因素", () => {
        const problems = buildFocusProblems(makeDimensions(), {});
        const darkCircles = problems.find((p) => p.name === "黑眼圈");
        const categories = darkCircles?.aggravatorGroups.map((g) => g.category) ?? [];
        expect(categories).not.toContain("sleep");
        expect(categories).not.toContain("stress");
        expect(categories).not.toContain("care");
    });

    it("日晒加重因素恒展示（环境因素）", () => {
        const dims = makeDimensions();
        dims.wrinkles = { score: 45, grade: "poor", details: "" };
        const problems = buildFocusProblems(dims, {});
        const fineLines = problems.find((p) => p.name === "细纹");
        expect(fineLines?.aggravatorGroups.some((g) => g.category === "sun")).toBe(true);
    });

    it("黑头与痘痘同源 acne 分数，各自出卡", () => {
        const problems = buildFocusProblems(makeDimensions());
        const blackheads = problems.find((p) => p.key === "blackheads");
        const acne = problems.find((p) => p.key === "acne");
        expect(blackheads).toBeDefined();
        expect(acne).toBeDefined();
        expect(blackheads?.score).toBe(62);
        expect(acne?.score).toBe(62);
    });

    it("acne 子分存在时黑头/痘痘分别量化（黑头分与痘痘分）", () => {
        const dims = makeDimensions();
        dims.acne = { score: 62, grade: "average", details: "", blackheads: 80, pimples: 45 };
        const problems = buildFocusProblems(dims);
        const blackheads = problems.find((p) => p.key === "blackheads");
        const acne = problems.find((p) => p.key === "acne");
        expect(blackheads).toBeUndefined();
        expect(acne).toBeDefined();
        expect(acne?.score).toBe(45);
        expect(acne?.level).toBe("moderate");
    });

    it("子分缺失时回退 acne 综合分（旧数据兼容）", () => {
        const dims = makeDimensions();
        dims.acne = { score: 58, grade: "average", details: "" };
        const problems = buildFocusProblems(dims);
        const blackheads = problems.find((p) => p.key === "blackheads");
        const acne = problems.find((p) => p.key === "acne");
        expect(blackheads?.score).toBe(58);
        expect(acne?.score).toBe(58);
    });

    it("描述优先使用 AI 维度解读（dim.details），无解读时回退知识库文案", () => {
        const dims = makeDimensions();
        const problems = buildFocusProblems(dims);
        const blackheads = problems.find((p) => p.key === "blackheads");
        expect(blackheads?.description).toBe("下巴有闭口");
        const dullness = problems.find((p) => p.key === "dullness");
        expect(dullness?.description).toBe("光泽度不足");
    });

    it("程度被症状检测上调时隐藏分数条，标记 AI 检测", () => {
        const dims = makeDimensions();
        const conditions: SkinCondition[] = [
            { condition: "痘痘", severity: "severe", area: "下巴", description: "下巴炎性痘痘" },
        ];
        const problems = buildFocusProblems(dims, {}, conditions);
        const acne = problems.find((p) => p.key === "acne");
        expect(acne?.level).toBe("severe");
        expect(acne?.score).toBeUndefined();
        expect(acne?.detected).toBe(true);
        expect(acne?.description).toBe("下巴炎性痘痘");
    });

    it("黑头症状只匹配黑头卡，不污染痘痘卡", () => {
        const dims = makeDimensions();
        dims.acne = { score: 90, grade: "excellent", details: "" };
        const conditions: SkinCondition[] = [
            { condition: "黑头", severity: "mild", area: "鼻翼", description: "鼻翼可见黑头" },
        ];
        const problems = buildFocusProblems(dims, {}, conditions);
        const blackheads = problems.find((p) => p.key === "blackheads");
        const acne = problems.find((p) => p.key === "acne");
        expect(blackheads).toBeDefined();
        expect(blackheads?.description).toBe("鼻翼可见黑头");
        expect(acne).toBeUndefined();
    });

    it("出油类症状归入水油失衡卡而非痘痘/黑头卡", () => {
        const dims = makeDimensions();
        dims.acne = { score: 90, grade: "excellent", details: "" };
        dims.waterOil = { score: 90, grade: "excellent", details: "" };
        const conditions: SkinCondition[] = [
            { condition: "T区出油明显", severity: "mild", area: "T区", description: "T区油脂分泌旺盛" },
        ];
        const problems = buildFocusProblems(dims, {}, conditions);
        const imbalance = problems.find((p) => p.key === "imbalance");
        expect(imbalance).toBeDefined();
        expect(imbalance?.description).toBe("T区油脂分泌旺盛");
        expect(problems.filter((p) => p.key === "blackheads" || p.key === "acne")).toHaveLength(0);
    });
});
