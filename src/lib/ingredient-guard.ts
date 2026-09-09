/**
 * zoneAnalysis advice 成分硬校验（prompt 软约束的兜底）
 *
 * 视觉模型有概率违反品牌成分白名单（如推荐水杨酸/视黄醇等体系外成分）。
 * 本模块在视觉结果 Zod 校验之后、落库之前执行关键词扫描：
 * - 命中禁用成分 → 该区域的 advice 整体降级为安全通用建议（禁用文本不出库），并上报告警
 * - 否定语境豁免：「避免含酒精的产品」这类规避表述不误伤
 */

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

/** 违规区域 advice 的安全降级文案（品牌安全口径，不含任何具体成分） */
export const SAFE_ZONE_ADVICE_FALLBACK =
    "以温和清洁、基础保湿与每日防晒为主，具体针对性成分方案请参考下方产品推荐与顾问解读。";

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
