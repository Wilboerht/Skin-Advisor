import { describe, expect, it } from "vitest";
import { renderReportPoster } from "./poster";

describe("renderReportPoster", () => {
    it("生成合法 PNG（qr / noqr）", async () => {
        for (const variant of ["qr", "noqr"] as const) {
            const buffer = await renderReportPoster({
                persona: "guardian",
                gender: "female",
                variant,
                nickname: "测试用户",
                score: 82,
                percentile: 76,
                sampleSize: 320,
                testDate: "2026-11-12T00:00:00.000Z",
                reportId: "sess-test-1234",
                advice: ["先修护屏障", "坚持防晒"],
            });
            expect(buffer.length).toBeGreaterThan(10_000);
            // PNG 文件头：89 50 4E 47
            expect(buffer.subarray(0, 4).toString("hex")).toBe("89504e47");
        }
    });
});
