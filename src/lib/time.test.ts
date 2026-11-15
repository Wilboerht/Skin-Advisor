import { describe, expect, it } from "vitest";
import { formatBeijingDateTime, todayKeyShanghai } from "./time";

describe("formatBeijingDateTime", () => {
    it("固定按北京时间展示并包含年份", () => {
        const text = formatBeijingDateTime("2026-01-01T00:00:00.000Z");
        expect(text).toContain("2026");
        expect(text).toContain("08:00:00");
    });

    it("非法时间返回占位符", () => {
        expect(formatBeijingDateTime("not-a-date")).toBe("—");
    });
});

describe("todayKeyShanghai", () => {
    it("UTC 16:00 后切换为北京时间次日", () => {
        expect(todayKeyShanghai(new Date("2026-01-01T15:59:59.000Z"))).toBe("2026-01-01");
        expect(todayKeyShanghai(new Date("2026-01-01T16:00:00.000Z"))).toBe("2026-01-02");
    });
});
