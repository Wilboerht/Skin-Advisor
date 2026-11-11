import { describe, expect, it } from "vitest";
import {
    ATTENTION_SCORE_THRESHOLD,
    getScoreBand,
    getScoreBandLabel,
    isAttentionScore,
} from "./score-bands";

describe("score bands", () => {
    it("按 85/70/55/40 分档", () => {
        expect(getScoreBandLabel(90)).toBe("优秀");
        expect(getScoreBandLabel(85)).toBe("优秀");
        expect(getScoreBandLabel(84)).toBe("良好");
        expect(getScoreBandLabel(70)).toBe("良好");
        expect(getScoreBandLabel(69)).toBe("一般");
        expect(getScoreBandLabel(55)).toBe("一般");
        expect(getScoreBandLabel(54)).toBe("需关注");
        expect(getScoreBandLabel(40)).toBe("需关注");
        expect(getScoreBandLabel(39)).toBe("较差");
    });

    it("统一关注阈值为 70", () => {
        expect(ATTENTION_SCORE_THRESHOLD).toBe(70);
        expect(isAttentionScore(69)).toBe(true);
        expect(isAttentionScore(70)).toBe(false);
        expect(isAttentionScore(undefined)).toBe(false);
    });

    it("非法分数返回 null/—", () => {
        expect(getScoreBand(Number.NaN)).toBeNull();
        expect(getScoreBand(undefined)).toBeNull();
        expect(getScoreBandLabel(undefined)).toBe("—");
    });
});
