import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunk-reload";

describe("isChunkLoadError", () => {
    it("识别 webpack ChunkLoadError 名称", () => {
        const error = new Error("anything");
        error.name = "ChunkLoadError";
        expect(isChunkLoadError(error)).toBe(true);
    });

    it("识别不同 webpack 版本的 chunk 文案", () => {
        expect(isChunkLoadError(new Error("Loading chunk 4744 failed.\n(error: https://x/page.js)"))).toBe(true);
        expect(isChunkLoadError(new Error("Loading CSS chunk 123 failed."))).toBe(true);
        expect(isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/page.js"))).toBe(true);
    });

    it("普通错误与非错误值不误判，字符串文案可识别", () => {
        expect(isChunkLoadError(new Error("分析结果准备时间有点长"))).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
        expect(isChunkLoadError(undefined)).toBe(false);
        expect(isChunkLoadError("Loading chunk 1 failed")).toBe(true);
        expect(isChunkLoadError({ message: "加载 chunk 失败" })).toBe(false);
    });
});
