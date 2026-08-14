/**
 * 生成「给护肤顾问的报告摘要」文本
 *
 * 文本按结构化档案格式组织（性别/肌肤年龄/肤质/评分/重点问题），
 * 便于用户一键复制粘贴给微信客服（企业微信护肤顾问），AI 可直接解析为档案。
 */
import { DIMENSION_LABELS, getSkinTypeLabel } from "@/lib/advisor-utils";
import { getRankPercentile } from "@/lib/result-utils";
import type { ComprehensiveResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

/** 护肤顾问微信客服链接（kfid 对应企业微信客服「护肤顾问」账号） */
export const ADVISOR_WECOM_LINK = "https://work.weixin.qq.com/kfid/kfc7834894b7ee2b86a";

const ISSUE_ORDER = [
    "waterOil",
    "skinTone",
    "spots",
    "wrinkles",
    "uvDamage",
    "sensitivity",
    "darkCircles",
    "firmness",
    "acne",
    "radiance",
];

export interface AdvisorReportTextParams {
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
    gender: string;
    nickname?: string;
}

function buildIssueLine(
    faceAnalysis: FaceAnalysisResult | null,
    result: ComprehensiveResult
): string {
    const dimensions = faceAnalysis?.dimensions;
    if (dimensions && Object.keys(dimensions).length > 0) {
        const dims = dimensions as Record<string, { score?: number } | undefined>;
        const problems = ISSUE_ORDER
            .map((key) => ({ key, score: dims[key]?.score }))
            .filter((d): d is { key: string; score: number } => typeof d.score === "number")
            .sort((a, b) => a.score - b.score)
            .filter((d) => d.score < 70)
            .slice(0, 3)
            .map((d) => `${DIMENSION_LABELS[d.key] ?? d.key}（${d.score}分）`);
        if (problems.length > 0) return `重点问题：${problems.join("、")}`;
        return "重点问题：无明显问题";
    }
    const concerns = result.skinProfile.concerns;
    if (concerns && concerns.length > 0) return `重点问题：${concerns.join("、")}`;
    return "";
}

/**
 * 生成可复制的顾问报告摘要文本。
 * 每行一个字段，避免长段落，方便 AI 顾问按字段解析。
 */
export function buildAdvisorReportText({
    result,
    faceAnalysis,
    gender,
    nickname,
}: AdvisorReportTextParams): string {
    const lines: string[] = ["【肌智派测肤报告】"];

    if (nickname && nickname.trim() && nickname.trim() !== "您") {
        lines.push(`昵称：${nickname.trim()}`);
    }
    if (gender) {
        lines.push(`性别：${gender === "male" ? "男" : "女"}`);
    }

    const skinAge = result.skinProfile.skinAge;
    if (typeof skinAge === "number" && !Number.isNaN(skinAge)) {
        lines.push(`肌肤年龄：${skinAge}岁`);
    }

    lines.push(`肤质：${getSkinTypeLabel(result.skinProfile.type)}`);

    const score = faceAnalysis?.overallScore;
    if (typeof score === "number" && !Number.isNaN(score)) {
        lines.push(`素颜评分：${score}分（超越全国${getRankPercentile(score)}%的用户）`);
    }

    const issueLine = buildIssueLine(faceAnalysis, result);
    if (issueLine) lines.push(issueLine);

    return lines.join("\n");
}
