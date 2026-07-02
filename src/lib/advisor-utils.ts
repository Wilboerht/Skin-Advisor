/**
 * MySkin.Technology 专业皆肆分析类形定义
 */

export interface DimensionScore {
    score: number;
    percentile?: number;
    grade: "excellent" | "good" | "average" | "fair" | "poor";
    details: string;
}

// 区域分析数据结构
export interface ZoneData {
    condition: string; // 该区域存在的问题
    advice: string;    // 针对该区域的建议
    // 详细指标 (0-100, 这里的含义根据具体指标而定，通常用于计算热力图)
    wrinkles?: number;
    oil?: number;
    texture?: number;
    spots?: number;
    redness?: number;
    darkCircles?: number;
    firmness?: number;
    contour?: number;
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
    gender?: {
        value: "male" | "female";
        confidence: number;
    };
    dimensions: {
        waterOil: DimensionScore; // 01 水油平衡
        skinTone: DimensionScore; // 02 肤色均匀度
        spots: DimensionScore; // 03 色斑状况
        wrinkles: DimensionScore; // 04 细纹皱纹
        uvDamage: DimensionScore; // 05 光老化程度
        sensitivity: DimensionScore; // 06 肌肤敏感度
        darkCircles: DimensionScore; // 07 黑眼圈
        firmness: DimensionScore; // 08 皮肤弹性
        acne: DimensionScore; // 09 粉刺/痤疮
        radiance: DimensionScore; // 10 光泽度
    };
    hydration?: {
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

    // AI 实验室数据 (新增)
    labAnalysis?: LabAnalysisResult;
}

export interface LabAnalysisResult {
    // 仅保留可由照片视觉估算的指标
    glogau?: { value: string; range?: string; status: string }; // I, II, III
    homogeneity?: { value: number; unit: string; range?: string; status: string }; // CV%
    wrinkleGrade?: { value: string; range?: string; status: string }; // Grade 1-3
}

// 10 维度评分接口 (用于 ScientificBarChart)
export type SkinDimensions = FaceAnalysisResult['dimensions'];
export type SkinDimensionKey = keyof SkinDimensions;

// 中文映射
export const DIMENSION_LABELS: Record<string, string> = {
    waterOil: "水油平衡",
    skinTone: "肤色均衡度",
    spots: "色斑状况",
    wrinkles: "细纹皱纹",
    uvDamage: "光老化程度",
    sensitivity: "肌肤敏感度",
    darkCircles: "黑眼圈",
    firmness: "皮肤弹性",
    acne: "粉刺/痤疮",
    radiance: "光泽度"
};

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
    waterOil: "皮肤水分与油脂分泌的平衡状态",
    skinTone: "肤色整体均匀度，有无局部暗沉",
    spots: "表面可见色斑、晒斑及色素沉着",
    wrinkles: "面部干纹、细纹及深层皱纹状态",
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
        combination_dry: "混干性肌肤",
        combination_oily: "混油性肌肤",
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
        // 默认不设置 gender，避免与问卷答案产生误判
        gender: undefined,
        dimensions: {
            waterOil: { score: 72, grade: "average", details: "T区偏油，U区适中" },
            skinTone: { score: 75, grade: "good", details: "肤色基本均匀" },
            spots: { score: 78, grade: "good", details: "少量浅层色斑" },
            wrinkles: { score: 85, grade: "excellent", details: "无明显皱纹" },
            uvDamage: { score: 75, grade: "good", details: "轻度光老化痕迹" },
            sensitivity: { score: 72, grade: "average", details: "换季易泛红" },
            darkCircles: { score: 68, grade: "fair", details: "有轻微黑眼圈" },
            firmness: { score: 82, grade: "excellent", details: "紧致度良好" },
            acne: { score: 70, grade: "average", details: "偶尔冒痘" },
            radiance: { score: 65, grade: "fair", details: "熬夜后略显暗沉" },
        },
        hydration: { level: "medium", description: "水分含量尚可，需加强保湿" },
        overallScore: 75,
        summary: "您的皮肤整体状态良好，主要问题集中在水油平衡和T区出油。眼周循环和光泽度也有提升空间。",
        recommendations: [
            "针对您目前的肤质状况，建议您采取精细化的分区护理策略。",
            "由于T区油脂分泌较旺盛且容易引发粉刺，建议早晚使用氨基酸洁面产品重点清洁额头与鼻翼，必要时可搭配低浓度水杨酸棉片进行局部湿敷，以控制油脂。",
            "U区相对干燥敏感，应避免过度清洁，建议使用含有神经酰胺或透明质酸的修护型乳液进行保湿。",
            "此外，您的眼周存在轻微循环不畅导致的黑眼圈，建议规律作息，并坚持使用含有咖啡因或胜肽成分的眼霜。",
            "最后，鉴于光老化迹象初显，请务必全年坚持使用SPF30+以上的防晒霜，以预防紫外线对胶原蛋白的进一步损伤。"
        ],
        skinConditions: [],
        priorityAreas: ["waterOil", "radiance"],
        zoneAnalysis: {
            forehead: { condition: "轻微出油", advice: "使用清爽控油产品，定期深层清洁", oil: 60, texture: 80, wrinkles: 10, spots: 15, redness: 10, firmness: 85, contour: 90 },
            tZone: { condition: "出油旺盛", advice: "使用含水杨酸的控油平衡产品", oil: 70, texture: 40, wrinkles: 5, spots: 20, redness: 15, firmness: 80, contour: 85 },
            leftCheek: { condition: "状态健康", advice: "保持日常保湿与防晒即可", oil: 30, texture: 90, wrinkles: 8, spots: 10, redness: 20, firmness: 85, contour: 88 },
            rightCheek: { condition: "状态健康", advice: "保持日常保湿与防晒即可", oil: 30, texture: 90, wrinkles: 8, spots: 10, redness: 20, firmness: 85, contour: 88 },
            eyeArea: { condition: "轻微黑眼圈", advice: "使用含咖啡因或胜肽的眼霜修护", oil: 20, texture: 75, wrinkles: 20, darkCircles: 40, firmness: 80 },
            jawline: { condition: "轮廓紧致", advice: "保持现状，可配合提拉按摩", oil: 25, firmness: 90, contour: 85 }
        },
        labAnalysis: {
            glogau: { value: "II 型", status: "轻中度" },
            homogeneity: { value: 14, unit: "% C.V.", status: "均匀" },
            wrinkleGrade: { value: "Grade 1", status: "无皱纹" }
        }
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

