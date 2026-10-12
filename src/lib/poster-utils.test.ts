import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "./poster-utils";

describe("sanitizeFilename", () => {
    it("替换文件系统非法字符", () => {
        // / 替换 1 个，三之后的 : * ? " < > | 共 7 个
        expect(sanitizeFilename('张/三:*?"<>|')).toBe("张_三_______");
    });

    it("保留中文与常规字符", () => {
        expect(sanitizeFilename("小明的肌智派证书")).toBe("小明的肌智派证书");
    });

    it("空名兜底为“用户”并去除首尾空白", () => {
        expect(sanitizeFilename("   ")).toBe("用户");
        expect(sanitizeFilename(" 小明 ")).toBe("小明");
    });
});
