/**
 * AdvisorSession.analysisResult 轻量摘要抽取
 *
 * 历史列表 / 管理端用户概览共用，避免两处对结果 JSON 的字段口径漂移。
 * 只读取分数、肤质标签与 persona，不触碰问卷、图片等敏感内容。
 */
export interface SessionLite {
    score: number | null;
    typeLabel: string | null;
    persona: string | null;
}

export function extractSessionLite(analysisResult: unknown): SessionLite {
    const result = analysisResult as Record<string, unknown> | null | undefined;
    const face = (result?.faceAnalysis ?? null) as { overallScore?: unknown } | null | undefined;
    const skinProfile = (result?.skinProfile ?? null) as { typeLabel?: unknown } | null | undefined;
    const skinAnalysis = (result?.skinAnalysis ?? null) as { typeLabel?: unknown } | null | undefined;

    return {
        score: typeof face?.overallScore === "number" ? face.overallScore : null,
        typeLabel:
            typeof skinProfile?.typeLabel === "string"
                ? skinProfile.typeLabel
                : typeof skinAnalysis?.typeLabel === "string"
                  ? skinAnalysis.typeLabel
                  : null,
        persona: typeof result?.persona === "string" ? result.persona : null,
    };
}
