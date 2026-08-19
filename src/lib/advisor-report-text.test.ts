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
    it("只输出用户问卷信息（昵称/性别/年龄段/关注问题/医美经历/护肤习惯）", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: {
                overallScore: 82,
                dimensions: {
                    waterOil: { score: 65, grade: "average", details: "" },
                    radiance: { score: 58, grade: "fair", details: "" },
                },
            } as never,
            gender: "male",
            nickname: "111",
            answers: {
                ageRange: "20-25",
                primaryConcern: ["dryness", "acne"],
                medicalBeauty: "laser",
                skincareFrequency: "regular",
            },
        });

        expect(text).toBe(
            [
                "【肌智派测肤报告】",
                "昵称：111",
                "性别：男",
                "年龄段：20-25岁",
                "关注问题：干燥缺水、痘痘/粉刺",
                "医美经历（近3月）：光子/激光类",
                "护肤习惯：经常护肤",
            ].join("\n")
        );
    });

    it("不包含评分、肤质、过敏史、孕期、生活方式、预算等多余信息", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: {
                overallScore: 82,
                dimensions: {
                    waterOil: { score: 65, grade: "average", details: "" },
                    firmness: { score: 90, grade: "excellent", details: "" },
                },
            } as never,
            gender: "female",
            nickname: "小雨",
            answers: {
                ageRange: "26-30",
                primaryConcern: ["aging"],
                allergies: ["fragrance"],
                pregnancy: "yes",
                sleepQuality: "poor",
                stressLevel: "high",
                waterIntake: "low",
                exerciseFrequency: "low",
                dietaryHabits: "highSugar",
                sunExposure: "high",
                budget: "mid",
            },
        });

        expect(text).not.toContain("肌肤年龄");
        expect(text).not.toContain("肤质");
        expect(text).not.toContain("素颜评分");
        expect(text).not.toContain("重点问题");
        expect(text).not.toContain("各维度评分");
        expect(text).not.toContain("过敏史");
        expect(text).not.toContain("孕期");
        expect(text).not.toContain("睡眠质量");
        expect(text).not.toContain("压力水平");
        expect(text).not.toContain("饮水习惯");
        expect(text).not.toContain("运动频率");
        expect(text).not.toContain("饮食习惯");
        expect(text).not.toContain("日晒程度");
        expect(text).not.toContain("护肤预算");
        expect(text).not.toContain("⚠️");
    });

    it("昵称为「您」或未填时不输出昵称行", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: null,
            gender: "female",
            nickname: "您",
        });

        expect(text).not.toContain("昵称：");
        expect(text).toContain("性别：女");
    });

    it("医美经历为「无」时不输出该行", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: null,
            gender: "male",
            answers: { medicalBeauty: "none" },
        });

        expect(text).not.toContain("医美经历");
    });

    it("兼容旧版题库护肤习惯取值", () => {
        const text = buildAdvisorReportText({
            result: makeResult(),
            faceAnalysis: null,
            gender: "female",
            answers: { skincareFrequency: "advanced" },
        });

        expect(text).toContain("护肤习惯：精细护理（多步骤）");
    });

    it("顾问链接为护肤顾问 kfid 客服链接", () => {
        expect(ADVISOR_WECOM_LINK).toBe("https://work.weixin.qq.com/kfid/kfc7834894b7ee2b86a");
    });
});
