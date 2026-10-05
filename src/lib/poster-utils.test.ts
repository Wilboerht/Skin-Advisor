import { describe, it, expect } from "vitest";
import { isPixelDataBlank, sanitizeFilename, formatCertDate, formatCertId } from "./poster-utils";

/** 由若干 [r,g,b,a] 像素构造 RGBA 数据 */
function pixels(...list: [number, number, number, number][]): Uint8ClampedArray {
    const data = new Uint8ClampedArray(list.length * 4);
    list.forEach(([r, g, b, a], i) => {
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = a;
    });
    return data;
}

describe("isPixelDataBlank", () => {
    it("全透明视为空白（截图失败的典型产物）", () => {
        expect(isPixelDataBlank(pixels([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]))).toBe(true);
    });

    it("纯色不透明（如纯白）视为空白（渲染失败产物）", () => {
        expect(isPixelDataBlank(pixels([255, 255, 255, 255], [255, 255, 255, 255]))).toBe(true);
        expect(isPixelDataBlank(pixels([0, 38, 62, 255], [0, 38, 62, 255]))).toBe(true);
    });

    it("透明与纯色不透明混合且无颜色变化也视为空白", () => {
        expect(isPixelDataBlank(pixels([0, 0, 0, 0], [255, 255, 255, 255], [0, 0, 0, 0]))).toBe(true);
    });

    it("存在明显色差视为有内容", () => {
        expect(isPixelDataBlank(pixels([255, 255, 255, 255], [0, 38, 62, 255]))).toBe(false);
    });

    it("少量彩色像素（透明底上的小装饰）视为有内容", () => {
        expect(isPixelDataBlank(pixels([0, 0, 0, 0], [255, 255, 255, 255], [201, 168, 108, 255]))).toBe(false);
    });

    it("空数据视为空白", () => {
        expect(isPixelDataBlank(new Uint8ClampedArray(0))).toBe(true);
    });
});

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

describe("formatCertDate", () => {
    it("格式化为 YYYY.MM.DD", () => {
        expect(formatCertDate("2026-07-15T08:30:00")).toBe("2026.07.15");
    });

    it("缺失或非法日期返回 null（不展示）", () => {
        expect(formatCertDate(undefined)).toBeNull();
        expect(formatCertDate("")).toBeNull();
        expect(formatCertDate("not-a-date")).toBeNull();
    });
});

describe("formatCertId", () => {
    it("取会话 ID 后 6 位并转大写", () => {
        expect(formatCertId("cuid_abc123def456")).toBe("DEF456");
    });

    it("去除分隔符后再截取", () => {
        expect(formatCertId("a1b2-c3d4-e5f6")).toBe("D4E5F6");
    });

    it("不足 4 位返回 null", () => {
        expect(formatCertId(undefined)).toBeNull();
        expect(formatCertId("ab")).toBeNull();
        expect(formatCertId("---")).toBeNull();
    });
});
