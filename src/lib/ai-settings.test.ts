import { describe, it, expect } from "vitest";
import { resolveAIProvider, resolveModelPreference } from "./ai";

describe("resolveAIProvider - provider 优先级与白名单", () => {
    it("显式环境变量优先于 DB（即使 DB 合法）", () => {
        expect(resolveAIProvider("qwen", "deepseek", "qwen")).toBe("qwen");
        expect(resolveAIProvider("deepseek", "qwen", "qwen")).toBe("deepseek");
    });

    it("环境变量非法时回退 DB，DB 也非法时回退内置默认", () => {
        expect(resolveAIProvider("openai", "deepseek", "qwen")).toBe("deepseek");
        expect(resolveAIProvider("openai", "anthropic", "qwen")).toBe("qwen");
    });

    it("空字符串/空白视为未配置", () => {
        expect(resolveAIProvider("", "deepseek", "qwen")).toBe("deepseek");
        expect(resolveAIProvider("  ", undefined, "qwen")).toBe("qwen");
    });
});

describe("resolveModelPreference - 模型优先级与白名单", () => {
    it("视觉模型：env 的 qwen-vl-plus 不再被 DB 旧值 qwen-vl-max 压制（存量 DB 修不动的成本问题）", () => {
        expect(resolveModelPreference("qwen-vl-plus", "qwen-vl-max", "qwen", "visionModel")).toBe("qwen-vl-plus");
    });

    it("文本模型：env 优先于 DB", () => {
        expect(resolveModelPreference("qwen-max", "qwen-plus", "qwen", "model")).toBe("qwen-max");
    });

    it("环境变量未配置时使用 DB（合法模型）", () => {
        expect(resolveModelPreference(undefined, "qwen-plus", "qwen", "model")).toBe("qwen-plus");
        expect(resolveModelPreference("", "qwen-vl-max", "qwen", "visionModel")).toBe("qwen-vl-max");
    });

    it("env 与 DB 都不合法时回退 provider 内置默认", () => {
        expect(resolveModelPreference("gpt-4o", "claude-3-opus", "qwen", "model")).toBe("qwen-plus");
        expect(resolveModelPreference("gpt-4o", undefined, "qwen", "visionModel")).toBe("qwen-vl-plus");
        expect(resolveModelPreference(undefined, undefined, "deepseek", "model")).toBe("deepseek-chat");
        expect(resolveModelPreference(undefined, undefined, "deepseek", "visionModel")).toBe("deepseek-vl");
    });

    it("provider 与模型不匹配时按非法处理（qwen 不接受 deepseek-chat）", () => {
        expect(resolveModelPreference(undefined, "deepseek-chat", "qwen", "model")).toBe("qwen-plus");
    });
});
