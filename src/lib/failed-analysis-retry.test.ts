import { describe, it, expect } from "vitest";
import {
    FAILED_ANALYSIS_RETRY_TTL_MS,
    fingerprintAnswers,
    serializeFailedAnalysisRetry,
    parseFailedAnalysisRetry,
    canReuseFailedAnalysis,
    type FailedAnalysisRetry,
} from "./failed-analysis-retry";

const record = (overrides: Partial<FailedAnalysisRetry> = {}): FailedAnalysisRetry => ({
    sessionId: "sess-1",
    startedAt: 1_000_000,
    fingerprint: "abc123",
    ...overrides,
});

describe("fingerprintAnswers", () => {
    it("同一问卷字符串指纹稳定，不同问卷指纹不同", () => {
        const a = JSON.stringify({ skinType: "dry", ageRange: "26-30" });
        const b = JSON.stringify({ skinType: "dry", ageRange: "31-40" });
        expect(fingerprintAnswers(a)).toBe(fingerprintAnswers(a));
        expect(fingerprintAnswers(a)).not.toBe(fingerprintAnswers(b));
    });

    it("空串也能得到稳定指纹", () => {
        expect(fingerprintAnswers("")).toBe(fingerprintAnswers(""));
    });
});

describe("parseFailedAnalysisRetry", () => {
    it("序列化/反序列化往返一致", () => {
        const parsed = parseFailedAnalysisRetry(serializeFailedAnalysisRetry(record()), 1_000_100);
        expect(parsed).toEqual(record());
    });

    it("超过 30 分钟视为过期", () => {
        const raw = serializeFailedAnalysisRetry(record());
        expect(parseFailedAnalysisRetry(raw, 1_000_000 + FAILED_ANALYSIS_RETRY_TTL_MS - 1)).not.toBeNull();
        expect(parseFailedAnalysisRetry(raw, 1_000_000 + FAILED_ANALYSIS_RETRY_TTL_MS)).toBeNull();
    });

    it("损坏 JSON / 缺字段 / 旧版本无指纹记录 → null", () => {
        expect(parseFailedAnalysisRetry("{not-json")).toBeNull();
        expect(parseFailedAnalysisRetry(null)).toBeNull();
        expect(parseFailedAnalysisRetry("")).toBeNull();
        expect(parseFailedAnalysisRetry(JSON.stringify({ sessionId: "s", startedAt: 1 }))).toBeNull();
        expect(parseFailedAnalysisRetry(JSON.stringify({ sessionId: "s", fingerprint: "f" }))).toBeNull();
        expect(parseFailedAnalysisRetry(JSON.stringify({ startedAt: 1, fingerprint: "f" }))).toBeNull();
    });
});

describe("canReuseFailedAnalysis", () => {
    it("仅同一问卷指纹可复用", () => {
        expect(canReuseFailedAnalysis(record(), "abc123")).toBe(true);
        expect(canReuseFailedAnalysis(record(), "other")).toBe(false);
        expect(canReuseFailedAnalysis(null, "abc123")).toBe(false);
        expect(canReuseFailedAnalysis(record(), "")).toBe(false);
    });
});
