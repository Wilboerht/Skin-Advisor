import { describe, expect, it } from "vitest";
import { selectRoutedTextModel } from "./model-routing";
import type { ReportFinding } from "./types";

function finding(severity: ReportFinding["severity"]): ReportFinding {
    return {
        id: "f1",
        title: "t",
        severity,
        evidenceRefs: [],
        narrative: { observation: "o" },
    };
}

describe("selectRoutedTextModel", () => {
    it("默认关闭，不覆盖配置模型", () => {
        expect(selectRoutedTextModel("deepseek", [finding("severe")], {}).model).toBeUndefined();
    });

    it("开启后：轻度用快模型，中重度用强模型", () => {
        const env = {
            AI_TEXT_ROUTING_ENABLED: "true",
            AI_TEXT_FAST_MODEL: "deepseek-flash",
            AI_TEXT_STRONG_MODEL: "deepseek-v4-pro",
        };
        expect(selectRoutedTextModel("deepseek", [finding("mild")], env)).toMatchObject({
            model: "deepseek-flash",
            reason: "fast",
        });
        expect(selectRoutedTextModel("deepseek", [finding("moderate")], env)).toMatchObject({
            model: "deepseek-v4-pro",
            reason: "strong",
        });
    });

    it("非法模型回退配置模型", () => {
        const env = {
            AI_TEXT_ROUTING_ENABLED: "true",
            AI_TEXT_FAST_MODEL: "gpt-4o",
        };
        expect(selectRoutedTextModel("deepseek", [finding("mild")], env).model).toBeUndefined();
        expect(selectRoutedTextModel("deepseek", [finding("mild")], env).reason).toBe("fallback");
    });
});
