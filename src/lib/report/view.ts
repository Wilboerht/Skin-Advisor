/**
 * 把任意版本的报告快照投影成跨端统一的 ReportView。
 *
 * - v3：优先使用 reportV3（诊断/方案/产品/安全均为结构化数据）；
 * - v2：从 consultantReport + faceAnalysis + products + safetyNotes 适配；
 * - v1：保留最小可用信息，保证历史报告不白屏。
 *
 * 该模块不访问数据库，也不依赖 React，可同时被 H5、API、小程序契约测试复用。
 */

import type { FaceAnalysisResult, ZoneData } from "@/lib/advisor-utils";
import type { ComprehensiveResult } from "@/lib/analysis-result";
import { DIMENSION_LABELS, DIMENSION_ORDER } from "@/lib/advisor-labels";
import { buildRoutinePlan } from "@/lib/routine-plan";
import { getScoreBandLabel, isAttentionScore } from "@/lib/score-bands";
import type { ReportProduct, ReportSeverity, ReportV3, ReportView, ReportViewDimension, ReportViewFinding, ReportViewSummaryCard, ReportViewZone } from "./types";
import { REPORT_VIEW_VERSION } from "./types";

const ZONE_LABELS: Record<string, string> = {
    forehead: "额头区域",
    tZone: "T字区域",
    leftCheek: "左脸颊",
    rightCheek: "右脸颊",
    eyeArea: "眼周",
    jawline: "下颌线",
};

const ZONE_ORDER = ["forehead", "tZone", "leftCheek", "rightCheek", "eyeArea", "jawline"] as const;

const ZONE_SCORE_KEYS = ["oil", "texture", "wrinkles", "spots", "redness", "darkCircles", "firmness", "contour"] as const;

const ZONE_SCORE_LABELS: Record<(typeof ZONE_SCORE_KEYS)[number], string> = {
    oil: "水油",
    texture: "细腻度",
    wrinkles: "无纹度",
    spots: "无斑度",
    redness: "无泛红",
    darkCircles: "眼周",
    firmness: "紧致度",
    contour: "轮廓",
};

const SEVERITY_LABELS: Record<"mild" | "moderate" | "severe", string> = {
    mild: "轻度",
    moderate: "中度",
    severe: "重度",
};

function firstSentence(text?: string): string {
    if (!text) return "";
    const trimmed = text.trim();
    const match = trimmed.match(/^[^。！？!?]{4,80}[。！？!?]?/);
    return (match?.[0] ?? trimmed).slice(0, 90);
}

function toScore(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}

function buildDimensions(faceAnalysis: FaceAnalysisResult | null): ReportViewDimension[] {
    const dims = faceAnalysis?.dimensions;
    if (!dims) return [];
    const keys = DIMENSION_ORDER.filter((key) => dims[key]);
    for (const key of Object.keys(dims)) {
        if (!keys.includes(key as (typeof DIMENSION_ORDER)[number])) keys.push(key as (typeof DIMENSION_ORDER)[number]);
    }
    return keys.map((key) => {
        const dim = dims[key];
        const score = toScore(dim?.score);
        const confidence = typeof dim?.confidence === "number" ? dim.confidence : undefined;
        return {
            key,
            label: DIMENSION_LABELS[key] || key,
            score,
            grade: dim?.grade,
            gradeLabel: score !== undefined ? getScoreBandLabel(score) : dim?.grade,
            details: typeof dim?.details === "string" && dim.details.trim() ? dim.details.trim() : undefined,
            confidence,
            lowConfidence: confidence !== undefined && confidence < 0.5,
            notVisible: dim?.notVisible === true,
            blackheads: toScore(dim?.blackheads),
            pimples: toScore(dim?.pimples),
        };
    });
}

function buildZones(faceAnalysis: FaceAnalysisResult | null): ReportViewZone[] {
    const zones = faceAnalysis?.zoneAnalysis;
    if (!zones) return [];
    const keys: string[] = [...ZONE_ORDER];
    for (const key of Object.keys(zones)) {
        if (!keys.includes(key)) keys.push(key);
    }
    return keys.map((key) => {
        const zone = zones[key as keyof typeof zones] as ZoneData | undefined;
        const scores = ZONE_SCORE_KEYS
            .map((scoreKey) => {
                const value = toScore(zone?.[scoreKey]);
                return value === undefined ? null : {
                    key: scoreKey,
                    label: ZONE_SCORE_LABELS[scoreKey],
                    value,
                };
            })
            .filter((item): item is { key: (typeof ZONE_SCORE_KEYS)[number]; label: string; value: number } => item !== null);
        const needsAttention = scores.some((item) => isAttentionScore(item.value)) || !!zone?.condition?.trim();
        return {
            key,
            label: ZONE_LABELS[key] || key,
            condition: typeof zone?.condition === "string" && zone.condition.trim() ? zone.condition.trim() : undefined,
            advice: typeof zone?.advice === "string" && zone.advice.trim() ? zone.advice.trim() : undefined,
            scores,
            needsAttention,
        };
    });
}

