/**
 * SkinAssessment 汇总构建器：从完整报告快照提取趋势/统计所需字段。
 *
 * - analyze 成功时写入（在线）；
 * - scripts/backfill-skin-assessments.ts 用同一函数回填历史报告；
 * - 只存分数/覆盖率/问题标签，不复制完整叙述，控制表体积。
 */

import type { FaceAnalysisResult, SkinCondition, ZoneData } from "@/lib/advisor-utils";
import type { ComprehensiveResult } from "@/lib/analysis-result";
import { normalizeAnalysisResult } from "@/lib/analysis-result";
import { DIMENSION_LABELS } from "@/lib/advisor-labels";

const ZONE_NUMERIC_KEYS = ["oil", "texture", "wrinkles", "spots", "redness", "darkCircles", "firmness", "contour"] as const;

export interface SkinAssessmentDimension {
    score: number | null;
    grade?: string;
    confidence?: number;
    notVisible?: boolean;
    blackheads?: number;
    pimples?: number;
}

export interface SkinAssessmentFinding {
    id: string;
    title: string;
    severity: "mild" | "moderate" | "severe";
    score?: number;
    relatedDimensions: string[];
}

export interface SkinAssessmentData {
    sessionId: string;
    userId: string;
    completedAt: Date;
    overallScore: number | null;
    skinAge: number | null;
    skinType: string | null;
    skinTypeLabel: string | null;
    persona: string | null;
    coverageScored: number;
    coverageTotal: number;
    lowConfidence: string[];
    notVisible: string[];
    dimensions: Record<string, SkinAssessmentDimension>;
    zones: Record<string, Record<string, number | null>>;
    conditions: Array<{
        condition: string;
        severity: string;
        area?: string;
        description?: string;
    }>;
    findings: SkinAssessmentFinding[];
    promptVersion: string | null;
    engineVersion: string | null;
    model: string | null;
    dataSource: string | null;
}

function toFiniteScore(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.min(100, Math.max(0, Math.round(value)));
}

function buildDimensions(faceAnalysis: FaceAnalysisResult | null): Record<string, SkinAssessmentDimension> {
    const dims = faceAnalysis?.dimensions;
    if (!dims) return {};
    const out: Record<string, SkinAssessmentDimension> = {};
    for (const [key, dim] of Object.entries(dims)) {
        if (!dim) continue;
        out[key] = {
            score: toFiniteScore(dim.score),
            grade: dim.grade,
            confidence: typeof dim.confidence === "number" ? dim.confidence : undefined,
            notVisible: dim.notVisible === true || undefined,
            blackheads: toFiniteScore(dim.blackheads) ?? undefined,
            pimples: toFiniteScore(dim.pimples) ?? undefined,
        };
    }
    return out;
}

function buildZones(faceAnalysis: FaceAnalysisResult | null): Record<string, Record<string, number | null>> {
    const zones = faceAnalysis?.zoneAnalysis;
    if (!zones) return {};
    const out: Record<string, Record<string, number | null>> = {};
    for (const [zoneKey, zone] of Object.entries(zones)) {
        const data = zone as ZoneData | undefined;
        const scores: Record<string, number | null> = {};
        for (const key of ZONE_NUMERIC_KEYS) {
            scores[key] = toFiniteScore(data?.[key]);
        }
        out[zoneKey] = scores;
    }
    return out;
}

function buildConditions(faceAnalysis: FaceAnalysisResult | null): SkinAssessmentData["conditions"] {
    const conditions = faceAnalysis?.skinConditions;
    if (!Array.isArray(conditions)) return [];
    return conditions.map((condition: SkinCondition) => ({
        condition: condition.condition,
        severity: condition.severity,
        area: condition.area,
        description: condition.description,
    }));
}

function buildFindings(result: ComprehensiveResult): SkinAssessmentFinding[] {
    const v3 = result.reportV3;
    if (v3?.findings?.length) {
        return v3.findings.map((finding) => ({
            id: finding.id,
            title: finding.title,
            severity: finding.severity,
            score: finding.score,
            relatedDimensions: finding.evidenceRefs
                .filter((ref) => ref.type === "dimension")
                .map((ref) => ref.key),
        }));
    }
    return (result.consultantReport?.issues ?? []).map((issue, index) => ({
        id: `issue-${index + 1}`,
        title: issue.title,
        severity: issue.severity,
        relatedDimensions: issue.relatedDimensions ?? [],
    }));
}

export interface BuildSkinAssessmentInput {
    sessionId: string;
    userId: string;
    completedAt: Date;
    rawResult: unknown;
    faceAnalysis: FaceAnalysisResult | null;
}

export function buildSkinAssessment({
    sessionId,
    userId,
    completedAt,
    rawResult,
    faceAnalysis,
}: BuildSkinAssessmentInput): SkinAssessmentData | null {
    const result = normalizeAnalysisResult(rawResult);
    if (!result) return null;

    const raw = (rawResult && typeof rawResult === "object" ? rawResult : {}) as Record<string, unknown>;
    const scoring = faceAnalysis?.scoring;
    const dimensions = buildDimensions(faceAnalysis);
    const validDimensions = Object.values(dimensions).filter((dim) => dim.score !== null && !dim.notVisible);
    const coverageScored = scoring?.scoredDimensions ?? validDimensions.length;
    const coverageTotal = scoring?.totalDimensions ?? 10;
    const lowConfidence = scoring?.lowConfidenceDimensions?.map((key) => DIMENSION_LABELS[key] || key)
        ?? Object.entries(dimensions)
            .filter(([, dim]) => typeof dim.confidence === "number" && dim.confidence < 0.5)
            .map(([key]) => DIMENSION_LABELS[key] || key);
    const notVisible = scoring?.notVisibleDimensions?.map((key) => DIMENSION_LABELS[key] || key)
        ?? Object.entries(dimensions)
            .filter(([, dim]) => dim.notVisible)
            .map(([key]) => DIMENSION_LABELS[key] || key);

    return {
        sessionId,
        userId,
        completedAt,
        overallScore: toFiniteScore(faceAnalysis?.overallScore),
        skinAge: result.skinProfile.skinAge ?? faceAnalysis?.skinAge?.estimated ?? null,
        skinType: result.skinProfile.type || null,
        skinTypeLabel: result.skinProfile.typeLabel || null,
        persona: result.persona || null,
        coverageScored,
        coverageTotal,
        lowConfidence,
        notVisible,
        dimensions,
        zones: buildZones(faceAnalysis),
        conditions: buildConditions(faceAnalysis),
        findings: buildFindings(result),
        promptVersion: typeof raw.promptVersion === "string" ? raw.promptVersion : null,
        engineVersion: result.reportV3?.engineVersion ?? null,
        model: result.reportV3?.meta.model ?? null,
        dataSource: result.dataSource || null,
    };
}
