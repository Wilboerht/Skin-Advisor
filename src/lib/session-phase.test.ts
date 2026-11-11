import { describe, expect, it } from "vitest";
import { deriveSessionPhase, phaseToStatus } from "./session-phase";

const now = new Date("2026-11-11T10:00:00Z").getTime();

describe("deriveSessionPhase", () => {
    it("报告已完成时优先 completed", () => {
        expect(deriveSessionPhase({ hasReport: true, completedAt: new Date(now - 1000), now })).toBe("completed");
    });

    it("面部完成、文本未开始 → face_completed", () => {
        expect(deriveSessionPhase({
            hasReport: false,
            faceScanCompletedAt: new Date(now - 1000),
            now,
        })).toBe("face_completed");
    });

    it("面部进行中 → face_analyzing", () => {
        expect(deriveSessionPhase({
            hasReport: false,
            faceScanStartedAt: new Date(now - 1000),
            now,
        })).toBe("face_analyzing");
    });

    it("面部开始时间超过僵尸阈值 → pending", () => {
        expect(deriveSessionPhase({
            hasReport: false,
            faceScanStartedAt: new Date(now - 6 * 60 * 1000),
            now,
        })).toBe("pending");
    });

    it("文本进行中 → text_analyzing", () => {
        expect(deriveSessionPhase({
            hasReport: false,
            faceScanCompletedAt: new Date(now - 2000),
            analysisStartedAt: new Date(now - 1000),
            now,
        })).toBe("text_analyzing");
    });

    it("免费重试进行中优先 text_analyzing，过期后回落 completed", () => {
        const completedAt = new Date(now - 10 * 60 * 1000);
        const analysisStartedAt = new Date(now - 1000);
        expect(deriveSessionPhase({
            hasReport: true,
            completedAt,
            analysisStartedAt,
            retryInProgress: true,
            retryStale: false,
            now,
        })).toBe("text_analyzing");
        expect(deriveSessionPhase({
            hasReport: true,
            completedAt,
            analysisStartedAt,
            retryInProgress: true,
            retryStale: true,
            now,
        })).toBe("completed");
    });
});

describe("phaseToStatus", () => {
    it("映射为兼容旧客户端的 status", () => {
        expect(phaseToStatus("completed")).toBe("completed");
        expect(phaseToStatus("face_analyzing")).toBe("analyzing");
        expect(phaseToStatus("text_analyzing")).toBe("analyzing");
        expect(phaseToStatus("face_completed")).toBe("pending");
        expect(phaseToStatus("pending")).toBe("pending");
    });
});