function buildFindings(
    result: ComprehensiveResult,
    reportV3: ReportV3 | undefined
): ReportViewFinding[] {
    if (reportV3?.findings?.length) {
        return reportV3.findings.map((finding) => ({
            id: finding.id,
            title: finding.title,
            severity: finding.severity,
            severityLabel: SEVERITY_LABELS[finding.severity] ?? finding.severity,
            confidence: finding.confidence,
            score: finding.score,
            observation: finding.narrative.observation || "",
            directCauses: finding.narrative.directCauses,
            indirectCauses: finding.narrative.indirectCauses,
            skincarePlan: finding.narrative.skincarePlan,
            lifestylePlan: finding.narrative.lifestylePlan,
            medicalBoundary: finding.narrative.medicalBoundary,
            evidence: finding.evidenceRefs.map((ref) => ({
                type: ref.type,
                key: ref.key,
                label: ref.label || ref.key,
                score: ref.score,
            })),
        }));
    }

    const issues = result.consultantReport?.issues ?? [];
    return issues.map((issue, index) => {
        // 分数由 buildReportView 统一从 faceAnalysis 回填，避免这里重复解析
        const evidence = (issue.relatedDimensions ?? []).map((key) => ({
            type: "dimension" as const,
            key,
            label: DIMENSION_LABELS[key] || key,
            score: undefined,
        }));
        return {
            id: `issue-${index + 1}`,
            title: issue.title,
            severity: issue.severity,
            severityLabel: SEVERITY_LABELS[issue.severity] ?? issue.severity,
            observation: issue.observation || "",
            directCauses: issue.directCauses,
            indirectCauses: issue.indirectCauses,
            skincarePlan: issue.skincarePlan,
            lifestylePlan: issue.lifestylePlan,
            medicalBoundary: issue.medicalBoundary,
            evidence,
        };
    });
}

function buildProducts(result: ComprehensiveResult, reportV3: ReportV3 | undefined): ReportProduct[] {
    const source = reportV3?.products?.length ? reportV3.products : result.products ?? [];
    return source.map((product) => ({
        id: String(product.id),
        name: product.name,
        category: product.category ?? null,
        image: product.image,
        images: product.images ?? null,
        price: product.price,
        reason: product.reason,
        description: product.description ?? null,
        keyIngredients: product.keyIngredients ?? [],
        benefits: product.benefits ?? [],
        affiliateLinks: product.affiliateLinks ?? null,
        purchaseLinks: product.purchaseLinks ?? null,
        origin: product.origin ?? null,
        capacity: product.capacity ?? null,
        howToUse: product.howToUse ?? null,
        source: product.source,
        findingId: (product as { findingId?: string }).findingId,
        step: (product as { step?: string }).step,
    }));
}

function buildNext(faceAnalysis: FaceAnalysisResult | null): { retestFocus: string[]; retestInDays: number } {
    const focus = Object.entries(faceAnalysis?.dimensions ?? {})
        .filter(([, dim]) => typeof dim?.score === "number" && dim.notVisible !== true)
        .sort((a, b) => (a[1]!.score as number) - (b[1]!.score as number))
        .slice(0, 2)
        .map(([key]) => DIMENSION_LABELS[key] || key);
    return { retestFocus: focus, retestInDays: 28 };
}

export interface BuildReportViewInput {
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
    sessionId?: string;
}

export function buildReportSummaryCard({
    result,
    faceAnalysis,
    sessionId,
    completedAt,
}: BuildReportViewInput & { completedAt?: string }): ReportViewSummaryCard {
    const reportV3 = result.reportV3;
    const firstFinding = reportV3?.findings?.[0];
    const firstIssue = result.consultantReport?.issues?.[0];
    const rawSeverity = firstFinding?.severity ?? firstIssue?.severity;
    const severity: ReportSeverity = rawSeverity === "moderate" || rawSeverity === "severe"
        ? rawSeverity
        : "mild";
    const topTitle = firstFinding?.title ?? firstIssue?.title;

    return {
        sessionId: sessionId ?? "",
        completedAt,
        overallScore: faceAnalysis?.overallScore,
        skinTypeLabel: result.skinProfile.typeLabel,
        skinAge: result.skinProfile.skinAge ?? faceAnalysis?.skinAge?.estimated,
        persona: result.persona,
        reportVersion: typeof result.reportVersion === "number"
            ? result.reportVersion
            : (reportV3 ? 3 : result.consultantReport ? 2 : 1),
        viewVersion: REPORT_VIEW_VERSION,
        ...(topTitle ? {
            topFinding: {
                title: topTitle,
                severity,
                severityLabel: SEVERITY_LABELS[severity],
            },
        } : {}),
    };
}

