import { describe, it, expect } from "vitest";
import { isCompletedAnalysisResult, normalizeAnalysisResult } from "./analysis-result";

describe("normalizeAnalysisResult", () => {
    it("保留服务端 freeRetryUsed 标记", () => {
        const result = normalizeAnalysisResult({
            skinProfile: { type: "dry", typeLabel: "干性肌肤", concerns: [] },
            analysis: { summary: "ok", details: [] },
            freeRetryUsed: true,
        });
        expect(result?.freeRetryUsed).toBe(true);
    });

    it("脏数据：type 非字符串回退 combination，products 过滤 null", () => {
        const result = normalizeAnalysisResult({
            skinProfile: { type: 123, typeLabel: { bad: true }, concerns: [] },
            analysis: { summary: "ok", details: [] },
            products: [null, { id: "p1", name: "x" }],
        });
        expect(result?.skinProfile.type).toBe("combination");
        expect(result?.skinProfile.typeLabel).toBe("混合性肌肤");
        expect(result?.products).toHaveLength(1);
    });

    it("isCompletedAnalysisResult：mid-flight face 结果不是完整报告", () => {
        expect(isCompletedAnalysisResult({ faceAnalysis: { overallScore: 80 } })).toBe(false);
        expect(isCompletedAnalysisResult({ reportVersion: 2 })).toBe(true);
        expect(isCompletedAnalysisResult({ reportVersion: 3 })).toBe(true);
        expect(isCompletedAnalysisResult({ reportVersion: 4 })).toBe(true);
        expect(isCompletedAnalysisResult({ consultantReport: { overview: "x" } })).toBe(true);
        expect(isCompletedAnalysisResult({ skinAnalysis: { type: "dry" } })).toBe(true);
        expect(isCompletedAnalysisResult({ skinProfile: { type: "dry" } })).toBe(true);
        expect(isCompletedAnalysisResult(null)).toBe(false);
    });

    it("v3 报告保留 reportV3 供跨端 ReportView 使用", () => {
        const reportV3 = {
            schemaVersion: 3,
            engineVersion: "1",
            narrativeSource: "ai",
            meta: { schemaVersion: 3, engineVersion: "1", narrativeSource: "ai" },
            summary: { overview: "ok", strengths: [] },
            findings: [],
            routine: null,
            products: [],
            safety: null,
            next: { retestFocus: [], retestInDays: 28 },
        };
        const result = normalizeAnalysisResult({
            skinProfile: { type: "dry", typeLabel: "干性肌肤", concerns: [] },
            analysis: { summary: "ok", details: [] },
            reportVersion: 3,
            reportV3,
        });
        expect(result?.reportVersion).toBe(3);
        expect(result?.reportV3?.schemaVersion).toBe(3);
    });

    it("v2 报告缺 medicalBoundary 时补空串，避免报告页崩溃", () => {
        const result = normalizeAnalysisResult({
            skinProfile: { type: "dry", typeLabel: "干性肌肤", concerns: [] },
            analysis: { summary: "ok", details: [] },
            consultantReport: {
                overview: "ok",
                issues: [{ title: "t", observation: "o" }],
                strengths: [],
            },
        });
        expect(result?.consultantReport?.issues[0]?.medicalBoundary).toBe("");
    });
});
