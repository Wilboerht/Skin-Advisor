/**
 * zoneAnalysis advice 成分硬校验（prompt 软约束的兜底）
 *
 * 视觉模型有概率违反品牌成分白名单（如推荐水杨酸/视黄醇等体系外成分）。
 * 本模块在视觉结果 Zod 校验之后、落库之前执行关键词扫描：
 * - 命中禁用成分 → 该区域的 advice 整体降级为安全通用建议（禁用文本不出库），并上报告警
 * - 否定语境豁免：「避免含酒精的产品」这类规避表述不误伤
 */

import type { ConsultantReport } from "./advisor-utils";

/** 禁用成分关键词（与 ai-prompts.ts 中 🚫 显式禁用清单保持一致，含繁体/别名） */
const FORBIDDEN_TERMS: string[] = [
    "水杨酸", "水楊酸",
    "视黄醇", "視黃醇", "A醇", "a醇", "维A酸", "维生素A酸",
    "咖啡因",
    "氢醌", "对苯二酚",
    "白泥", "高岭土", "高嶺土",
    "果酸",
    "酒精", "乙醇",
];

/** 否定/规避语境：禁用词前 6 字内出现这些词时视为「提醒用户避开」，不算违规推荐 */
const NEGATION_PATTERN = /(避免|避开|不含|无需|无须|勿|别|远离|禁用|排除|暂停|停止|不用|切忌|切勿)/;

/**
 * 孕期禁忌成分关键词（与 ai-prompts.ts 的 PREGNANCY_EXCLUSION_RULE 保持一致）。
 * 覆盖精油类与香精：孕期安全性数据不足，报告文本与产品清单都应规避
 */
export const PREGNANCY_FORBIDDEN_TERMS: string[] = [
    "迷迭香叶油", "杜松果油", "姜根油", "肉豆蔻籽油", "檀香油", "柠檬籽油", "乳香油", "橙油",
    "葡萄柚籽提取物",
    "香精", "fragrance", "parfum",
];

/** 违规区域 advice 的安全降级文案（品牌安全口径，不含任何具体成分） */
export const SAFE_ZONE_ADVICE_FALLBACK =
    "以温和清洁、基础保湿与每日防晒为主，具体针对性成分方案请参考下方产品推荐与顾问解读。";

/** 违规护理方案的安全降级文案（v2 报告字段级兜底） */
export const SAFE_SKINCARE_PLAN_FALLBACK =
    "以温和清洁、基础保湿与每日防晒为主，具体针对性成分方案请参考下方产品推荐与顾问解读。";
export const SAFE_PRODUCT_REASON_FALLBACK =
    "已根据本次诊断为您筛选，使用前建议先做局部试用，具体可咨询护肤顾问。";

/** 泛化替代词：非直接推荐语境（观察/归因/总评）命中禁用词时替换，保留句子语义 */
const GENERIC_FORBIDDEN_REPLACEMENT = "刺激性成分";
const GENERIC_PREGNANCY_REPLACEMENT = "孕期需谨慎的成分";

export interface IngredientViolation {
    /** 区域 key，如 leftCheek */
    zone: string;
    /** 命中的禁用成分关键词 */
    keyword: string;
    /** 违规原文（截断到 120 字，供告警日志排查） */
    advice: string;
}

function isNegatedContext(text: string, matchIndex: number): boolean {
    // 「无酒精」紧邻豁免
    if (text.slice(matchIndex - 1, matchIndex) === "无") return true;
    const before = text.slice(Math.max(0, matchIndex - 6), matchIndex);
    return NEGATION_PATTERN.test(before);
}

/**
 * 扫描单个区域的 advice，返回命中的违规项（每个禁用词最多记一条）
 */
function scanAdvice(zone: string, advice: string): IngredientViolation[] {
    const violations: IngredientViolation[] = [];
    for (const term of FORBIDDEN_TERMS) {
        let idx = advice.indexOf(term);
        while (idx !== -1) {
            if (!isNegatedContext(advice, idx)) {
                violations.push({
                    zone,
                    keyword: term,
                    advice: advice.slice(0, 120),
                });
                break;
            }
            idx = advice.indexOf(term, idx + term.length);
        }
    }
    return violations;
}

/**
 * 扫描 zoneAnalysis 全部区域的 advice，返回全部违规项（只读，不修改数据）
 */
export function scanZoneAdviceViolations(zoneAnalysis: unknown): IngredientViolation[] {
    if (!zoneAnalysis || typeof zoneAnalysis !== "object") return [];
    const violations: IngredientViolation[] = [];
    for (const [zone, data] of Object.entries(zoneAnalysis as Record<string, unknown>)) {
        if (!data || typeof data !== "object") continue;
        const advice = (data as { advice?: unknown }).advice;
        if (typeof advice !== "string" || !advice) continue;
        violations.push(...scanAdvice(zone, advice));
    }
    return violations;
}

/**
 * 硬保证入口：扫描并对违规区域的 advice 原地降级为安全文案。
 * 返回违规项（空数组 = 未命中），调用方负责告警日志。
 */
export function enforceZoneAdviceIngredients(zoneAnalysis: unknown): IngredientViolation[] {
    const violations = scanZoneAdviceViolations(zoneAnalysis);
    if (violations.length === 0) return violations;

    const zones = new Set(violations.map((v) => v.zone));
    for (const zone of zones) {
        const data = (zoneAnalysis as Record<string, unknown>)[zone];
        if (data && typeof data === "object") {
            (data as { advice?: unknown }).advice = SAFE_ZONE_ADVICE_FALLBACK;
        }
    }
    return violations;
}

