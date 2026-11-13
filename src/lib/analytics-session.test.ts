// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
    ANALYTICS_SESSION_KEY,
    getOrCreateAnalyticsSessionId,
    rotateAnalyticsSessionId,
    setAnalyticsSessionId,
} from "./analytics-session";

beforeEach(() => {
    sessionStorage.clear();
});

describe("analytics-session", () => {
    it("同一标签页内复用已存在的会话 ID", () => {
        const first = getOrCreateAnalyticsSessionId();
        expect(first).not.toBe("");
        expect(getOrCreateAnalyticsSessionId()).toBe(first);
    });

    it("轮换会生成新 ID 并写回 sessionStorage", () => {
        const first = getOrCreateAnalyticsSessionId();
        const next = rotateAnalyticsSessionId();
        expect(next).not.toBe(first);
        expect(sessionStorage.getItem(ANALYTICS_SESSION_KEY)).toBe(next);
        expect(getOrCreateAnalyticsSessionId()).toBe(next);
    });

    it("可把埋点会话指向分析复用的原会话 ID", () => {
        setAnalyticsSessionId("reused-session-id");
        expect(getOrCreateAnalyticsSessionId()).toBe("reused-session-id");
    });
});
