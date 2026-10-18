import { describe, it, expect } from "vitest";
import { normalizeAnalysisResult } from "./analysis-result";

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
