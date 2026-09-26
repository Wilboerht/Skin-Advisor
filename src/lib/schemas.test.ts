import { describe, it, expect } from "vitest";
import { AnalyzeRequestSchema } from "./schemas";

describe("AnalyzeRequestSchema - 面部分析字段透传", () => {
    it("acne 子分 blackheads/pimples 不被 zod 剥离（v2 证据链依赖）", () => {
        const parsed = AnalyzeRequestSchema.parse({
            answers: { primaryConcern: ["acne"] },
            faceAnalysis: {
                overallScore: 72,
                dimensions: {
                    acne: { score: 64, grade: "average", blackheads: 55, pimples: 82 },
                },
            },
        });

        const acne = parsed.faceAnalysis?.dimensions?.acne as Record<string, unknown> | undefined;
        expect(acne?.blackheads).toBe(55);
        expect(acne?.pimples).toBe(82);
    });

    it("孕期状态透传（产品硬过滤依赖）", () => {
        const parsed = AnalyzeRequestSchema.parse({
            answers: { pregnancy: "yes" },
        });
        expect(parsed.answers.pregnancy).toBe("yes");
    });

    it("分数越界被钳制到 0-100", () => {
        const parsed = AnalyzeRequestSchema.parse({
            answers: { primaryConcern: ["acne"] },
            faceAnalysis: { dimensions: { acne: { score: 120 } } },
        });
        expect(parsed.faceAnalysis?.dimensions?.acne?.score).toBe(100);
    });
});
