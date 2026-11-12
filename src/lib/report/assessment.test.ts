import { describe, expect, it } from "vitest";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { buildSkinAssessment } from "./assessment";

const faceAnalysis: FaceAnalysisResult = {
    validation: { isValid: true, message: "" },
    skinType: { type: "combination", confidence: 0.9 },
    skinAge: { estimated: 28, factors: [], range: [26, 30] },
    dimensions: {
        waterOil: { score: 82, grade: "good", details: "稳定", confidence: 0.8 },
        skinTone: { score: 74, grade: "good", details: "均匀", confidence: 0.8 },
        spots: { score: 52, grade: "fair", details: "色沉", confidence: 0.7 },
        wrinkles: { score: 76, grade: "good", details: "干纹", confidence: 0.7 },
        uvDamage: { score: 70, grade: "good", details: "轻度", confidence: 0.6 },
        sensitivity: { score: 66, grade: "average", details: "泛红", confidence: 0.6 },
        darkCircles: { score: 62, grade: "average", details: "暗沉", confidence: 0.4 },
        firmness: { score: 80, grade: "good", details: "尚可", confidence: 0.7 },
        acne: { score: 45, grade: "fair", details: "闭口", confidence: 0.6, blackheads: 40, pimples: 70 },
        radiance: { score: 72, grade: "good", details: "一般", confidence: 0.8 },
    },
    overallScore: 70,
    scoring: {
        version: 2,
        overallScore: 70,
        scoredDimensions: 10,
        totalDimensions: 10,
        lowConfidenceDimensions: ["darkCircles"],
        notVisibleDimensions: [],
        insufficient: false,
    },
    summary: "",
    recommendations: [],
    skinConditions: [
        { condition: "两颊可见泛红", severity: "mild", area: "两颊", description: "轻微" },
    ],
    zoneAnalysis: {
        forehead: { condition: "稳定", advice: "保持", oil: 80, texture: 78 },
        tZone: { condition: "略油", advice: "控油", oil: 62, texture: 70 },
        leftCheek: { condition: "色沉", advice: "提亮", spots: 50, redness: 60 },
        rightCheek: { condition: "色沉", advice: "提亮", spots: 51, redness: 61 },
        eyeArea: { condition: "暗沉", advice: "眼霜", darkCircles: 58 },
        jawline: { condition: "稳定", advice: "基础护理", firmness: 78 },
    },
};

const rawResult = {
    skinProfile: { type: "combination", typeLabel: "混合性肌肤", concerns: ["spots"], skinAge: 28 },
    analysis: { summary: "ok", details: [] },
    dataSource: "hybrid",
    persona: "guardian",
    reportVersion: 3,
    promptVersion: "2026-11-12-v5",
    faceAnalysis,
    reportV3: {
        schemaVersion: 3,
        engineVersion: "2026-11-12-phase2",
        narrativeSource: "fallback",
        meta: { schemaVersion: 3, engineVersion: "2026-11-12-phase2", narrativeSource: "fallback", model: "qwen-plus" },
        summary: { overview: "ok", strengths: [] },
        findings: [{
            id: "issue-1",
            title: "色斑倾向",
            severity: "moderate",
            score: 52,
            evidenceRefs: [{ type: "dimension", key: "spots", label: "色斑控制度", score: 52 }],
            narrative: { observation: "两颊色沉" },
        }],
        routine: null,
        products: [],
        safety: null,
        next: { retestFocus: [], retestInDays: 28 },
    },
};

describe("buildSkinAssessment", () => {
    it("提取十维/区域/覆盖率/findings，供趋势与统计使用", () => {
        const assessment = buildSkinAssessment({
            sessionId: "sess-1",
            userId: "user-1",
            completedAt: new Date("2026-11-12T00:00:00Z"),
            rawResult,
            faceAnalysis,
        });
        expect(assessment).not.toBeNull();
        expect(assessment!.overallScore).toBe(70);
        expect(assessment!.skinAge).toBe(28);
        expect(assessment!.coverageScored).toBe(10);
        expect(assessment!.dimensions.spots.score).toBe(52);
        expect(assessment!.dimensions.acne.blackheads).toBe(40);
        expect(assessment!.zones.tZone.texture).toBe(70);
        expect(assessment!.findings[0].title).toBe("色斑倾向");
        expect(assessment!.promptVersion).toBe("2026-11-12-v5");
        expect(assessment!.engineVersion).toBe("2026-11-12-phase2");
        expect(assessment!.model).toBe("qwen-plus");
    });

    it("无法归一化的结果返回 null", () => {
        expect(buildSkinAssessment({
            sessionId: "sess-2",
            userId: "user-1",
            completedAt: new Date(),
            rawResult: null,
            faceAnalysis: null,
        })).toBeNull();
    });
});
