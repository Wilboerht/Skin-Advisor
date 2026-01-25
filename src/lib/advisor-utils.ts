/**
 * VISIA 风格 8 维度面部分析类型定义
 */

export interface DimensionScore {
    score: number;
    percentile?: number;
    grade: "excellent" | "good" | "average" | "fair" | "poor";
    details: string;
}

// 区域分析数据结构
export interface ZoneData {
    wrinkles: number;
    oil: number;
    texture: number;
    pores: number;
    spots: number;
    redness: number;
    darkCircles: number;
    firmness: number;
    contour: number;
    condition: string;
}

export interface ZoneAnalysis {
    forehead: ZoneData;
    tZone: ZoneData;
    leftCheek: ZoneData;
    rightCheek: ZoneData;
    eyeArea: ZoneData;
    jawline: ZoneData;
}

export interface SkinCondition {
    condition: string;
    severity: "mild" | "moderate" | "severe";
    area: string;
    description: string;
}

export interface FaceAnalysisResult {
    validation?: {
        isValid: boolean;
        message: string;
    };
    skinType: {
        type: string;
        confidence: number;
        description?: string;
    };
    skinAge: {
        estimated: number;
        factors: string[];
    };
    dimensions: {
        spots: DimensionScore; // 色斑
        wrinkles: DimensionScore; // 皱纹
        texture: DimensionScore; // 纹理
        pores: DimensionScore; // 毛孔
        uvDamage: DimensionScore; // 光损伤
        brownSpots: DimensionScore; // 棕色斑
        redAreas: DimensionScore; // 红色区
        acneRisk: DimensionScore; // 紫质
    };
    hydration: {
        level: string;
        percent?: number;
        description: string;
    };
    overallScore: number;
    summary: string;
    recommendations: string[];

    // 新增字段
    skinConditions: SkinCondition[];
    zoneAnalysis?: ZoneAnalysis;
    priorityAreas?: string[];
}

// 可选的 8 维度评分接口 (用于 SkinRadarChart)
export type SkinDimensions = FaceAnalysisResult['dimensions'];
export type SkinDimensionKey = keyof SkinDimensions;

// 中文映射
export const DIMENSION_LABELS: Record<string, string> = {
    spots: "色斑",
    wrinkles: "皱纹",
    texture: "纹理",
    pores: "毛孔",
    uvDamage: "紫外线", // Was 光损伤
    brownSpots: "深层斑", // Was 色素
    redAreas: "泛红",
    acneRisk: "痘痘风险",
};

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
    spots: "表面可见的色斑、雀斑、晒斑",
    wrinkles: "细纹、深层皱纹、表情纹",
    texture: "皮肤表面光滑度和细腻程度",
    pores: "毛孔大小和清晰度",
    uvDamage: "太阳紫外线造成的深层损伤",
    brownSpots: "深层色素沉着、黄褐斑",
    redAreas: "炎症、红血丝、敏感区域",
    acneRisk: "油脂分泌及潜在痤疮风险",
};

export function getDimensionLabel(key: string): string {
    return DIMENSION_LABELS[key] || key;
}

export function getSkinTypeLabel(type: string): string {
    const map: Record<string, string> = {
        dry: "干性肌肤",
        oily: "油性肌肤",
        combination: "混合性肌肤",
        sensitive: "敏感肌肤",
        normal: "中性肌肤",
    };
    return map[type.toLowerCase()] || type;
}

export function getDefaultFaceAnalysisResult(): FaceAnalysisResult {
    return {
        validation: { isValid: true, message: "默认分析" },
        skinType: { type: "combination", confidence: 0.8, description: "混合性肌肤" },
        skinAge: { estimated: 25, factors: [] },
        dimensions: {
            spots: { score: 75, grade: "good", details: "肤色基本均匀" },
            wrinkles: { score: 80, grade: "good", details: "无明显干纹细纹" },
            texture: { score: 70, grade: "average", details: "局部粗糙" },
            pores: { score: 70, grade: "average", details: "T区毛孔可见" },
            uvDamage: { score: 75, grade: "good", details: "有轻微光老化痕迹" },
            brownSpots: { score: 80, grade: "good", details: "深层色素较少" },
            redAreas: { score: 75, grade: "good", details: "两颊轻微泛红" },
            acneRisk: { score: 70, grade: "average", details: "T区有油脂分泌" },
        },
        hydration: { level: "medium", description: "水分含量尚可，需加强保湿" },
        overallScore: 75,
        summary: "您的皮肤整体状态良好，主要问题集中在 T 区出油和毛孔问题。建议加强清洁和分区护理。",
        recommendations: ["做好分区护理", "加强T区清洁", "注意防晒"],
        skinConditions: [],
        priorityAreas: ["pores", "texture"]
    };
}

