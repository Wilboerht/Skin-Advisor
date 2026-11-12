import { describe, expect, it } from "vitest";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import type { ComprehensiveResult } from "@/lib/analysis-result";
import { buildReportView } from "./view";
import type { ReportV3 } from "./types";

function makeFaceAnalysis(): FaceAnalysisResult {
    return {
        validation: { isValid: true, message: "" },
        skinType: { type: "combination", confidence: 0.9 },
        skinAge: { estimated: 28, factors: ["细纹"], range: [26, 30] },
        dimensions: {
            waterOil: { score: 82, grade: "good", details: "T区略油", confidence: 0.8 },
            skinTone: { score: 74, grade: "good", details: "整体均匀", confidence: 0.8 },
            spots: { score: 58, grade: "average", details: "两颊可见色沉", confidence: 0.7 },
            wrinkles: { score: 76, grade: "good", details: "眼周干纹", confidence: 0.7 },
            uvDamage: { score: 70, grade: "good", details: "轻度光老化", confidence: 0.6 },
            sensitivity: { score: 66, grade: "average", details: "两颊轻微泛红", confidence: 0.6 },
            darkCircles: { score: 62, grade: "average", details: "眼周暗沉", confidence: 0.4 },
            firmness: { score: 80, grade: "good", details: "弹性尚可", confidence: 0.7 },
            acne: { score: 55, grade: "average", details: "少量闭口", confidence: 0.6, blackheads: 52, pimples: 78 },
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
        skinConditions: [
            { condition: "两颊可见泛红", severity: "mild", area: "两颊", description: "轻微" },
        ],
        zoneAnalysis: {
            forehead: { condition: "较稳定", advice: "保持清洁", oil: 80, texture: 78 },
            tZone: { condition: "略油", advice: "控油", oil: 62, texture: 70 },
            leftCheek: { condition: "可见色沉", advice: "提亮", spots: 55, redness: 60 },
            rightCheek: { condition: "可见色沉", advice: "提亮", spots: 56, redness: 61 },
            eyeArea: { condition: "眼周暗沉", advice: "眼霜", darkCircles: 58 },
            jawline: { condition: "稳定", advice: "基础护理", firmness: 78 },
        },
    };
}

function makeResult(overrides: Partial<ComprehensiveResult> = {}): ComprehensiveResult {
    return {
        skinProfile: { type: "combination", typeLabel: "混合性肌肤", concerns: ["spots"], skinAge: 28 },
        analysis: { summary: "整体状态尚可", details: [], lifestyleTips: [] },
        dataSource: "hybrid",
        persona: "guardian",
        analyzedAt: "2026-11-12T00:00:00.000Z",
        nickname: "测试用户",
        reportVersion: 2,
        consultantReport: {
            overview: "整体底子不错，重点看两颊色沉。",
            issues: [
                {
                    title: "两颊色斑倾向",
                    severity: "moderate",
                    observation: "两颊可见色沉，色斑维度 58 分。",
                    directCauses: "紫外线累积",
                    indirectCauses: "日晒较多",
                    skincarePlan: "使用含烟酰胺的精华，每日早晚。",
                    lifestylePlan: "加强防晒。",
                    medicalBoundary: "如短期明显加深，建议皮肤科面诊。",
                    relatedDimensions: ["spots", "sensitivity"],
                },
            ],
            strengths: ["水油平衡较好"],
            routineNote: "本次重点加强提亮。",
        },
        safetyNotes: {
            excluded: [],
            actives: ["烟酰胺"],
            conflicts: [],
            patchTest: "先做斑贴测试",
            sunProtection: "SPF30+",
            whenToSeeDoctor: [],
        },
        products: [
            {
                id: "p1",
                name: "测试精华",
                category: "精华露",
                reason: "针对色沉",
                image: "/p1.jpg",
                price: "500",
                keyIngredients: ["烟酰胺"],
                benefits: ["提亮"],
                source: "ai",
            },
        ],
        ...overrides,
    };
}

describe("buildReportView", () => {
    it("v2 报告：十维、问题证据、产品、安全、复测重点都能投影", () => {
        const view = buildReportView({ result: makeResult(), faceAnalysis: makeFaceAnalysis(), sessionId: "sess-1" });
        expect(view.meta.sessionId).toBe("sess-1");
        expect(view.meta.reportVersion).toBe(2);
        expect(view.meta.overallScore).toBe(70);
        expect(view.meta.coverage?.scored).toBe(10);
        expect(view.dimensions.find((d) => d.key === "spots")?.score).toBe(58);
        expect(view.dimensions.find((d) => d.key === "darkCircles")?.lowConfidence).toBe(true);
        expect(view.dimensions.find((d) => d.key === "acne")?.blackheads).toBe(52);
        expect(view.findings[0].severityLabel).toBe("中度");
        expect(view.findings[0].evidence.find((e) => e.key === "spots")?.score).toBe(58);
        expect(view.summary.topFinding?.title).toBe("两颊色斑倾向");
        expect(view.summary.nextStep).toBe("本次重点加强提亮。");
        expect(view.products[0].name).toBe("测试精华");
        expect(view.safety?.actives).toEqual(["烟酰胺"]);
        expect(view.next.retestFocus).toHaveLength(2);
        expect(view.legacy).toBe(true);
    });

    it("v3 报告：优先使用 reportV3 的 findings / routine / products", () => {
        const reportV3: ReportV3 = {
            schemaVersion: 3,
            engineVersion: "1",
            narrativeSource: "fallback",
            meta: { schemaVersion: 3, engineVersion: "1", narrativeSource: "fallback" },
            summary: { overview: "v3 总评", strengths: ["屏障稳定"], nextStep: "先做基础保湿" },
            findings: [{
                id: "finding-1",
                title: "屏障偏弱",
                severity: "mild",
                score: 66,
                evidenceRefs: [{ type: "dimension", key: "sensitivity", label: "屏障耐受度", score: 66 }],
                narrative: { observation: "两颊轻微泛红", skincarePlan: "温和修护" },
            }],
            routine: { morning: [{ text: "洁面" }], night: [{ text: "修护霜" }], routineNote: "先修护" },
            products: [{ id: "p2", name: "修护霜", reason: "对应屏障问题" }],
            safety: null,
            next: { retestFocus: ["屏障耐受度"], retestInDays: 28 },
        };
        const view = buildReportView({
            result: makeResult({ reportVersion: 3, reportV3 }),
            faceAnalysis: makeFaceAnalysis(),
            sessionId: "sess-2",
        });
        expect(view.meta.reportVersion).toBe(3);
        expect(view.meta.narrativeSource).toBe("fallback");
        expect(view.legacy).toBe(false);
        expect(view.summary.overview).toBe("v3 总评");
        expect(view.findings[0].title).toBe("屏障偏弱");
        expect(view.findings[0].evidence[0].score).toBe(66);
        expect(view.routine?.routineNote).toBe("先修护");
        expect(view.products[0].name).toBe("修护霜");
        expect(view.next.retestFocus).toEqual(["屏障耐受度"]);
    });
});

describe("buildReportView privacy", () => {
    it("跨端 View 不包含问卷敏感字段", () => {
        const view = buildReportView({
            result: makeResult(),
            faceAnalysis: makeFaceAnalysis(),
            sessionId: "sess-privacy",
        });
        const serialized = JSON.stringify(view);
        expect(serialized).not.toContain("allergies");
        expect(serialized).not.toContain("pregnancy");
        expect(serialized).not.toContain("menstrualCycle");
        expect(serialized).not.toContain("medicationHistory");
    });
});
