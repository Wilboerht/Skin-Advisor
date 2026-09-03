import { describe, it, expect } from "vitest";
import {
    AUTO_DIARY_NOTE_PREFIX,
    computeStreak,
    isAutoDiaryEntry,
    isDiaryDateInRange,
    parseClientDate,
    scoreToSkinState
} from "./diary-utils";
import { localDateStr } from "./local-date";

describe("parseClientDate", () => {
    it("解析合法 YYYY-MM-DD 为 UTC 零点", () => {
        const d = parseClientDate("2026-09-03");
        expect(d).not.toBeNull();
        expect(d!.toISOString()).toBe("2026-09-03T00:00:00.000Z");
    });

    it("拒绝非法格式", () => {
        expect(parseClientDate("2026-9-3")).toBeNull();
        expect(parseClientDate("20260903")).toBeNull();
        expect(parseClientDate("abc")).toBeNull();
        expect(parseClientDate("")).toBeNull();
    });

    it("拒绝不存在的日历日（如 2 月 30 日、13 月、非闰年 2 月 29 日）", () => {
        expect(parseClientDate("2026-02-30")).toBeNull();
        expect(parseClientDate("2026-13-01")).toBeNull();
        expect(parseClientDate("2026-02-29")).toBeNull();
    });

    it("接受闰年 2 月 29 日", () => {
        expect(parseClientDate("2024-02-29")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    });
});

describe("isDiaryDateInRange", () => {
    // 以 2026-09-03 12:00 UTC 为"现在"
    const now = new Date("2026-09-03T12:00:00.000Z");

    const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

    it("允许今天与昨天", () => {
        expect(isDiaryDateInRange(day("2026-09-03"), now)).toBe(true);
        expect(isDiaryDateInRange(day("2026-09-02"), now)).toBe(true);
    });

    it("允许明天（UTC 领先时区容差）", () => {
        expect(isDiaryDateInRange(day("2026-09-04"), now)).toBe(true);
    });

    it("允许 90 天前（UTC 落后时区容差）", () => {
        expect(isDiaryDateInRange(day("2026-06-05"), now)).toBe(true);
    });

    it("拒绝 91 天前与后天", () => {
        expect(isDiaryDateInRange(day("2026-06-04"), now)).toBe(false);
        expect(isDiaryDateInRange(day("2026-09-05"), now)).toBe(false);
    });
});

describe("scoreToSkinState", () => {
    it("档位边界正确", () => {
        expect(scoreToSkinState(100)).toBe("great");
        expect(scoreToSkinState(85)).toBe("great");
        expect(scoreToSkinState(84)).toBe("good");
        expect(scoreToSkinState(70)).toBe("good");
        expect(scoreToSkinState(69)).toBe("normal");
        expect(scoreToSkinState(55)).toBe("normal");
        expect(scoreToSkinState(54)).toBe("bad");
        expect(scoreToSkinState(40)).toBe("bad");
        expect(scoreToSkinState(39)).toBe("terrible");
        expect(scoreToSkinState(0)).toBe("terrible");
    });
});

describe("isAutoDiaryEntry", () => {
    it("识别自动生成备注", () => {
        expect(isAutoDiaryEntry({ note: `${AUTO_DIARY_NOTE_PREFIX} · 综合评分 85 分` })).toBe(true);
        expect(isAutoDiaryEntry({ note: `${AUTO_DIARY_NOTE_PREFIX} · 综合评分 85 分 · 混合性肌肤` })).toBe(true);
    });

    it("手动备注与空备注不视为自动", () => {
        expect(isAutoDiaryEntry({ note: "熬夜敷了面膜" })).toBe(false);
        expect(isAutoDiaryEntry({ note: null })).toBe(false);
        expect(isAutoDiaryEntry({ note: undefined })).toBe(false);
    });
});

describe("localDateStr", () => {
    it("本地日历日格式化（补零）", () => {
        expect(localDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
        expect(localDateStr(new Date(2026, 11, 31))).toBe("2026-12-31");
    });
});

describe("computeStreak", () => {
    // 固定"现在"为 2026-09-03 12:00 UTC
    const now = new Date("2026-09-03T12:00:00.000Z");
    const days = (...iso: string[]) => iso.map((s) => new Date(`${s}T00:00:00.000Z`));

    it("空记录：0/0", () => {
        expect(computeStreak([], now)).toEqual({ current: 0, longest: 0 });
    });

    it("今天打卡：current 从今天起算", () => {
        const r = computeStreak(days("2026-09-01", "2026-09-02", "2026-09-03"), now);
        expect(r.current).toBe(3);
        expect(r.longest).toBe(3);
    });

    it("错过今天但昨天还在：连续不断（今天未打卡前）", () => {
        const r = computeStreak(days("2026-09-01", "2026-09-02"), now);
        expect(r.current).toBe(2);
        expect(r.longest).toBe(2);
    });

    it("昨天没打卡：current 为 0，longest 取历史段", () => {
        const r = computeStreak(days("2026-08-01", "2026-08-02", "2026-08-03", "2026-09-03"), now);
        expect(r.current).toBe(1);
        expect(r.longest).toBe(3);
    });

    it("跨月连续段正确", () => {
        const r = computeStreak(days("2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01"), now);
        expect(r.longest).toBe(4);
    });

    it("乱序与重复输入不影响结果", () => {
        const r = computeStreak(days("2026-09-03", "2026-09-01", "2026-09-01", "2026-09-02"), now);
        expect(r.current).toBe(3);
        expect(r.longest).toBe(3);
    });
});
