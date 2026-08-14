import { describe, it, expect } from "vitest";
import { extractReportSummary } from "./internal-report";

const RAW = {
    sessionId: "sess-1234567890",
    nickname: "小雨",
    faceAnalysis: {
        overallScore: 82,
        gender: { value: "female", confidence: 0.97 },
        skinAge: { estimated: 26, factors: [] },
        dimensions: {
            radiance: { score: 58, grade: "fair", details: "" },
            waterOil: { score: 65, grade: "average", details: "" },
        },
    },
    skinProfile: { type: "combination_dry", typeLabel: "混干性肌肤", skinAge: 28 },
    analysis: { summary: "整体状态良好", details: [] },
    dataSource: "comprehensive",
};

describe("extractReportSummary", () => {
    it("从综合报告快照提取档案字段", () => {
        const s = extractReportSummary(RAW, "sess-1234567890", { gender: "female" });
        expect(s.found).toBe(true);
        expect(s.nickname).toBe("小雨");
        expect(s.gender).toBe("female");
        expect(s.skinType).toBe("combination_dry");
        expect(s.skinTypeLabel).toBe("混干性肌肤");
        expect(s.skinAge).toBe(28);
        expect(s.overallScore).toBe(82);
        expect(s.percentile).toBeGreaterThan(0);
        expect(s.issues).toEqual([
            { label: "光泽度", score: 58 },
            { label: "水油平衡", score: 65 },
        ]);
    });

    it("问卷性别优先于 AI 识别性别", () => {
        const s = extractReportSummary(RAW, "sess-1", { gender: "male" });
        expect(s.gender).toBe("male");
    });

    it("无 answers 时回退 AI 识别性别", () => {
        const s = extractReportSummary(RAW, "sess-1");
        expect(s.gender).toBe("female");
    });

    it("问卷模式（无 faceAnalysis）仍可返回基础档案", () => {
        const s = extractReportSummary(
            {
                sessionId: "sess-2",
                skinAnalysis: { type: "oily", typeLabel: "油性肌肤", concerns: ["T区出油"] },
                analysis: { summary: "分析完成。" },
                dataSource: "questionnaire",
            },
            "sess-2",
            { gender: "female" }
        );
        expect(s.found).toBe(true);
        expect(s.skinTypeLabel).toBe("油性肌肤");
        expect(s.overallScore).toBeNull();
        expect(s.issues).toEqual([]);
    });

    it("空数据返回 found=false", () => {
        expect(extractReportSummary(null, "sess-3").found).toBe(false);
        expect(extractReportSummary({}, "sess-3").found).toBe(false);
    });
});
