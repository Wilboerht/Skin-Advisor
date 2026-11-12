/**
 * ReportV3 / ReportView 共享类型。
 *
 * 原则：
 * - ReportV3 是“诊断 + 行动 + 叙述”的领域模型，H5、小程序、海报、企微摘要共用；
 * - ReportView 是显示就绪的投影，包含中文标签与分组，供 /reports/:id/view 使用；
 * - 旧 v1/v2 报告不被迁移，通过 view 适配器生成同样的 ReportView。
 */

import type { ProductPurchaseLink } from "@/lib/product-links";
import type { SafetyNotes } from "@/lib/report-safety";

export const REPORT_SCHEMA_VERSION = 3;
export const REPORT_VIEW_VERSION = 1;

export type ReportSeverity = "mild" | "moderate" | "severe";
export type ReportNarrativeSource = "ai" | "fallback";

export interface ReportEvidenceRef {
    type: "dimension" | "zone" | "condition" | "questionnaire";
    key: string;
    label?: string;
    score?: number;
}

export interface ReportFindingNarrative {
    observation: string;
    directCauses?: string;
    indirectCauses?: string;
    skincarePlan?: string;
    lifestylePlan?: string;
    medicalBoundary?: string;
}

export interface ReportFinding {
    id: string;
    title: string;
    severity: ReportSeverity;
    confidence?: number;
    score?: number;
    evidenceRefs: ReportEvidenceRef[];
    narrative: ReportFindingNarrative;
}

export interface ReportActionStep {
    text: string;
    productId?: string;
    productName?: string;
    category?: string;
    howToUse?: string;
}

export interface ReportRoutine {
    morning: ReportActionStep[];
    night: ReportActionStep[];
    note?: string;
    formulaCore?: string;
    onlyOneSet?: string;
    routineNote?: string;
}

export interface ReportProduct {
    id: string;
    name: string;
    category?: string | null;
    image?: string;
    images?: string[] | null;
    price?: string;
    reason?: string;
    description?: string | null;
    keyIngredients?: string[];
    benefits?: string[];
    affiliateLinks?: Record<string, string> | null;
    purchaseLinks?: ProductPurchaseLink[] | null;
    origin?: string | null;
    capacity?: string | null;
    howToUse?: string | null;
    source?: string;
    /** v3：该产品对应的 finding / 护理步骤 */
    findingId?: string;
    step?: string;
}

export interface ReportV3Meta {
    schemaVersion: typeof REPORT_SCHEMA_VERSION;
    engineVersion: string;
    narrativeSource: ReportNarrativeSource;
    analyzedAt?: string;
    promptVersion?: string;
    model?: string;
    dataSource?: string;
    fallbackReason?: string;
}

export interface ReportV3 {
    schemaVersion: typeof REPORT_SCHEMA_VERSION;
    engineVersion: string;
    narrativeSource: ReportNarrativeSource;
    meta: ReportV3Meta;
    summary: {
        overview: string;
        strengths: string[];
        topFindingIds?: string[];
        nextStep?: string;
    };
    findings: ReportFinding[];
    routine: ReportRoutine | null;
    products: ReportProduct[];
    safety: SafetyNotes | null;
    next: {
        retestFocus: string[];
        retestInDays: number;
    };
}

// ---------------------------------------------------------------------------
// ReportView：显示就绪的跨端投影
// ---------------------------------------------------------------------------

export interface ReportViewMeta {
    sessionId?: string;
    reportVersion: number;
    viewVersion: number;
    analyzedAt?: string;
    dataSource?: string;
    nickname?: string;
    persona?: string;
    skinTypeLabel?: string;
    skinAge?: number;
    skinAgeRange?: [number, number];
    overallScore?: number;
    skinState?: string;
    gender?: "male" | "female";
    coverage?: {
        scored: number;
        total: number;
        lowConfidence: string[];
        notVisible: string[];
    };
    narrativeSource?: ReportNarrativeSource;
    validationMessage?: string;
}

export interface ReportViewDimension {
    key: string;
    label: string;
    score?: number;
    grade?: string;
    gradeLabel?: string;
    details?: string;
    confidence?: number;
    lowConfidence: boolean;
    notVisible: boolean;
    blackheads?: number;
    pimples?: number;
}

export interface ReportViewZoneScore {
    key: string;
    label: string;
    value: number;
}

export interface ReportViewZone {
    key: string;
    label: string;
    condition?: string;
    advice?: string;
    scores: ReportViewZoneScore[];
    needsAttention: boolean;
}

export interface ReportViewCondition {
    condition: string;
    severity: ReportSeverity;
    severityLabel: string;
    area?: string;
    description?: string;
}

export interface ReportViewFinding {
    id: string;
    title: string;
    severity: ReportSeverity;
    severityLabel: string;
    confidence?: number;
    score?: number;
    observation: string;
    directCauses?: string;
    indirectCauses?: string;
    skincarePlan?: string;
    lifestylePlan?: string;
    medicalBoundary?: string;
    evidence: Array<{
        type: ReportEvidenceRef["type"];
        key: string;
        label: string;
        score?: number;
    }>;
}

export interface ReportViewSummary {
    overview: string;
    topFinding?: {
        id: string;
        title: string;
        severity: ReportSeverity;
        severityLabel: string;
        observation: string;
    };
    strengths: string[];
    nextStep?: string;
}

export interface ReportViewNext {
    retestFocus: string[];
    retestInDays: number;
}

export interface ReportView {
    meta: ReportViewMeta;
    summary: ReportViewSummary;
    dimensions: ReportViewDimension[];
    zones: ReportViewZone[];
    conditions: ReportViewCondition[];
    findings: ReportViewFinding[];
    routine: ReportRoutine | null;
    products: ReportProduct[];
    safety: SafetyNotes | null;
    next: ReportViewNext;
    /** true = 由 v1/v2 旧报告适配而来 */
    legacy: boolean;
}

/** 历史列表 / 小程序档案时间线用的轻量摘要 */
export interface ReportViewSummaryCard {
    sessionId: string;
    completedAt?: string;
    overallScore?: number;
    skinTypeLabel?: string;
    skinAge?: number;
    persona?: string;
    reportVersion: number;
    viewVersion: number;
    topFinding?: {
        title: string;
        severity: ReportSeverity;
        severityLabel: string;
    };
}
