/**
 * ReportV3 编译器：把 AI/规则生成的顾问叙述 + 确定性证据/行动组装成跨端领域模型。
 *
 * Phase 2 采用“渐进式”策略：
 * - AI 成功时，沿用 AI 的问题选择与叙述，但补齐 evidenceRefs、routine、products、safety；
 * - AI 失败时，fallback.ts 已经生成同一 ConsultantReport 结构，编译器无需区分；
 * - 新报告同时保留 v2 顶层字段，保证历史消费方不受影响。
 */

import type { ConsultantReport, FaceAnalysisResult } from "@/lib/advisor-utils";
import { DIMENSION_LABELS } from "@/lib/advisor-labels";
import type { SafetyNotes } from "@/lib/report-safety";
import { buildRoutinePlan } from "@/lib/routine-plan";
import type { ProductPurchaseLink } from "@/lib/product-links";
import type {
    ReportActionStep,
    ReportFinding,
    ReportNarrativeSource,
    ReportProduct,
    ReportV3,
} from "./types";
import { REPORT_SCHEMA_VERSION } from "./types";

export const REPORT_ENGINE_VERSION = "2026-11-12-phase2";

interface CompileProduct {
    id: string;
    name: string;
    category?: string | null;
    image?: string;
    images?: string[] | null;
    price?: string;
    reason?: string;
    description?: string | null;
    keyIngredients?: string[] | null;
    benefits?: string[] | null;
    affiliateLinks?: Record<string, string> | null;
    purchaseLinks?: ProductPurchaseLink[] | null;
    origin?: string | null;
    capacity?: string | null;
    howToUse?: string | null;
    source?: string;
}

export interface CompileReportV3Input {
    faceAnalysis: FaceAnalysisResult | null;
    consultantReport: ConsultantReport;
    products?: CompileProduct[];
    safetyNotes?: SafetyNotes | null;
    persona?: string;
    narrativeSource: ReportNarrativeSource;
    fallbackReason?: string;
    promptVersion?: string;
    model?: string;
    dataSource?: string;
    analyzedAt?: string;
}

function firstSentence(text?: string): string {
    if (!text) return "";
    const trimmed = text.trim();
    const match = trimmed.match(/^[^。！？!?]{4,80}[。！？!?]?/);
    return (match?.[0] ?? trimmed).slice(0, 90);
}

function buildFindings(
    consultantReport: ConsultantReport,
    faceAnalysis: FaceAnalysisResult | null
): ReportFinding[] {
    const dims = faceAnalysis?.dimensions;
    return consultantReport.issues.slice(0, 3).map((issue, index) => {
        const related = issue.relatedDimensions ?? [];
        const evidenceRefs = related.map((key) => ({
            type: "dimension" as const,
            key,
            label: DIMENSION_LABELS[key] || key,
            score: typeof dims?.[key]?.score === "number" ? Math.round(dims[key]!.score as number) : undefined,
        }));
        return {
            id: `issue-${index + 1}`,
            title: issue.title,
            severity: issue.severity,
            score: evidenceRefs.find((ref) => typeof ref.score === "number")?.score,
            evidenceRefs,
            narrative: {
                observation: issue.observation,
                directCauses: issue.directCauses,
                indirectCauses: issue.indirectCauses,
                skincarePlan: issue.skincarePlan,
                lifestylePlan: issue.lifestylePlan,
                medicalBoundary: issue.medicalBoundary,
            },
        };
    });
}

function toReportProducts(products: CompileProduct[]): ReportProduct[] {
    return products.map((product) => ({
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
    }));
}

function toRoutine(
    persona: string | undefined,
    products: CompileProduct[] | undefined,
    routineNote?: string
): ReportV3["routine"] {
    const plan = buildRoutinePlan({ persona, products: products ?? [] });
    if (!plan) return null;
    const toSteps = (steps: typeof plan.morning): ReportActionStep[] => steps.map((step) => ({
        text: step.text,
        productId: step.productId,
        productName: step.productName,
        category: step.category,
        howToUse: step.howToUse,
    }));
    return {
        morning: toSteps(plan.morning),
        night: toSteps(plan.night),
        note: plan.note,
        formulaCore: plan.formulaCore,
        onlyOneSet: plan.onlyOneSet,
        routineNote,
    };
}

function buildNext(faceAnalysis: FaceAnalysisResult | null): ReportV3["next"] {
    const focus = Object.entries(faceAnalysis?.dimensions ?? {})
        .filter(([, dim]) => typeof dim?.score === "number" && dim.notVisible !== true)
        .sort((a, b) => (a[1]!.score as number) - (b[1]!.score as number))
        .slice(0, 2)
        .map(([key]) => DIMENSION_LABELS[key] || key);
    return { retestFocus: focus, retestInDays: 28 };
}

export function compileReportV3({
    faceAnalysis,
    consultantReport,
    products = [],
    safetyNotes = null,
    persona,
    narrativeSource,
    fallbackReason,
    promptVersion,
    model,
    dataSource,
    analyzedAt,
}: CompileReportV3Input): ReportV3 {
    const findings = buildFindings(consultantReport, faceAnalysis);
    const topIssue = consultantReport.issues[0];
    const nextStep = consultantReport.routineNote
        || (topIssue?.skincarePlan ? firstSentence(topIssue.skincarePlan) : undefined)
        || "先按每日方案完成基础清洁、保湿与防晒，4 周后复测对比。";

    return {
        schemaVersion: REPORT_SCHEMA_VERSION,
        engineVersion: REPORT_ENGINE_VERSION,
        narrativeSource,
        meta: {
            schemaVersion: REPORT_SCHEMA_VERSION,
            engineVersion: REPORT_ENGINE_VERSION,
            narrativeSource,
            analyzedAt,
            promptVersion,
            model,
            dataSource,
            fallbackReason,
        },
        summary: {
            overview: consultantReport.overview,
            strengths: consultantReport.strengths,
            topFindingIds: findings.slice(0, 1).map((finding) => finding.id),
            nextStep,
        },
        findings,
        routine: toRoutine(persona, products, consultantReport.routineNote),
        products: toReportProducts(products),
        safety: safetyNotes,
        next: buildNext(faceAnalysis),
    };
}
