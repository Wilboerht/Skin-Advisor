/**
 * 内部接口：从会话 analysisResult 快照中提取报告摘要
 * 供企业微信 AI 客服（wecom-ai-bot）通过 x-internal-key 调用，
 * 仅返回护肤档案所需的少量字段，不暴露人脸图片等敏感数据。
 */
import { normalizeAnalysisResult } from "@/lib/analysis-result";
import { getRankPercentile } from "@/lib/result-utils";
import { getIssueList, type ReportIssue } from "@/lib/advisor-report-text";
import { getSkinTypeLabel } from "@/lib/advisor-utils";

export interface ReportSummary {
    found: boolean;
    sessionId?: string;
    nickname?: string;
    gender?: "male" | "female" | null;
    skinType?: string;
    skinTypeLabel?: string;
    skinAge?: number | null;
    overallScore?: number | null;
    percentile?: number | null;
    issues?: ReportIssue[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object") return null;
    return value as Record<string, unknown>;
}

function readGender(
    raw: Record<string, unknown>,
    answers: unknown
): "male" | "female" | null {
    const answersRecord = asRecord(answers);
    const qGender = answersRecord?.gender;
    if (qGender === "male" || qGender === "female") return qGender;

    const faceAnalysis = asRecord(raw.faceAnalysis);
    const aiGender = asRecord(faceAnalysis?.gender);
    const value = aiGender?.value;
    if (value === "male" || value === "female") return value;

    return null;
}

/**
 * 从会话快照提取报告摘要。
 * @param raw analysisResult JSON
 * @param sessionId 会话 ID
 * @param answers 问卷答案 JSON（可选，取问卷性别等）
 */
export function extractReportSummary(
    raw: unknown,
    sessionId: string,
    answers?: unknown
): ReportSummary {
    const record = asRecord(raw);
    const hasProfileData = !!record && !!(record.skinProfile || record.skinAnalysis);
    const result = hasProfileData ? normalizeAnalysisResult(raw) : null;
    const faceAnalysis = record ? asRecord(record.faceAnalysis) : null;

    if (!result && !faceAnalysis) {
        return { found: false };
    }

    const overallScore =
        typeof faceAnalysis?.overallScore === "number" ? faceAnalysis.overallScore : null;

    const faceSkinAge = asRecord(faceAnalysis?.skinAge);
    const skinAge =
        typeof result?.skinProfile.skinAge === "number"
            ? result.skinProfile.skinAge
            : typeof faceSkinAge?.estimated === "number"
              ? faceSkinAge.estimated
              : null;

    const dimensions = faceAnalysis?.dimensions as
        | Record<string, { score?: number } | undefined>
        | undefined;

    return {
        found: true,
        sessionId,
        nickname: typeof record?.nickname === "string" ? record.nickname : undefined,
        gender: readGender(record ?? {}, answers),
        skinType: result?.skinProfile.type,
        skinTypeLabel: result ? getSkinTypeLabel(result.skinProfile.type) : undefined,
        skinAge,
        overallScore,
        percentile:
            overallScore !== null
                ? getRankPercentile(overallScore)
                : null,
        issues: getIssueList(dimensions),
    };
}