    allergies?: string | string[];
    budget?: string;
    skincareFrequency?: string;
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
    if (lower.includes("油") || lower.includes("oil")) return "oil_control";
    if (lower.includes("红") || lower.includes("sensitive") || lower.includes("敏")) return "sensitivity";
    if (lower.includes("黑眼圈") || lower.includes("dark circle")) return "dark_circles";
    if (lower.includes("暗") || lower.includes("dull")) return "dullness";
    if (lower.includes("粗糙") || lower.includes("毛孔") || lower.includes("texture")) return "roughness";
    if (lower.includes("光损伤") || lower.includes("晒伤") || lower.includes("光老化")) return "anti_aging";
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
    }

    // 3. 检查维度评分（防御性：前端传入的 faceAnalysis 可能只包含部分维度）
    if (faceAnalysis?.dimensions) {
        if (faceAnalysis.dimensions.wrinkles?.score < 60) concerns.add("wrinkles");
        if (faceAnalysis.dimensions.spots?.score < 60) concerns.add("spots");
        if (faceAnalysis.dimensions.waterOil?.score < 60) concerns.add("waterOil");
        if (faceAnalysis.dimensions.acne?.score < 60) concerns.add("acne");
        if (faceAnalysis.dimensions.uvDamage?.score < 60) concerns.add("anti_aging");
        if (faceAnalysis.dimensions.sensitivity?.score < 60) concerns.add("sensitivity");
        if (faceAnalysis.dimensions.radiance?.score < 60) concerns.add("dullness");
        if (faceAnalysis.dimensions.darkCircles?.score < 60) concerns.add("dark_circles");
        if (faceAnalysis.dimensions.firmness?.score < 60) concerns.add("anti_aging");
        if (faceAnalysis.dimensions.skinTone?.score < 60) concerns.add("dullness");
    }

    // 4. 检查区域分析中的各维度异常指标 (6 大区域 × 8 维指标)
    if (faceAnalysis?.zoneAnalysis) {
        const zones = [
            faceAnalysis.zoneAnalysis.forehead,
            faceAnalysis.zoneAnalysis.tZone,
            faceAnalysis.zoneAnalysis.leftCheek,
            faceAnalysis.zoneAnalysis.rightCheek,
            faceAnalysis.zoneAnalysis.eyeArea,
            faceAnalysis.zoneAnalysis.jawline,
        ];
        // 纹理/粗糙 → roughness (原逻辑)
        if (zones.some(z => z.texture !== undefined && z.texture < 50)) concerns.add("roughness");
        // 出油偏高 → oil_control
        if (zones.some(z => z.oil !== undefined && z.oil > 60)) concerns.add("oil_control");
        // 皱纹 → wrinkles
        if (zones.some(z => z.wrinkles !== undefined && z.wrinkles > 50)) concerns.add("wrinkles");
        // 色斑 → spots
        if (zones.some(z => z.spots !== undefined && z.spots > 50)) concerns.add("spots");
        // 泛红 → sensitivity
        if (zones.some(z => z.redness !== undefined && z.redness > 50)) concerns.add("sensitivity");
        // 黑眼圈 → dark_circles (眼周区域特有)
        if (faceAnalysis.zoneAnalysis.eyeArea?.darkCircles !== undefined && faceAnalysis.zoneAnalysis.eyeArea.darkCircles > 50) {
            concerns.add("dark_circles");
        }
        // 松弛 → anti_aging
        if (zones.some(z => z.firmness !== undefined && z.firmness < 50)) concerns.add("anti_aging");
        // 轮廓模糊 → anti_aging
        if (zones.some(z => z.contour !== undefined && z.contour < 50)) concerns.add("anti_aging");
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
        sensitivity: "敏感泛红",
        acne: "痘痘粉刺",
        aging: "延衰抗老",
        dull: "暗沉提亮",
        wrinkles: "淡化细纹",
        spots: "色素不均",
        dryness: "干燥缺水",
        oil_control: "控油平衡",
        dark_circles: "黑眼圈",
        roughness: "粗糙毛孔",
        waterOil: "水油平衡",
    };
    return CONCERN_LABELS[concern] || concern;
}

// ============================================================================
// 标准化分析结果（存储在 AdvisorSession.analysisResult 中的格式）
// ============================================================================

export interface SharedAnalysisResult {
    nickname?: string;
    skinProfile?: {
        type?: string;
        typeLabel?: string;
        concerns?: string[];
        skinAge?: number;
    };
    analysis?: {
        summary?: string;
    };
    skinAnalysis?: {
        summary?: string;
        score?: number;
        skinAge?: number;
    };
    faceAnalysis?: {
        overallScore?: number;
        dimensions?: {
            waterOil?: { score?: number };
            skinTone?: { score?: number };
        };
    };
    gender?: {
        value?: string;
    };
    products?: unknown[];
    dataSource?: string;
    userLocation?: string;
}

// Note: Product recommendation logic has been moved to src/lib/recommendations.ts
// The matchProducts() mock function has been removed in favor of the real
// recommendation engine (recommendProducts / getCandidateProducts).

