import { describe, it, expect } from "vitest";
import { VisionAnalysisOutputSchema } from "./advisor-utils";
import { normalizeVisionOutput } from "./ai-vision";

function baseOutput(overrides: Record<string, unknown> = {}) {
    return {
        validation: { isValid: true },
        dimensions: { waterOil: { score: "82", grade: "优秀" } },
        zoneAnalysis: {
            forehead: {},
            tZone: {},
            leftCheek: {},
            rightCheek: {},
            eyeArea: {},
            jawline: {},
        },
        ...overrides,
    };
}

describe("VisionAnalysisOutputSchema", () => {
    it("归一化字符串分数与中文 grade 后通过校验", () => {
        const parsed = VisionAnalysisOutputSchema.safeParse(normalizeVisionOutput(baseOutput()));
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.dimensions?.waterOil.score).toBe(82);
            expect(parsed.data.dimensions?.waterOil.grade).toBe("excellent");
        }
    });

    it("缺失 validation 直接失败，避免绕过图片校验", () => {
        const parsed = VisionAnalysisOutputSchema.safeParse(normalizeVisionOutput(baseOutput({ validation: undefined })));
        expect(parsed.success).toBe(false);
    });

    it("有效结果缺少 dimensions/zoneAnalysis 时失败", () => {
        const parsed = VisionAnalysisOutputSchema.safeParse(normalizeVisionOutput({
            validation: { isValid: true },
        }));
        expect(parsed.success).toBe(false);
    });
});
