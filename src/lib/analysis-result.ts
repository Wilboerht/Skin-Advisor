/**
 * 分析结果共享类型与工具函数
 * 同时被客户端组件和 API Route 使用，避免从 "use client" 组件导入服务端代码。
 */

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
    /** 拍摄时肌肤状态（bare/sunscreen/washed/light_makeup/heavy_makeup），结果页提示用 */
    skinState?: string;
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
            concerns: (skinProfile?.concerns as string[] | undefined) || [],
            skinAge: skinProfile?.skinAge as number | undefined,
        },
        analysis: {
            summary: (analysis?.summary as string | undefined) || "分析完成。",
            details: (analysis?.details as string[] | undefined) || [],
            lifestyleTips: (analysis?.lifestyleTips as string[] | undefined) || [],
        },
        dataSource: normalizeDataSource(record.dataSource, record.source),
        products: (record.products as ComprehensiveResult["products"]) || [],
        persona: record.persona as string | undefined,
        expiresAt: record.expiresAt as string | undefined,
        skinState: typeof record.skinState === "string" ? record.skinState : undefined,
    };
}
