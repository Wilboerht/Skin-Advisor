import { describe, expect, it } from "vitest";
import { buildRetestReminderIcs } from "./retest-reminder";

describe("buildRetestReminderIcs", () => {
    it("生成 4 周后的 ICS 事件", () => {
        const ics = buildRetestReminderIcs({
            analyzedAt: "2026-11-11T02:00:00.000Z",
            sessionId: "abc-123",
            focus: ["色斑控制度", "屏障耐受度"],
        });
        expect(ics).toContain("BEGIN:VCALENDAR");
        expect(ics).toContain("SUMMARY:肌智派复测提醒");
        expect(ics).toContain("DTSTART;TZID=Asia/Shanghai:20261209T100000");
        expect(ics).toContain("复测重点：色斑控制度、屏障耐受度");
        expect(ics).toContain("UID:retest-abc-123@smart.nihplod.cn");
    });

    it("无效日期/无参数也能生成", () => {
        const ics = buildRetestReminderIcs({ analyzedAt: "not-a-date" });
        expect(ics).toContain("BEGIN:VEVENT");
        expect(ics).toContain("END:VCALENDAR");
    });
});
