/**
 * isPublicPath 单元测试
 * 覆盖：精确匹配、":path*" 通配、非公开路径（含回调死循环防护依赖的 /reports/[id]）
 */
import { describe, it, expect } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
    it("精确匹配的公开页面", () => {
        expect(isPublicPath("/")).toBe(true);
        expect(isPublicPath("/result")).toBe(true);
        expect(isPublicPath("/login")).toBe(true);
    });

    it('":path*" 通配匹配自身与子路径', () => {
        expect(isPublicPath("/skin-types")).toBe(true);
        expect(isPublicPath("/skin-types/dry")).toBe(true);
        expect(isPublicPath("/admin")).toBe(true);
        expect(isPublicPath("/admin/users")).toBe(true);
    });

    it("需登录页面判定为非公开（回调死循环防护依赖）", () => {
        expect(isPublicPath("/reports/abc123")).toBe(false);
        expect(isPublicPath("/questions-x")).toBe(false);
        expect(isPublicPath("/api/user/points")).toBe(false);
    });

    it("通配前缀不误伤相似前缀路径", () => {
        // "/skin-types/:path*" 不应匹配 "/skin-typesx"
        expect(isPublicPath("/skin-typesx")).toBe(false);
    });
});
