import { describe, it, expect } from "vitest";
import {
    POSTER_TEMPLATES,
    READY_POSTER_TEMPLATES,
    DEFAULT_POSTER_TEMPLATE_ID,
    isPosterTemplateId,
} from "./poster-templates";

describe("海报模板配置", () => {
    it("经典版与小红书版均已就绪", () => {
        expect(POSTER_TEMPLATES.classic.ready).toBe(true);
        expect(POSTER_TEMPLATES.xhs.ready).toBe(true);
        expect(READY_POSTER_TEMPLATES.map((t) => t.id).sort()).toEqual(["classic", "xhs"]);
    });

    it("小红书版不渲染二维码，经典版含二维码", () => {
        expect(POSTER_TEMPLATES.xhs.qr).toBeNull();
        expect(POSTER_TEMPLATES.classic.qr).not.toBeNull();
    });

    it("两套模板同画布、同字段坐标（小红书版为同版式派生底图）", () => {
        expect(POSTER_TEMPLATES.xhs.canvas).toEqual(POSTER_TEMPLATES.classic.canvas);
        expect(POSTER_TEMPLATES.xhs.pixelRatio).toBe(POSTER_TEMPLATES.classic.pixelRatio);
        expect(POSTER_TEMPLATES.xhs.fields).toBe(POSTER_TEMPLATES.classic.fields);
    });

    it("导出文件名后缀可区分两套证书", () => {
        expect(POSTER_TEMPLATES.classic.filenameSuffix).toBe("");
        expect(POSTER_TEMPLATES.xhs.filenameSuffix).not.toBe("");
    });

    it("默认模板为经典版，ID 校验拒绝未知值", () => {
        expect(DEFAULT_POSTER_TEMPLATE_ID).toBe("classic");
        expect(isPosterTemplateId("classic")).toBe(true);
        expect(isPosterTemplateId("xhs")).toBe(true);
        expect(isPosterTemplateId("other")).toBe(false);
        expect(isPosterTemplateId(null)).toBe(false);
        expect(isPosterTemplateId(undefined)).toBe(false);
    });
});
