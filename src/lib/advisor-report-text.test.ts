import { describe, it, expect } from "vitest";
import { buildAdvisorReportText, ADVISOR_WECOM_LINK } from "./advisor-report-text";
import type { ComprehensiveResult } from "./analysis-result";

function makeResult(overrides: Partial<ComprehensiveResult> = {}): ComprehensiveResult {
    return {
        skinProfile: { type: "combination_dry", typeLabel: "混干性肌肤", concerns: [], skinAge: 28 },
        analysis: { summary: "整体状态良好", details: [] },
        dataSource: "comprehensive",
        ...overrides,
    };
}

describe("buildAdvisorReportText", () => {
    it("输出结构化档案字段（性别/肌肤年龄/肤质/评分）", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: {
                overallScore: 82,
                dimensions: {
                    waterOil: { score: 65, grade: "average", details: "" },
                    radiance: { score: 58, grade: "fair", details: "" },
                },
            } as never,
            gender: "female",
            nickname: "小雨",
        });

        expect(text).toContain("【肌智派测肤报告】");
        expect(text).toContain("昵称：小雨");
        expect(text).toContain("性别：女");
        expect(text).toContain("肌肤年龄：28岁");
        expect(text).toContain("肤质：混干性肌肤");
        expect(text).toContain("素颜评分：82分");
    });

    it("重点问题取最低分维度（<70 分，最多 3 个）", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: {
                overallScore: 70,
                dimensions: {
                    waterOil: { score: 65, grade: "average", details: "" },
                    radiance: { score: 58, grade: "fair", details: "" },
                    acne: { score: 40, grade: "poor", details: "" },
                    firmness: { score: 90, grade: "excellent", details: "" },
                },
            } as never,
            gender: "male",
        });

        expect(text).toContain("性别：男");
        // 重点问题行只含 <70 分的最低 3 项；皮肤弹性（90分）出现在完整十维行而非重点问题行
        const issueLine = text.split("\n").find((l) => l.startsWith("重点问题："))!;
        expect(issueLine).toContain("粉刺/痤疮（40分）");
        expect(issueLine).toContain("光泽度（58分）");
        expect(issueLine).toContain("水油平衡（65分）");
        expect(issueLine).not.toContain("皮肤弹性");
    });

    it("无低分维度时标记无明显问题", () => {
        const text = buildAdvisorReportText({
            result: makeResult({ skinProfile: { type: "normal", typeLabel: "中性肌肤", concerns: [], skinAge: 25 } }),
            faceAnalysis: {
                overallScore: 90,
                dimensions: { waterOil: { score: 88, grade: "excellent", details: "" } },
            } as never,
            gender: "",
        });

        expect(text).toContain("重点问题：无明显问题");
        expect(text).not.toContain("性别：");
    });

    it("问卷模式（无 faceAnalysis）回退到 concerns 且不含评分", () => {
        const text = buildAdvisorReportText({
            result: makeResult({
                dataSource: "questionnaire",
                skinProfile: { type: "oily", typeLabel: "油性肌肤", concerns: ["T区出油"], skinAge: undefined },
            }),
            faceAnalysis: null,
            gender: "",
            nickname: "您",
        });

        expect(text).toContain("肤质：油性肌肤");
        expect(text).toContain("重点问题：T区出油");
        expect(text).not.toContain("素颜评分");
        expect(text).not.toContain("昵称：");
    });

    it("传入 answers 时附带完整问卷档案（过敏史/孕期/预算等）", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: null,
            gender: "female",
            answers: {
                ageRange: "26-30",
                primaryConcern: ["aging", "spots"],
                allergies: ["fragrance", "alcohol"],
                pregnancy: "yes",
                medicalBeauty: "laser",
                sleepQuality: "poor",
                stressLevel: "high",
                menstrualCycle: "luteal",
                skincareFrequency: "daily",
                budget: "mid",
            },
        });

        expect(text).toContain("年龄段：26-30岁");
        expect(text).toContain("关注问题：细纹/松弛、色斑/暗沉");
        expect(text).toContain("⚠️过敏史：香精过敏、酒精过敏");
        expect(text).toContain("⚠️备孕/孕期/哺乳期：是");
        expect(text).toContain("医美经历（近3月）：光子/激光类");
        expect(text).toContain("睡眠质量：较差（经常熬夜/失眠）");
        expect(text).toContain("压力水平：很大（焦虑/紧绷）");
        expect(text).toContain("生理周期：黄体期（经前一周）");
        expect(text).toContain("护肤习惯：每天精细护肤");
        expect(text).toContain("护肤预算：中等预算（单品300-1000元）");
    });

    it("无过敏史/非孕期时不加 ⚠️ 标记", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: null,
            gender: "female",
            answers: { allergies: ["none"], pregnancy: "no", medicalBeauty: "none", menstrualCycle: "na" },
        });

        expect(text).toContain("过敏史：无过敏史");
        expect(text).not.toContain("⚠️");
        expect(text).not.toContain("孕期");
        expect(text).not.toContain("医美经历");
        expect(text).not.toContain("生理周期");
    });

    it("兼容旧键名 pregnancyStatus 与旧版题库取值", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: null,
            gender: "female",
            answers: { pregnancyStatus: "yes", skincareFrequency: "advanced" },
        });

        expect(text).toContain("⚠️备孕/孕期/哺乳期：是");
        expect(text).toContain("护肤习惯：精细护理（多步骤）");
    });

    it("包含完整十维评分（含 ≥70 分的正常维度）", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: {
                overallScore: 80,
                dimensions: {
                    waterOil: { score: 65, grade: "average", details: "" },
                    firmness: { score: 90, grade: "excellent", details: "" },
                },
            } as never,
            gender: "",
        });

        expect(text).toContain("各维度评分：");
        expect(text).toContain("水油平衡65分");
        expect(text).toContain("皮肤弹性90分");
    });

    it("顾问链接为护肤顾问 kfid 客服链接", () => {
        expect(ADVISOR_WECOM_LINK).toBe("https://work.weixin.qq.com/kfid/kfc7834894b7ee2b86a");
    });
});