// ============================================================================
// 新增工具函数 (AI 分析核心逻辑)
// ============================================================================

/** 问卷回答类型 */
export interface QuestionnaireAnswers {
    skinType?: string;
    primaryConcern?: string | string[];
    ageRange?: string;
    gender?: string;
    currentRoutine?: string;
    allergies?: string;
    budget?: string;
    pregnancyStatus?: string;
    medicationHistory?: string;
    sleepQuality?: string;
    stressLevel?: string;
    waterIntake?: string;
    exerciseFrequency?: string;
    dietaryHabits?: string;
    sunExposure?: string;
    location?: string;
}

/**
 * 修复常见的 JSON 格式问题
 */
export function fixJsonString(jsonStr: string): string {
    let fixed = jsonStr.trim();

    // 1. 移除 Markdown 代码块标记
    fixed = fixed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

    // 2. 移除 trailing commas（对象和数组末尾的逗号）
    fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

    // 3. 移除可能的 BOM 或其他不可见字符
    fixed = fixed.replace(/^\uFEFF/, "");

    return fixed;
}

/**
 * 从 AI 响应中提取 JSON
 * 支持多种格式：纯 JSON、markdown 代码块、混合文本
 * 增强了错误恢复能力
 */
export function extractJsonFromResponse<T>(content: string): T {
    // 1. 尝试直接解析（纯 JSON 响应）
    try {
        const trimmed = fixJsonString(content);
        // 检查是否看起来像 JSON
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            return JSON.parse(trimmed) as T;
        }
    } catch (e) {
        // 忽略错误，尝试其他方法
    }

    // 2. 尝试提取 markdown 代码块中的 JSON
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        try {
            const fixed = fixJsonString(codeBlockMatch[1]);
            return JSON.parse(fixed) as T;
        } catch (e) {
            // 忽略
        }
    }

    // 3. 尝试提取最外层的 JSON 对象（使用贪婪匹配）
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
        try {
            const fixed = fixJsonString(jsonMatch[0]);
            return JSON.parse(fixed) as T;
        } catch (e) {
            // 忽略
        }
    }

    // 4. 尝试查找嵌套的 JSON（有时 AI 会返回多个 JSON 对象）
    const nestedJsonMatch = content.match(/\{[^{}]*(?:"skinType"|"analysis"|"concerns")[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (nestedJsonMatch) {
        try {
            return JSON.parse(nestedJsonMatch[0]) as T;
        } catch {
            // 继续
        }
    }

    throw new Error("Failed to extract valid JSON from response");
}

/**
 * 确定肤质类型 (基于问卷和面部分析)
 */
export function determineSkinType(
    answers: QuestionnaireAnswers,
    faceAnalysis?: FaceAnalysisResult
): string {
    // 1. 优先使用面部分析结果 (如果置信度足够高)
    if (faceAnalysis?.skinType?.type && faceAnalysis.skinType.confidence >= 0.7) {
        return faceAnalysis.skinType.type;
    }

    // 2. 使用问卷回答
    if (answers.skinType && answers.skinType !== "unknown") {
        return answers.skinType;
    }

    // 3. 面部分析作为备选
    if (faceAnalysis?.skinType?.type) {
        return faceAnalysis.skinType.type;
    }

    // 4. 默认返回混合性
    return "combination";
}

/** 映射条件到关注点 key */
function mapConditionToConcern(condition: string): string | null {
    const lower = condition.toLowerCase();
    if (lower.includes("痘") || lower.includes("acne") || lower.includes("粉刺")) return "acne";
    if (lower.includes("斑") || lower.includes("spot") || lower.includes("色素")) return "spots";
    if (lower.includes("皱") || lower.includes("wrinkle") || lower.includes("纹")) return "wrinkles";
    if (lower.includes("干") || lower.includes("dry") || lower.includes("脱皮")) return "dryness";
    if (lower.includes("油") || lower.includes("oil")) return "oil_control"; // 或 pores
    if (lower.includes("红") || lower.includes("sensitive") || lower.includes("敏")) return "sensitivity";
    if (lower.includes("黑眼圈") || lower.includes("dark circle")) return "dark_circles";
    if (lower.includes("暗") || lower.includes("dull")) return "dullness";
    return null;
}

/**
 * 识别主要关注点
 */
export function identifyConcerns(
    answers: QuestionnaireAnswers,
    faceAnalysis?: FaceAnalysisResult
): string[] {
    const concerns = new Set<string>();

    // 1. 获取问卷中的关注点
    if (answers.primaryConcern) {
        const primary = Array.isArray(answers.primaryConcern)
            ? answers.primaryConcern
            : [answers.primaryConcern];
        primary.forEach(c => concerns.add(c));
    }

    // 2. 结合面部分析中的严重问题 (severity = severe/moderate)
    if (faceAnalysis?.skinConditions) {
        faceAnalysis.skinConditions.forEach(c => {
            if (c.severity === "severe" || c.severity === "moderate") {
                const key = mapConditionToConcern(c.condition);
                if (key) concerns.add(key);
            }
        });

        // 检查维度评分
        if (faceAnalysis.dimensions) {
            if (faceAnalysis.dimensions.wrinkles.score < 60) concerns.add("wrinkles");
            if (faceAnalysis.dimensions.spots.score < 60) concerns.add("spots");
            if (faceAnalysis.dimensions.pores.score < 60) concerns.add("pores");
            if (faceAnalysis.dimensions.acneRisk.score < 60) concerns.add("acne");
        }
    }

    // 保证至少有一个关注点
    if (concerns.size === 0) {
        concerns.add("hydration"); // 默认补水
    }

    return Array.from(concerns);
}

export function getConcernLabel(concern: string): string {
    const CONCERN_LABELS: Record<string, string> = {
        anti_aging: "延衰抗老",
        fine_lines: "淡化细纹",
        dullness: "暗沉提亮",
        pigmentation: "色素不均",
        hydration: "补水保湿",
        pores: "毛孔粗大",
        sensitivity: "敏感泛红",
        acne: "痘痘粉刺",
        aging: "延衰抗老",
        dull: "暗沉提亮",
        wrinkles: "淡化细纹",
        spots: "色素不均",
        dryness: "干燥缺水",
        oil_control: "控油平衡",
        dark_circles: "黑眼圈",
    };
    return CONCERN_LABELS[concern] || concern;
}

// ============================================================================
// 产品推荐模拟
// ============================================================================

export interface ProductRecommendation {
    id: string;
    name: string;
    nameEn?: string;
    category: string;
    image: string;
    reason: string;
    price?: string;
}

/**
 * 简单的产品推荐匹配
 */
export async function matchProducts(
    concerns: string[],
    answers: QuestionnaireAnswers
): Promise<ProductRecommendation[]> {
    const skinType = determineSkinType(answers);

    // 这里模拟一个产品库
    const products: ProductRecommendation[] = [
        {
            id: "p1",
            name: "云朵洁面慕斯",
            category: "洁面",
            image: "/images/products/cleanser.png",
            reason: "温和清洁，不伤肤质",
            price: "¥129"
        },
        {
            id: "p2",
            name: "修护紧致精华",
            category: "精华",
            image: "/images/products/serum.png",
            reason: "深层修护，针对老化迹象",
            price: "¥399"
        },
        {
            id: "p3",
            name: "逆龄面霜",
            category: "面霜",
            image: "/images/products/cream.png",
            reason: "锁水保湿，滋养肌肤",
            price: "¥359"
        },
        {
            id: "p4",
            name: "轻透防晒霜",
            category: "防晒",
            image: "/images/products/sunscreen.png",
            reason: "全波段防护，清爽不油腻",
            price: "¥169"
        },
        {
            id: "p5",
            name: "水杨酸调理水",
            category: "爽肤水",
            image: "/images/products/toner.png",
            reason: "疏通毛孔，改善痘痘",
            price: "¥189"
        }
    ];

    // 简单的规则匹配
    const recommended: ProductRecommendation[] = [];

    // 基础三件套
    recommended.push(products[0]); // 洁面
    recommended.push(products[3]); // 防晒

    // 根据肤质和问题添加
    if (concerns.includes("acne") || skinType === "oily") {
        recommended.push(products[4]); // 水杨酸
    } else {
        recommended.push(products[2]); // 面霜
    }

    if (concerns.includes("wrinkles") || concerns.includes("aging") || concerns.includes("anti_aging")) {
        recommended.push(products[1]); // 精华
    }

    // 去重
    const unique = Array.from(new Set(recommended.map(p => p.id)))
        .map(id => recommended.find(p => p.id === id)!);

    return unique.slice(0, 4); // 最多推荐4个
}
