/**
 * 测肤会话阶段（纯函数），供 session/status、恢复流程与测试共用。
 *
 * 阶段顺序：pending → face_analyzing → face_completed → text_analyzing → completed
 * 旧客户端仍可只读 status（pending/analyzing/completed），新客户端用 phase 决定是否续跑文本分析。
 */

export type SessionPhase =
    | "pending"
    | "face_analyzing"
    | "face_completed"
    | "text_analyzing"
    | "completed";

export interface SessionPhaseInput {
    faceScanStartedAt?: Date | string | null;
    faceScanCompletedAt?: Date | string | null;
    analysisStartedAt?: Date | string | null;
    completedAt?: Date | string | null;
    /** analysisResult 是否已是完整报告 */
    hasReport: boolean;
    /** 免费重试：completedAt 保留旧报告，analysisStartedAt 表示本次重试进行中 */
    retryInProgress?: boolean;
    retryStale?: boolean;
    now?: number;
    /** 扫脸/文本僵尸阈值，默认 5 分钟 */
    staleMs?: number;
}

function toMs(value: Date | string | null | undefined): number | null {
    if (!value) return null;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}

export function deriveSessionPhase(input: SessionPhaseInput): SessionPhase {
    const now = input.now ?? Date.now();
    const staleMs = input.staleMs ?? 5 * 60 * 1000;

    if (input.hasReport && (!input.retryInProgress || input.retryStale)) {
        return "completed";
    }

    if (input.analysisStartedAt && (!input.completedAt || input.retryInProgress)) {
        return "text_analyzing";
    }

    if (input.faceScanCompletedAt) {
        return "face_completed";
    }

    const faceStartedAt = toMs(input.faceScanStartedAt);
    if (faceStartedAt !== null && now - faceStartedAt <= staleMs) {
        return "face_analyzing";
    }

    return "pending";
}

export function phaseToStatus(phase: SessionPhase): "pending" | "analyzing" | "completed" {
    if (phase === "completed") return "completed";
    if (phase === "face_analyzing" || phase === "text_analyzing") return "analyzing";
    return "pending";
}