export function buildReportView({ result, faceAnalysis, sessionId }: BuildReportViewInput): ReportView {
    const reportV3 = result.reportV3;
    const dimensions = buildDimensions(faceAnalysis);
    const findings = buildFindings(result, reportV3);

    // v2 finding 的 relatedDimensions 需要从 faceAnalysis 回填分数；v3 已自带 evidenceRefs
    if (!reportV3) {
        findings.forEach((finding) => {
            finding.evidence = finding.evidence.map((ref) => {
                const dim = dimensions.find((item) => item.key === ref.key);
                return dim ? { ...ref, label: dim.label, score: dim.score } : ref;
            });
        });
    }

    const routinePlan = reportV3?.routine
        ? reportV3.routine
        : (() => {
            const plan = buildRoutinePlan({ persona: result.persona, products: result.products });
            if (!plan) return null;
            return {
                morning: plan.morning.map((step) => ({
                    text: step.text,
                    productId: step.productId,
                    productName: step.productName,
                    category: step.category,
                    howToUse: step.howToUse,
                })),
                night: plan.night.map((step) => ({
                    text: step.text,
                    productId: step.productId,
                    productName: step.productName,
                    category: step.category,
                    howToUse: step.howToUse,
                })),
                note: plan.note,
                formulaCore: plan.formulaCore,
                onlyOneSet: plan.onlyOneSet,
                routineNote: result.consultantReport?.routineNote,
            };
        })();

    const topIssue = result.consultantReport?.issues?.[0];
    const topFinding = findings[0] ?? (topIssue ? {
        id: "issue-1",
        title: topIssue.title,
        severity: topIssue.severity,
        severityLabel: SEVERITY_LABELS[topIssue.severity] ?? topIssue.severity,
        observation: topIssue.observation || "",
        evidence: [],
    } : undefined);

    const scoring = faceAnalysis?.scoring;
    const coverage = scoring ? {
        scored: scoring.scoredDimensions,
        total: scoring.totalDimensions,
        lowConfidence: scoring.lowConfidenceDimensions.map((key) => DIMENSION_LABELS[key] || key),
        notVisible: scoring.notVisibleDimensions.map((key) => DIMENSION_LABELS[key] || key),
    } : undefined;

    return {
        meta: {
            sessionId,
            reportVersion: typeof result.reportVersion === "number"
                ? result.reportVersion
                : (reportV3 ? 3 : result.consultantReport ? 2 : 1),
            viewVersion: REPORT_VIEW_VERSION,
            analyzedAt: result.analyzedAt,
            dataSource: result.dataSource,
            nickname: result.nickname,
            persona: result.persona,
            skinTypeLabel: result.skinProfile.typeLabel,
            skinAge: result.skinProfile.skinAge ?? faceAnalysis?.skinAge?.estimated,
            skinAgeRange: faceAnalysis?.skinAge?.range,
            overallScore: faceAnalysis?.overallScore,
            skinState: result.skinState,
            gender: faceAnalysis?.gender?.value,
            coverage,
            narrativeSource: reportV3?.narrativeSource ?? (result.consultantReport ? "ai" : undefined),
            validationMessage: faceAnalysis?.validation && faceAnalysis.validation.isValid === false
                ? faceAnalysis.validation.message
                : undefined,
        },
        summary: {
            overview: reportV3?.summary.overview
                || result.consultantReport?.overview
                || result.analysis.summary
                || "本次报告已生成，请查看下方详细分析。",
            topFinding: topFinding ? {
                id: topFinding.id,
                title: topFinding.title,
                severity: topFinding.severity,
                severityLabel: topFinding.severityLabel,
                observation: topFinding.observation,
            } : undefined,
            strengths: reportV3?.summary.strengths?.length
                ? reportV3.summary.strengths
                : result.consultantReport?.strengths ?? [],
            nextStep: reportV3?.summary.nextStep
                || result.consultantReport?.routineNote
                || (topIssue?.skincarePlan ? firstSentence(topIssue.skincarePlan) : undefined)
                || "先按每日方案完成基础清洁、保湿与防晒，4 周后复测对比。",
        },
        dimensions,
        zones: buildZones(faceAnalysis),
        conditions: (faceAnalysis?.skinConditions ?? []).map((condition) => ({
            condition: condition.condition,
            severity: (condition.severity === "moderate" || condition.severity === "severe") ? condition.severity : "mild",
            severityLabel: SEVERITY_LABELS[(condition.severity === "moderate" || condition.severity === "severe") ? condition.severity : "mild"],
            area: condition.area,
            description: condition.description,
        })),
        findings,
        routine: routinePlan,
        products: buildProducts(result, reportV3),
        safety: reportV3?.safety ?? result.safetyNotes ?? null,
        next: reportV3?.next ?? buildNext(faceAnalysis),
        legacy: !reportV3,
    };
}
