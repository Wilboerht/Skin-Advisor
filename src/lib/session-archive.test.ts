import { describe, it, expect } from "vitest";
import { buildArchivedSummary } from "./session-archive";

describe("buildArchivedSummary", () => {
    it("保留统计字段并剔除敏感问卷字段", () => {
        const analysisResult = {
            persona: "desert",
            skinAnalysis: { typeLabel: "干性肌", score: 70 },
            faceAnalysis: {
                overallScore: 82,
                dimensions: { wrinkles: { score: 80 }, waterOil: { score: 85 } },
                heatmap: "base64-large-blob-should-be-dropped",
            },
            analysis: { summary: "长文本分析...", details: ["..."], lifestyleTips: ["..."] },
            products: [{ id: "p1" }],
        };
        const answers = {
            ageRange: "26-30",
            budget: "500-1000",
            skinType: "dry",
            primaryConcern: ["spots"],
            // 敏感字段：必须被剔除
            allergies: "花粉过敏",
            pregnancy: "pregnant",
            medicalBeauty: "光子嫩肤",
            menstrualCycle: "regular",
        };

        const summary = buildArchivedSummary(analysisResult, answers);

        expect(summary.archived).toBe(true);
        expect(summary.persona).toBe("desert");
        expect(summary.skinAnalysis?.typeLabel).toBe("干性肌");
        expect(summary.faceAnalysis?.overallScore).toBe(82);
        expect(summary.profile).toEqual({
            ageRange: "26-30",
            budget: "500-1000",
            selfSkinType: "dry",
            primaryConcern: ["spots"],
        });

        // 敏感字段与大字段一律不进冷层
        const raw = JSON.stringify(summary);
        expect(raw).not.toContain("花粉");
        expect(raw).not.toContain("pregnant");
        expect(raw).not.toContain("光子嫩肤");
        expect(raw).not.toContain("heatmap");
        expect(raw).not.toContain("长文本分析");
        expect(raw).not.toContain("p1");
    });

    it("与 skin-trends 的读取形状兼容（faceAnalysis.overallScore / dimensions.*.score）", () => {
        const summary = buildArchivedSummary(
            {
                faceAnalysis: {
                    overallScore: 90,
                    dimensions: { wrinkles: { score: 88 }, waterOil: { score: 91 } },
                },
            },
            null
        );
        const fa = summary.faceAnalysis as {
            overallScore: number;
            dimensions: { wrinkles: { score: number } };
        };
        expect(fa.overallScore).toBe(90);
        expect(fa.dimensions.wrinkles.score).toBe(88);
        expect(summary.profile).toBeNull();
    });

    it("空输入不抛异常", () => {
        const summary = buildArchivedSummary(null, undefined);
        expect(summary.archived).toBe(true);
        expect(summary.persona).toBeNull();
        expect(summary.faceAnalysis).toBeNull();
        expect(summary.skinAnalysis).toBeNull();
        expect(summary.profile).toBeNull();
    });
});
