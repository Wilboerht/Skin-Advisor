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
        expect(text).toContain("重点问题：");
        expect(text).toContain("粉刺/痤疮（40分）");
        expect(text).toContain("光泽度（58分）");
        expect(text).toContain("水油平衡（65分）");
        expect(text).not.toContain("皮肤弹性");
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

    it("顾问链接为护肤顾问 kfid 客服链接", () => {
        expect(ADVISOR_WECOM_LINK).toBe("https://work.weixin.qq.com/kfid/kfc7834894b7ee2b86a");
    });
});
