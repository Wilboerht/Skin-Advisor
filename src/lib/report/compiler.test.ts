import { describe, expect, it } from "vitest";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { buildDiagnosis, narrativeMatchesDiagnosis } from "./diagnosis";
import { buildFallbackConsultantReport } from "./fallback";
import { compileReportV3 } from "./compile";

function makeFaceAnalysis(overrides: Partial<FaceAnalysisResult> = {}): FaceAnalysisResult {
    return {
        validation: { isValid: true, message: "" },
        skinType: { type: "combination", confidence: 0.9 },
        skinAge: { estimated: 28, factors: [], range: [26, 30] },
        dimensions: {
            waterOil: { score: 82, grade: "good", details: "T区略油", confidence: 0.8 },
            skinTone: { score: 74, grade: "good", details: "整体均匀", confidence: 0.8 },
            spots: { score: 52, grade: "fair", details: "两颊可见色沉", confidence: 0.7 },
            wrinkles: { score: 76, grade: "good", details: "眼周干纹", confidence: 0.7 },
            uvDamage: { score: 70, grade: "good", details: "轻度光老化", confidence: 0.6 },
            sensitivity: { score: 66, grade: "average", details: "两颊轻微泛红", confidence: 0.6 },
            darkCircles: { score: 62, grade: "average", details: "眼周暗沉", confidence: 0.4 },
            firmness: { score: 80, grade: "good", details: "弹性尚可", confidence: 0.7 },
            acne: { score: 45, grade: "fair", details: "少量闭口", confidence: 0.6, blackheads: 40, pimples: 70 },
            radiance: { score: 72, grade: "good", details: "光泽一般", confidence: 0.8 },
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
        skinConditions: [{ condition: "两颊可见泛红", severity: "mild", area: "两颊", description: "轻微" }],
        zoneAnalysis: {
            forehead: { condition: "较稳定", advice: "保持清洁", oil: 80, texture: 78 },
            tZone: { condition: "略油", advice: "控油", oil: 62, texture: 70 },
            leftCheek: { condition: "可见色沉", advice: "提亮", spots: 50, redness: 60 },
            rightCheek: { condition: "可见色沉", advice: "提亮", spots: 51, redness: 61 },
            eyeArea: { condition: "眼周暗沉", advice: "眼霜", darkCircles: 58 },
            jawline: { condition: "稳定", advice: "基础护理", firmness: 78 },
        },
        ...overrides,
    };
}

describe("buildDiagnosis", () => {
    it("按分数和关注点生成 0-3 个 findings，并带证据", () => {
        const diagnosis = buildDiagnosis({
            faceAnalysis: makeFaceAnalysis(),
            answers: { primaryConcern: ["spots", "acne"] },
        });
        expect(diagnosis.findings.length).toBeGreaterThan(0);
        expect(diagnosis.findings.length).toBeLessThanOrEqual(3);
        expect(diagnosis.findings[0].severity).toBe("moderate");
        expect(diagnosis.findings[0].evidenceRefs.some((ref) => ref.type === "dimension")).toBe(true);
        expect(diagnosis.findings.some((finding) => finding.id === "dimension-spots")).toBe(true);
    });

    it("正常维度不进入 findings；命中关注点的 70-79 分维度可进入", () => {
        const stable = { score: 90, grade: "excellent" as const, details: "稳定", confidence: 0.8 };
        const face = makeFaceAnalysis({
            dimensions: {
                waterOil: { score: 75, grade: "good", details: "T区偏油", confidence: 0.8 },
                skinTone: stable,
                spots: stable,
                wrinkles: stable,
                uvDamage: stable,
                sensitivity: stable,
                darkCircles: stable,
                firmness: stable,
                acne: stable,
                radiance: stable,
            },
        });
        const withoutConcern = buildDiagnosis({ faceAnalysis: face, answers: {} });
        expect(withoutConcern.findings.some((finding) => finding.id === "dimension-waterOil")).toBe(false);
        const withConcern = buildDiagnosis({ faceAnalysis: face, answers: { primaryConcern: ["dryness"] } });
        expect(withConcern.findings.some((finding) => finding.id === "dimension-waterOil")).toBe(true);
    });
});

describe("buildFallbackConsultantReport + compileReportV3", () => {
    it("AI 失败时生成规则报告，并编译为 ReportV3", () => {
        const faceAnalysis = makeFaceAnalysis();
        const diagnosis = buildDiagnosis({ faceAnalysis, answers: { primaryConcern: ["acne"] } });
        const report = buildFallbackConsultantReport({
            faceAnalysis,
            answers: { primaryConcern: ["acne"], sleepQuality: "poor" },
            diagnosis,
        });
        expect(report.issues.length).toBeGreaterThan(0);
        expect(report.issues[0].indirectCauses).toContain("睡眠");
        expect(report.issues[0].medicalBoundary).toBeTruthy();

        const v3 = compileReportV3({
            faceAnalysis,
            consultantReport: report,
            narrativeSource: "fallback",
            persona: "guardian",
            products: [{
                id: "p1",
                name: "测试精华",
                category: "精华露",
                image: "/p1.jpg",
                price: "500",
                reason: "规则匹配",
                keyIngredients: ["烟酰胺"],
            }],
            safetyNotes: {
                excluded: [],
                actives: ["烟酰胺"],
                conflicts: [],
                patchTest: "先做斑贴测试",
                sunProtection: "SPF30+",
                whenToSeeDoctor: [],
            },
            fallbackReason: "AI_JSON_PARSE",
            analyzedAt: "2026-11-12T00:00:00.000Z",
        });
        expect(v3.schemaVersion).toBe(3);
        expect(v3.narrativeSource).toBe("fallback");
        expect(v3.meta.fallbackReason).toBe("AI_JSON_PARSE");
        expect(v3.findings.length).toBe(report.issues.length);
        expect(v3.routine?.morning.length).toBeGreaterThan(0);
        expect(v3.products[0].name).toBe("测试精华");
        expect(v3.safety?.actives).toEqual(["烟酰胺"]);
        expect(v3.next.retestInDays).toBe(28);
    });

    it("酸类过敏时 acne 兜底方案不使用酸类", () => {
        const faceAnalysis = makeFaceAnalysis();
        const diagnosis = buildDiagnosis({ faceAnalysis, answers: { primaryConcern: ["acne"] } });
        const report = buildFallbackConsultantReport({
            faceAnalysis,
            answers: { primaryConcern: ["acne"], allergies: ["acids"] },
            diagnosis,
        });
        const acneIssue = report.issues.find((issue) => issue.relatedDimensions.includes("acne"));
        expect(acneIssue).toBeTruthy();
        expect(acneIssue!.skincarePlan).not.toContain("壬二酸");
        expect(acneIssue!.skincarePlan).not.toContain("乳酸");
    });
});

describe("narrativeMatchesDiagnosis", () => {
    it("AI ����δ���ǹ��� findings ʱ���� false", () => {
        const faceAnalysis = makeFaceAnalysis();
        const diagnosis = buildDiagnosis({ faceAnalysis, answers: { primaryConcern: ["spots", "acne"] } });
        const covered = {
            issues: diagnosis.findings.map((finding) => ({
                relatedDimensions: finding.evidenceRefs.filter((ref) => ref.type === "dimension").map((ref) => ref.key),
            })),
        };
        expect(narrativeMatchesDiagnosis(covered, diagnosis)).toBe(true);
        expect(narrativeMatchesDiagnosis({ issues: [] }, diagnosis)).toBe(false);
        expect(narrativeMatchesDiagnosis({ issues: [{ relatedDimensions: ["radiance"] }] }, diagnosis)).toBe(false);
    });
});
