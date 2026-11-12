/**
 * 确定性诊断引擎（ReportV3 Phase 2）。
 *
 * 目标：把“报告哪些问题、严重度、证据”从 AI 手中收回到规则层。
 * - 视觉十维 + 六区域 + 用户关注点 → 0-3 个 findings；
 * - 每个 finding 带 evidenceRefs，后续 AI 只能围绕这些证据写文案；
 * - AI 失败时，fallback narrative 直接消费同一份 findings。
 */

import type { FaceAnalysisResult, QuestionnaireAnswers, ZoneData } from "@/lib/advisor-utils";
import { DIMENSION_LABELS } from "@/lib/advisor-labels";
import type { ReportEvidenceRef, ReportFinding } from "./types";

const ZONE_LABELS: Record<string, string> = {
    forehead: "额头区域",
    tZone: "T字区域",
    leftCheek: "左脸颊",
    rightCheek: "右脸颊",
    eyeArea: "眼周",
    jawline: "下颌线",
};

type ZoneScoreKey = "oil" | "texture" | "wrinkles" | "spots" | "redness" | "darkCircles" | "firmness" | "contour";

const ZONE_SCORE_LABELS: Record<ZoneScoreKey, string> = {
    oil: "水油",
    texture: "细腻度",
    wrinkles: "无纹度",
    spots: "无斑度",
    redness: "无泛红",
    darkCircles: "眼周",
    firmness: "紧致度",
    contour: "轮廓",
};

const SCORE_KEY_BY_DIMENSION: Record<string, ZoneScoreKey | null> = {
    waterOil: "oil",
    skinTone: "texture",
    spots: "spots",
    wrinkles: "wrinkles",
    uvDamage: "spots",
    sensitivity: "redness",
    darkCircles: "darkCircles",
    firmness: "firmness",
    acne: "oil",
    radiance: "texture",
};

const CONCERN_TO_DIMENSIONS: Record<string, string[]> = {
    aging: ["wrinkles", "firmness"],
    acne: ["acne", "waterOil"],
    spots: ["spots", "skinTone"],
    dryness: ["waterOil"],
    sensitivity: ["sensitivity"],
    dark_circles: ["darkCircles"],
    // identifyConcerns 的派生 key 兼容
    anti_aging: ["wrinkles", "firmness"],
    fine_lines: ["wrinkles"],
    dullness: ["radiance", "skinTone"],
    pigmentation: ["spots", "skinTone"],
    hydration: ["waterOil"],
    oil_control: ["waterOil", "acne"],
    dark_circles_concern: ["darkCircles"],
};

export interface DiagnosisInput {
    faceAnalysis: FaceAnalysisResult | null;
    answers?: QuestionnaireAnswers | Record<string, unknown> | null;
}

export interface DiagnosisResult {
    findings: ReportFinding[];
    concernDimensions: string[];
}

function toScore(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(100, Math.max(0, Math.round(value)))
        : undefined;
}

function normalizeConcerns(answers: Record<string, unknown> | null | undefined): string[] {
    const raw = answers?.primaryConcern;
    if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
    if (typeof raw === "string") return [raw];
    return [];
}

function severityFor(score: number): ReportFinding["severity"] {
    if (score < 40) return "severe";
    if (score < 55) return "moderate";
    return "mild";
}

function concernDimensionsFor(concerns: string[]): Set<string> {
    const out = new Set<string>();
    for (const concern of concerns) {
        for (const dimension of CONCERN_TO_DIMENSIONS[concern] || []) out.add(dimension);
    }
    return out;
}

function zoneEvidence(
    faceAnalysis: FaceAnalysisResult,
    dimensionKey: string
): ReportEvidenceRef[] {
    const zones = faceAnalysis.zoneAnalysis;
    const scoreKey = SCORE_KEY_BY_DIMENSION[dimensionKey];
    if (!zones || !scoreKey) return [];
    const refs: ReportEvidenceRef[] = [];
    for (const [zoneKey, zone] of Object.entries(zones)) {
        const value = toScore((zone as ZoneData | undefined)?.[scoreKey]);
        if (value === undefined || value >= 70) continue;
        refs.push({
            type: "zone",
            key: zoneKey,
            label: `${ZONE_LABELS[zoneKey] || zoneKey}·${ZONE_SCORE_LABELS[scoreKey]}`,
            score: value,
        });
    }
    return refs.slice(0, 3);
}

