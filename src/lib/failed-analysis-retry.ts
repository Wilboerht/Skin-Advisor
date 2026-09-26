/**
 * 失败分析会话的免费重试记录（v2-only）。
 *
 * 服务端失败时会保留 TestRecord 并清理 analysisStartedAt，同 sessionId 重试命中幂等预占、
 * 不再额外扣次。为避免"用户改了问卷 / 开始全新测试也被旧失败会话免费劫持"，记录中带
 * 问卷指纹：只有指纹一致（同一份问卷的重试）才复用 sessionId，指纹不一致视为新测试，
 * 走正常预占与扣次。
 */

export const FAILED_ANALYSIS_RETRY_TTL_MS = 30 * 60 * 1000;

export interface FailedAnalysisRetry {
    sessionId: string;
    startedAt: number;
    /** 问卷原始 JSON 的指纹（djb2），仅用于本地判断"同一次测试的重试" */
    fingerprint: string;
}

/** djb2 字符串指纹（非加密用途，仅本地一致性判断） */
export function fingerprintAnswers(answersRaw: string): string {
    let hash = 5381;
    for (let i = 0; i < answersRaw.length; i++) {
        hash = ((hash << 5) + hash + answersRaw.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
}

export function serializeFailedAnalysisRetry(record: FailedAnalysisRetry): string {
    return JSON.stringify(record);
}

/**
 * 解析并校验暂存记录：
 * - 过期（默认 30 分钟）、字段缺失/类型不对、JSON 损坏 → null；
 * - 旧版本无 fingerprint 的记录也视为 null（宁可让用户正常重测，不复用不明来源的会话）。
 */
export function parseFailedAnalysisRetry(
    raw: string | null | undefined,
    now = Date.now()
): FailedAnalysisRetry | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<FailedAnalysisRetry>;
        if (!parsed || typeof parsed.sessionId !== "string" || !parsed.sessionId) return null;
        if (typeof parsed.startedAt !== "number" || !Number.isFinite(parsed.startedAt)) return null;
        if (typeof parsed.fingerprint !== "string" || !parsed.fingerprint) return null;
        if (now - parsed.startedAt >= FAILED_ANALYSIS_RETRY_TTL_MS) return null;
        return {
            sessionId: parsed.sessionId,
            startedAt: parsed.startedAt,
            fingerprint: parsed.fingerprint,
        };
    } catch {
        return null;
    }
}

/** 仅当本次问卷与失败时一致时才允许复用（免费重试） */
export function canReuseFailedAnalysis(
    record: FailedAnalysisRetry | null,
    answersFingerprint: string
): boolean {
    return !!record && !!answersFingerprint && record.fingerprint === answersFingerprint;
}