// ============================================================================
// 顾问叙事报告（v2）成分/孕期硬校验
// ============================================================================

export interface ConsultantTextViolation {
    /** 违规字段路径，如 "issues[0].skincarePlan" */
    field: string;
    /** 命中的关键词 */
    keyword: string;
    type: "forbidden" | "pregnancy";
}

export interface EnforceConsultantOptions {
    /** 孕期/不确定：额外扫描孕期禁忌成分（精油类/香精） */
    pregnancy?: boolean;
}

/**
 * 扫描文本中的关键词命中（否定/规避语境豁免）。
 */
function scanTerms(text: string, terms: string[]): string[] {
    const hits: string[] = [];
    for (const term of terms) {
        let idx = text.indexOf(term);
        while (idx !== -1) {
            if (!isNegatedContext(text, idx)) {
                hits.push(term);
                break;
            }
            idx = text.indexOf(term, idx + term.length);
        }
    }
    return hits;
}

/** 替换命中关键词（保留否定语境中的原文），用于非推荐语境字段 */
function replaceTerms(text: string, hits: string[], replacement: string): string {
    let out = text;
    for (const term of hits) {
        let idx = out.indexOf(term);
        while (idx !== -1) {
            if (!isNegatedContext(out, idx)) {
                out = out.slice(0, idx) + replacement + out.slice(idx + term.length);
                idx = out.indexOf(term, idx + replacement.length);
            } else {
                idx = out.indexOf(term, idx + term.length);
            }
        }
    }
    return out;
}

/**
 * 硬保证入口（v2 报告）：扫描顾问报告全部文本字段，命中品牌禁用成分/孕期禁忌成分时：
 * - 推荐语境字段（skincarePlan / productReasons[].reason）整体降级为安全文案；
 * - 叙述语境字段（观察/归因/总评等）用泛化词替换命中词，保留句子语义。
 * 原地修改 report，返回违规项（空数组 = 未命中），调用方负责告警日志。
 */
export function enforceConsultantReportIngredients(
    report: ConsultantReport,
    options: EnforceConsultantOptions = {}
): ConsultantTextViolation[] {
    const violations: ConsultantTextViolation[] = [];
    const forbidden = FORBIDDEN_TERMS;
    const pregnancyTerms = options.pregnancy ? PREGNANCY_FORBIDDEN_TERMS : [];

    const scanBoth = (text: string): { forbiddenHits: string[]; pregnancyHits: string[] } => ({
        forbiddenHits: scanTerms(text, forbidden),
        pregnancyHits: scanTerms(text, pregnancyTerms),
    });

    /** 叙述语境字段：替换命中词 */
    const sanitizeNarrative = (value: string, field: string): string => {
        const { forbiddenHits, pregnancyHits } = scanBoth(value);
        if (forbiddenHits.length === 0 && pregnancyHits.length === 0) return value;
        forbiddenHits.forEach((keyword) => violations.push({ field, keyword, type: "forbidden" }));
        pregnancyHits.forEach((keyword) => violations.push({ field, keyword, type: "pregnancy" }));
        let out = replaceTerms(value, forbiddenHits, GENERIC_FORBIDDEN_REPLACEMENT);
        out = replaceTerms(out, pregnancyHits, GENERIC_PREGNANCY_REPLACEMENT);
        return out;
    };

    /** 推荐语境字段：命中即整体降级为安全文案 */
    const sanitizeRecommendation = (value: string, field: string, fallback: string): string => {
        const { forbiddenHits, pregnancyHits } = scanBoth(value);
        if (forbiddenHits.length === 0 && pregnancyHits.length === 0) return value;
        forbiddenHits.forEach((keyword) => violations.push({ field, keyword, type: "forbidden" }));
        pregnancyHits.forEach((keyword) => violations.push({ field, keyword, type: "pregnancy" }));
        return fallback;
    };

    report.overview = sanitizeNarrative(report.overview, "overview");
    report.strengths = report.strengths.map((s, i) => sanitizeNarrative(s, `strengths[${i}]`));
    if (typeof report.routineNote === "string") {
        report.routineNote = sanitizeNarrative(report.routineNote, "routineNote");
    }

    report.issues.forEach((issue, i) => {
        for (const key of ["title", "observation", "directCauses", "indirectCauses", "medicalBoundary"]) {
            if (typeof issue[key] === "string") {
                issue[key] = sanitizeNarrative(issue[key] as string, `issues[${i}].${key}`);
            }
        }
        if (typeof issue.skincarePlan === "string") {
            issue.skincarePlan = sanitizeRecommendation(issue.skincarePlan, `issues[${i}].skincarePlan`, SAFE_SKINCARE_PLAN_FALLBACK);
        }
        if (typeof issue.lifestylePlan === "string") {
            issue.lifestylePlan = sanitizeNarrative(issue.lifestylePlan, `issues[${i}].lifestylePlan`);
        }
    });

    report.productReasons?.forEach((item, i) => {
        if (typeof item.reason === "string") {
            item.reason = sanitizeRecommendation(item.reason, `productReasons[${i}].reason`, SAFE_PRODUCT_REASON_FALLBACK);
        }
    });

    return violations;
}
