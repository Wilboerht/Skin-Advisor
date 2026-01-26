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
        waterOil: DimensionScore; // 01 水油平衡
        pores: DimensionScore; // 02 毛孔状态
        skinTone: DimensionScore; // 03 肤色均匀
        spots: DimensionScore; // 04 色斑检测
        wrinkles: DimensionScore; // 05 细纹皱纹
        skinTypeScore: DimensionScore; // 06 肤质分型 (Score representation of stability/health)
        uvDamage: DimensionScore; // 07 光老化
        sensitivity: DimensionScore; // 08 敏感度
        darkCircles: DimensionScore; // 09 黑眼圈
        firmness: DimensionScore; // 10 皮肤弹性
        acne: DimensionScore; // 11 痘痘分析
        radiance: DimensionScore; // 12 光泽度
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
    waterOil: "水油平衡",
    pores: "毛孔状态",
    skinTone: "肤色均匀",
    spots: "色斑检测",
    wrinkles: "细纹皱纹",
    skinTypeScore: "肤质分型",
    uvDamage: "光老化",
    sensitivity: "敏感度",
    darkCircles: "黑眼圈",
    firmness: "皮肤弹性",
    acne: "痘痘分析",
    radiance: "光泽度"
};

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
    waterOil: "皮肤水分与油脂分泌的平衡状态",
    pores: "毛孔大小、分布及清晰度",
    skinTone: "肤色整体均匀度，有无局部暗沉",
    spots: "表面可见色斑、晒斑及色素沉着",
    wrinkles: "面部干纹、细纹及深层皱纹状态",
    skinTypeScore: "皮肤生理类型的稳定性评分",
    uvDamage: "紫外线造成的深层光老化损伤",
    sensitivity: "皮肤屏障功能及耐受度",
    darkCircles: "眼周色素沉着及循环状况",
    firmness: "胶原蛋白支撑力及皮肤紧致度",
    acne: "粉刺、闭口及痤疮风险",
    radiance: "皮肤表面光泽感与通透度"
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
            waterOil: { score: 72, grade: "average", details: "T区偏油，U区适中" },
            pores: { score: 70, grade: "average", details: "鼻翼两侧毛孔明显" },
            skinTone: { score: 75, grade: "good", details: "肤色基本均匀" },
            spots: { score: 78, grade: "good", details: "少量浅层色斑" },
            wrinkles: { score: 85, grade: "excellent", details: "无明显皱纹" },
            skinTypeScore: { score: 80, grade: "good", details: "肤质较稳定" },
            uvDamage: { score: 75, grade: "good", details: "轻度光老化痕迹" },
            sensitivity: { score: 72, grade: "average", details: "换季易泛红" },
            darkCircles: { score: 68, grade: "fair", details: "有轻微黑眼圈" },
            firmness: { score: 82, grade: "excellent", details: "紧致度良好" },
            acne: { score: 70, grade: "average", details: "偶尔冒痘" },
            radiance: { score: 65, grade: "fair", details: "熬夜后略显暗沉" },
        },
        hydration: { level: "medium", description: "水分含量尚可，需加强保湿" },
        overallScore: 75,
        summary: "您的皮肤整体状态良好，主要问题集中在水油平衡和T区毛孔。眼周循环和光泽度也有提升空间。",
        recommendations: [
            "针对您目前的肤质状况，建议您采取精细化的分区护理策略。",
            "由于T区油脂分泌较旺盛且伴有毛孔问题，建议早晚使用氨基酸洁面产品重点清洁额头与鼻翼，必要时可搭配低浓度水杨酸棉片进行局部湿敷，以疏通毛孔并控制油脂。",
            "U区相对干燥敏感，应避免过度清洁，建议使用含有神经酰胺或透明质酸的修护型乳液进行保湿。",
            "此外，您的眼周存在轻微循环不畅导致的黑眼圈，建议规律作息，并坚持使用含有咖啡因或胜肽成分的眼霜。",
            "最后，鉴于光老化迹象初显，请务必全年坚持使用SPF30+以上的防晒霜，以预防紫外线对胶原蛋白的进一步损伤。"
        ],
        skinConditions: [],
        priorityAreas: ["pores", "radiance"]
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
            if (faceAnalysis.dimensions.acne.score < 60) concerns.add("acne");
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
            price: "¥168"
        },
        {
            id: "p2",
            name: "修护紧致精华",
            category: "精华",
            image: "/images/products/serum.png",
            reason: "深层修护，针对老化迹象",
            price: "¥498"
        },
        {
            id: "p3",
            name: "逆龄面霜",
            category: "面霜",
            image: "/images/products/cream.png",
            reason: "锁水保湿，滋养肌肤",
            price: "¥428"
        },
        {
            id: "p4",
            name: "轻透防晒霜",
            category: "防晒",
            image: "/images/products/sunscreen.png",
            reason: "全波段防护，清爽不油腻",
            price: "¥198"
        },
        {
            id: "p5",
            name: "水杨酸调理水",
            category: "爽肤水",
            image: "/images/products/toner.png",
            reason: "疏通毛孔，改善痘痘",
            price: "¥228"
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