export function buildDiagnosis({ faceAnalysis, answers }: DiagnosisInput): DiagnosisResult {
    const dimensions = faceAnalysis?.dimensions;
    if (!dimensions) return { findings: [], concernDimensions: [] };

    const concernList = normalizeConcerns(answers as Record<string, unknown> | null | undefined);
    const concernDimensions = concernDimensionsFor(concernList);
    const candidates: Array<{ finding: ReportFinding; priority: number }> = [];

    for (const [key, dimension] of Object.entries(dimensions)) {
        if (!dimension || dimension.notVisible === true) continue;
        const score = toScore(dimension.score);
        if (score === undefined) continue;
        const confidence = typeof dimension.confidence === "number" ? dimension.confidence : undefined;
        if (confidence !== undefined && confidence < 0.3) continue;

        const isConcerned = concernDimensions.has(key);
        // 70 分以上只有命中用户关注点才进入候选，避免把正常维度写成问题
        if (score >= 70 && !isConcerned) continue;
        if (score >= 80) continue;

        const evidenceRefs: ReportEvidenceRef[] = [
            {
                type: "dimension",
                key,
                label: DIMENSION_LABELS[key] || key,
                score,
            },
            ...zoneEvidence(faceAnalysis!, key),
        ];
        if (isConcerned) {
            evidenceRefs.push({
                type: "questionnaire",
                key: `primaryConcern:${key}`,
                label: "你主动关注的问题",
            });
        }

        candidates.push({
            finding: {
                id: `dimension-${key}`,
                title: buildFindingTitle(key),
                severity: severityFor(score),
                confidence,
                score,
                evidenceRefs,
                narrative: {
                    observation: dimension.details?.trim()
                        || `${DIMENSION_LABELS[key] || key}本次 ${score} 分。`,
                },
            },
            priority: score - (isConcerned ? 8 : 0) - (severityFor(score) === "severe" ? 15 : severityFor(score) === "moderate" ? 8 : 0),
        });
    }

    candidates.sort((a, b) => a.priority - b.priority);
    return {
        findings: candidates.slice(0, 3).map((candidate) => candidate.finding),
        concernDimensions: Array.from(concernDimensions),
    };
}

function buildFindingTitle(key: string): string {
    const label = DIMENSION_LABELS[key] || key;
    const titles: Record<string, string> = {
        waterOil: "水油平衡需要调整",
        skinTone: "肤色均匀度不足",
        spots: "色斑/色素沉着倾向",
        wrinkles: "细纹/皱纹需要关注",
        uvDamage: "光老化迹象",
        sensitivity: "屏障偏弱/易泛红",
        darkCircles: "眼周暗沉/黑眼圈",
        firmness: "皮肤弹性下降",
        acne: "粉刺/痘痘倾向",
        radiance: "光泽度不足",
    };
    return titles[key] || `${label}需要关注`;
}

/** У�� AI �����Ƿ񸲸ǹ�����ϣ���һ��ʱ�� analyze ·�ɽ���Ϊ���򱨸� */
export function narrativeMatchesDiagnosis(
    report: { issues: Array<{ relatedDimensions?: string[] }> },
    diagnosis: DiagnosisResult
): boolean {
    if (diagnosis.findings.length === 0) return report.issues.length === 0;
    if (report.issues.length === 0) return false;
    const covered = new Set(report.issues.flatMap((issue) => issue.relatedDimensions || []));
    return diagnosis.findings.every((finding) => {
        const dimensions = finding.evidenceRefs
            .filter((ref) => ref.type === "dimension")
            .map((ref) => ref.key);
        return dimensions.length === 0 || dimensions.some((key) => covered.has(key));
    });
}
