/**
 * 分析结果共享类型与工具函数
 * 同时被客户端组件和 API Route 使用，避免从 "use client" 组件导入服务端代码。
 */

import type { ConsultantReport } from "@/lib/advisor-utils";

/**
 * 上一次测肤摘要（趋势对比板块数据源）。
 * 登录用户由 /reports/:id 服务端从最近一次已完成会话解析（热层/归档冷层字段兼容）；
 * 游客由前端 localStorage 快照提供。
 */
export interface PreviousTestSummary {
    /** 上一次测肤的派系 key（8 派 IP），无则 null */
    persona?: string | null;
    /** 上一次综合评分（面部影像） */
    score?: number | null;
    /** 上一次肌肤年龄 */
    skinAge?: number | null;
    /** 上一次完成时间（ISO） */
    at?: string | null;
}

export interface ComprehensiveResult {
    skinProfile: {
        type: string;
        typeLabel: string;
        concerns: string[];
        skinAge?: number;
    };
    analysis: {
        summary: string;
        details: string[];
        lifestyleTips?: string[];
    };
    products?: Array<{
        id: string;
        name: string;
        category: string;
        reason: string;
        image: string;
        images?: string[] | null;
        price?: string;
        description?: string | null;
        keyIngredients?: string[];
        benefits?: string[];
        affiliateLinks?: Record<string, string> | null;
        howToUse?: string | null;
        source?: "persona" | "algorithm" | "ai";
    }>;
    dataSource: "comprehensive" | "questionnaire" | "hybrid";
    persona?: string;
    expiresAt?: string;
    /** 分析完成时间（ISO），证书/报告展示用；缺省时前端不展示日期（避免把"查看时间"伪造成"测肤时间"） */
    analyzedAt?: string;
    /** 拍摄时肌肤状态（bare/sunscreen/washed/light_makeup/heavy_makeup），结果页提示用 */
    skinState?: string;
    /** 测肤时使用的昵称（analyze 落库；结果页/海报展示用） */
    nickname?: string;
    /** 报告版本：2 = 顾问叙事报告（consultantReport 存在），缺省/v1 = 旧板块渲染 */
    reportVersion?: number;
    /** 顾问叙事报告数据（v2 专属；历史报告无此字段，走旧渲染） */
    consultantReport?: ConsultantReport;
}

function normalizeDataSource(
    dataSource: unknown,
    source: unknown
): ComprehensiveResult["dataSource"] {
    const allowed = ["comprehensive", "questionnaire", "hybrid"] as const;
    if (typeof dataSource === "string" && allowed.includes(dataSource as typeof allowed[number])) {
        return dataSource as ComprehensiveResult["dataSource"];
    }

    const effective = typeof source === "string" ? source : dataSource;
    if (effective === "ai" || effective === "hybrid" || effective === "comprehensive") {
        return "comprehensive";
    }
    if (effective === "fallback") {
        return "questionnaire";
    }
    return "questionnaire";
}

function toFiniteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * 数组字段防御：旧脏数据可能是字符串/对象（如 details 存成整段文本），
 * 直接强转会让消费端 .map/.slice 抛错或把首字符当首条渲染；
 * 非数组一律归空，数组内非字符串元素剔除（同 normalizeConsultantReport 的 strengths 处理）。
 */
function toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
}

/**
 * 防御性归一化历史脏数据：旧记录可能缺 issues/strengths 数组或字段类型异常，
 * 强转前补齐安全默认，保证组件渲染假设成立。
 */
function normalizeConsultantReport(raw: unknown): ConsultantReport | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const record = raw as Record<string, unknown>;
    const issues = (Array.isArray(record.issues) ? record.issues : [])
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i) => ({
            ...i,
            relatedDimensions: Array.isArray(i.relatedDimensions) ? i.relatedDimensions : [],
        }));
    return {
        ...(record as unknown as ConsultantReport),
        overview: typeof record.overview === "string" ? record.overview : "",
        issues,
        strengths: Array.isArray(record.strengths)
            ? record.strengths.filter((s): s is string => typeof s === "string")
            : [],
        routineNote: typeof record.routineNote === "string" ? record.routineNote : undefined,
    } as ConsultantReport;
}

/**
 * 标准化 analysisResult 数据结构，兼容新旧两种格式：
 * - 新格式: { skinProfile, analysis, products, dataSource }
 * - 旧格式: { skinAnalysis, faceAnalysis, products, ... }
 */
export function normalizeAnalysisResult(raw: unknown): ComprehensiveResult | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;

    const skinProfile = (record.skinProfile as Record<string, unknown> | undefined) || (record.skinAnalysis as Record<string, unknown> | undefined);
    const analysis = (record.analysis as Record<string, unknown> | undefined) || (record.skinAnalysis as Record<string, unknown> | undefined);

    return {
        skinProfile: {
            type: (skinProfile?.type as string | undefined) || (skinProfile?.skinType as string | undefined) || "combination",
            typeLabel: (skinProfile?.typeLabel as string | undefined) || (skinProfile?.skinTypeLabel as string | undefined) || "混合性肌肤",
            concerns: toStringArray(skinProfile?.concerns),
            skinAge: toFiniteNumber(skinProfile?.skinAge),
        },
        analysis: {
            summary: (analysis?.summary as string | undefined) || "分析完成。",
            details: toStringArray(analysis?.details),
            lifestyleTips: toStringArray(analysis?.lifestyleTips),
        },
        dataSource: normalizeDataSource(record.dataSource, record.source),
        products: Array.isArray(record.products)
            ? (record.products as ComprehensiveResult["products"])
            : [],
        persona: record.persona as string | undefined,
        expiresAt: record.expiresAt as string | undefined,
        analyzedAt: record.analyzedAt as string | undefined,
        skinState: typeof record.skinState === "string" ? record.skinState : undefined,
        nickname: typeof record.nickname === "string" ? record.nickname : undefined,
        reportVersion: typeof record.reportVersion === "number" ? record.reportVersion : undefined,
        consultantReport: normalizeConsultantReport(record.consultantReport),
    };
}
