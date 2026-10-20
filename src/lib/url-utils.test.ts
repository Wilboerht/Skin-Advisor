import { describe, it, expect } from "vitest";
import { isSafeInternalPath } from "./url-utils";

describe("isSafeInternalPath", () => {
    it("允许普通站内路径", () => {
        expect(isSafeInternalPath("/")).toBe(true);
        expect(isSafeInternalPath("/reports/abc")).toBe(true);
        expect(isSafeInternalPath("/questions?edit=true")).toBe(true);
    });

    it("拒绝协议相对/绝对外链", () => {
        expect(isSafeInternalPath("//evil.com")).toBe(false);
        expect(isSafeInternalPath("https://evil.com")).toBe(false);
        expect(isSafeInternalPath("javascript:alert(1)")).toBe(false);
    });

    it("拒绝反斜杠与控制字符绕过", () => {
        expect(isSafeInternalPath("/\\evil.com")).toBe(false);
        expect(isSafeInternalPath("/\t/evil.com")).toBe(false);
        expect(isSafeInternalPath("/\n/evil.com")).toBe(false);
        expect(isSafeInternalPath("/\u0000evil.com")).toBe(false);
        // Next searchParams 会先解码，模拟 /%09/evil.com 与 /%5Cevil.com
        expect(isSafeInternalPath(decodeURIComponent("/%09/evil.com"))).toBe(false);
        expect(isSafeInternalPath(decodeURIComponent("/%5Cevil.com"))).toBe(false);
    });

    it("拒绝空值/非字符串", () => {
        expect(isSafeInternalPath(null)).toBe(false);
        expect(isSafeInternalPath(undefined)).toBe(false);
        expect(isSafeInternalPath("")).toBe(false);
    });
});
