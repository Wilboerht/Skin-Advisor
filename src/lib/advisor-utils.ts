import { z } from "zod";

/**
 * MySkin.Technology 专业皮肤分析类型定义
 */

export interface DimensionScore {
    score: number;
    percentile?: number;
    grade: "excellent" | "good" | "average" | "fair" | "poor";
    details: string;
    /** acne 维度子分：黑头/闭口/粉刺/毛孔粗大（0-100，越高问题越少；旧数据缺失） */
    blackheads?: number;
    /** acne 维度子分：炎性痘痘/红肿（0-100，越高问题越少；旧数据缺失） */
    pimples?: number;
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

    // AI 实验室数据 (新增)
    labAnalysis?: LabAnalysisResult;
}

export interface LabAnalysisResult {
    // 仅保留可由照片视觉估算的指标
    glogau?: { value: string; range?: string; status: string }; // I-IV 型
    homogeneity?: { value?: number; unit?: string; range?: string; status: string }; // 定性描述（均匀/不均），旧数据兼容数值字段
    wrinkleGrade?: { value: string; range?: string; status: string }; // 1-3 级
}

// 十维展示常量已拆分到 advisor-labels（客户端安全，避免 zod 进首屏包）；
// 此处 re-export 仅为服务端旧引用兼容，客户端请直接从 @/lib/advisor-labels 导入
export {
    DIMENSION_LABELS,
    DIMENSION_DESCRIPTIONS,
    DIMENSION_ORDER,
    type SkinDimensions,
    type SkinDimensionKey,
} from "./advisor-labels";
import { DIMENSION_LABELS } from "./advisor-labels";

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
    skincareLevel?: string;
    pregnancy?: string;
    pregnancyStatus?: string;
    medicalBeauty?: string;
    menstrualCycle?: string;
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

    // 2. 移除 trailing commas（对象和数组末尾的逗号），字符串字面量内的内容不动
    fixed = removeTrailingCommas(fixed);

    // 3. 移除可能的 BOM 或其他不可见字符
    fixed = fixed.replace(/^\uFEFF/, "");

    return fixed;
}

/** 逐字符扫描并跳过字符串字面量，仅在字符串外移除 trailing comma（避免误改字符串值内的 ",]" 等内容） */
function removeTrailingCommas(json: string): string {
    let out = "";
    let inString = false;
    let escape = false;
    for (let i = 0; i < json.length; i++) {
        const ch = json[i];
        if (inString) {
            out += ch;
            if (escape) escape = false;
            else if (ch === "\\") escape = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            out += ch;
            continue;
        }
        if (ch === ",") {
            let j = i + 1;
            while (j < json.length && /\s/.test(json[j])) j++;
            if (json[j] === "}" || json[j] === "]") continue;
        }
        out += ch;
    }
    return out;
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
    } catch {
        // 忽略错误，尝试其他方法
    }

    // 2. 尝试提取 markdown 代码块中的 JSON
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        try {
            const fixed = fixJsonString(codeBlockMatch[1]);
            return JSON.parse(fixed) as T;
        } catch {
            // 忽略
        }
    }

    // 3. 尝试提取最外层的 JSON 对象（使用贪婪匹配）
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
        try {
            const fixed = fixJsonString(jsonMatch[0]);
            return JSON.parse(fixed) as T;
        } catch {
            // 忽略
        }
    }

    // 4. 尝试用括号计数方式找到第一个完整 JSON 对象
    //    比正则更可靠，能正确处理任意深度的嵌套
    const firstBrace = content.indexOf('{');
    if (firstBrace >= 0) {
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = firstBrace; i < content.length; i++) {
            const ch = content[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    try {
                        const fixed = fixJsonString(content.substring(firstBrace, i + 1));
                        return JSON.parse(fixed) as T;
                    } catch {
                        break; // 括号匹配上了但 JSON 仍不合法，放弃
                    }
                }
            }
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
    // confidence 历史上存在 0-100 与 0-1 两种口径，统一归一化到 0-1 再比较
    if (faceAnalysis?.skinType?.type) {
        const conf = faceAnalysis.skinType.confidence;
        const normalizedConf = conf > 1 ? conf / 100 : conf;
        if (normalizedConf >= 0.7) {
            return faceAnalysis.skinType.type;
        }
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
    // 问题线统一为 70：与报告重点问题（<70）、内部报告 issues（<70）口径一致
    if (faceAnalysis?.dimensions) {
        if (faceAnalysis.dimensions.wrinkles?.score < 70) concerns.add("wrinkles");
        if (faceAnalysis.dimensions.spots?.score < 70) concerns.add("spots");
        if (faceAnalysis.dimensions.waterOil?.score < 70) concerns.add("waterOil");
        if (faceAnalysis.dimensions.acne?.score < 70) concerns.add("acne");
        if (faceAnalysis.dimensions.uvDamage?.score < 70) concerns.add("anti_aging");
        if (faceAnalysis.dimensions.sensitivity?.score < 70) concerns.add("sensitivity");
        if (faceAnalysis.dimensions.radiance?.score < 70) concerns.add("dullness");
        if (faceAnalysis.dimensions.darkCircles?.score < 70) concerns.add("dark_circles");
        if (faceAnalysis.dimensions.firmness?.score < 70) concerns.add("anti_aging");
        if (faceAnalysis.dimensions.skinTone?.score < 70) concerns.add("dullness");
    }

    // 4. 检查区域分析中的各维度异常指标 (6 大区域 × 8 维指标)
    // 区域指标统一「越高越好」（与视觉 prompt 口径一致），低分代表问题
    if (faceAnalysis?.zoneAnalysis) {
        const zones = [
            faceAnalysis.zoneAnalysis.forehead,
            faceAnalysis.zoneAnalysis.tZone,
            faceAnalysis.zoneAnalysis.leftCheek,
            faceAnalysis.zoneAnalysis.rightCheek,
            faceAnalysis.zoneAnalysis.eyeArea,
            faceAnalysis.zoneAnalysis.jawline,
        ];
        // 细腻度偏低 → roughness
        if (zones.some(z => z.texture !== undefined && z.texture < 50)) concerns.add("roughness");
        // 水油平衡健康度偏低 → oil_control
        if (zones.some(z => z.oil !== undefined && z.oil < 40)) concerns.add("oil_control");
        // 无纹程度偏低 → wrinkles
        if (zones.some(z => z.wrinkles !== undefined && z.wrinkles < 50)) concerns.add("wrinkles");
        // 无色斑程度偏低 → spots
        if (zones.some(z => z.spots !== undefined && z.spots < 50)) concerns.add("spots");
        // 无泛红程度偏低 → sensitivity
        if (zones.some(z => z.redness !== undefined && z.redness < 50)) concerns.add("sensitivity");
        // 眼周状态偏低 → dark_circles (眼周区域特有)
        if (faceAnalysis.zoneAnalysis.eyeArea?.darkCircles !== undefined && faceAnalysis.zoneAnalysis.eyeArea.darkCircles < 50) {
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

// ============================================================================
// AI 输出 JSON 结构验证（Zod）
// ============================================================================

const DimensionScoreSchema = z.object({
    score: z.number().optional(),
    percentile: z.number().optional(),
    grade: z.enum(["excellent", "good", "average", "fair", "poor"]).optional(),
    details: z.string().optional(),
    blackheads: z.number().optional(),
    pimples: z.number().optional(),
});

const ZoneDataSchema = z.object({
    condition: z.string().optional(),
    advice: z.string().optional(),
    oil: z.number().optional(),
    texture: z.number().optional(),
    wrinkles: z.number().optional(),
    spots: z.number().optional(),
    redness: z.number().optional(),
    darkCircles: z.number().optional(),
    firmness: z.number().optional(),
    contour: z.number().optional(),
}).passthrough();

export const VisionAnalysisOutputSchema = z.object({
    validation: z.object({
        isValid: z.boolean(),
        message: z.string().optional(),
    }).optional(),
    skinType: z.object({
        type: z.string(),
        confidence: z.number().optional(),
        description: z.string().optional(),
    }).optional(),
    gender: z.object({
        value: z.enum(["male", "female"]),
        confidence: z.number().optional(),
    }).optional(),
    skinAge: z.object({
        estimated: z.number().optional(),
        factors: z.array(z.string()).optional(),
    }).optional(),
    dimensions: z.record(z.string(), DimensionScoreSchema).optional(),
    overallScore: z.number().optional(),
    summary: z.string().optional(),
    recommendations: z.array(z.string()).optional(),
    skinConditions: z.array(z.object({
        condition: z.string(),
        severity: z.enum(["mild", "moderate", "severe"]).optional(),
        area: z.string().optional(),
        description: z.string().optional(),
    })).optional(),
    zoneAnalysis: z.object({
        forehead: ZoneDataSchema,
        tZone: ZoneDataSchema,
        leftCheek: ZoneDataSchema,
        rightCheek: ZoneDataSchema,
        eyeArea: ZoneDataSchema,
        jawline: ZoneDataSchema,
    }).optional(),
    labAnalysis: z.object({
        glogau: z.object({ value: z.string(), status: z.string() }).optional(),
        homogeneity: z.object({ value: z.number().optional(), unit: z.string().optional(), range: z.string().optional(), status: z.string() }).optional(),
        wrinkleGrade: z.object({ value: z.string(), status: z.string() }).optional(),
    }).optional(),
}).passthrough();

/**
 * 顾问叙事报告（Report v2）输出 Schema
 *
 * 报告结构为"推理链"——每个问题必须走完 观察（证据）→ 直接/间接诱因 → 护理/生活方案 → 就医边界。
 * issues 动态数量：只报告有证据的问题，证据不足宁可不报（0-4，与 prompt 约束一致）。
 */
export const ConsultantIssueSchema = z.object({
    title: z.string().min(1),
    severity: z.enum(["mild", "moderate", "severe"]),
    observation: z.string().min(1),
    directCauses: z.string().min(1),
    indirectCauses: z.string().min(1),
    skincarePlan: z.string().min(1),
    lifestylePlan: z.string().min(1),
    medicalBoundary: z.string().min(1),
    relatedDimensions: z.array(z.string()).default([]),
}).passthrough();

export const ConsultantReportSchema = z.object({
    overview: z.string().min(1),
    issues: z.array(ConsultantIssueSchema).max(4),
    strengths: z.array(z.string()).default([]),
    routineNote: z.string().optional(),
    productReasons: z.array(z.object({
        id: z.union([z.string(), z.number()]),
        reason: z.string().optional(),
    }).passthrough()).optional(),
}).passthrough();

export type ConsultantIssue = z.infer<typeof ConsultantIssueSchema>;
export type ConsultantReport = z.infer<typeof ConsultantReportSchema>;

/**
 * 程序字段名 → 中文标签。AI 可能在正文里引用原始字段名（如"tZone""waterOil"），
 * 即使 prompt 禁止也难以百分百杜绝，落库前做防御性替换。
 * 只收录机器 key 形态（camelCase / 下划线 / 点号）的字段名；
 * acne、spots、firmness 等本身是合法英文单词的 key 不收录，避免误伤正常英文文本。
 */
const RAW_KEY_LABELS: Record<string, string> = {
    tZone: "T区", leftCheek: "左脸颊", rightCheek: "右脸颊",
    eyeArea: "眼周", jawline: "下颌线",
    waterOil: DIMENSION_LABELS.waterOil,
    skinTone: DIMENSION_LABELS.skinTone,
    uvDamage: DIMENSION_LABELS.uvDamage,
    darkCircles: DIMENSION_LABELS.darkCircles,
};

/** 替换文本中出现的英文字段名为中文标签（整词替换，连字符邻接也不算整词，不误伤成分英文名） */
export function sanitizeConsultantText(text: string): string {
    let out = text;
    for (const [key, label] of Object.entries(RAW_KEY_LABELS)) {
        out = out.replace(new RegExp(`(?<![a-zA-Z-])${key}(?![a-zA-Z-])`, "g"), label);
    }
    return out;
}

/** 深度清洗顾问报告的所有文本字段（title/六段推理链/strengths/routineNote/productReasons.reason） */
export function sanitizeConsultantReport(report: ConsultantReport): ConsultantReport {
    return {
        ...report,
        overview: sanitizeConsultantText(report.overview),
        issues: report.issues.map((issue) => ({
            ...issue,
            title: sanitizeConsultantText(issue.title),
            observation: sanitizeConsultantText(issue.observation),
            directCauses: sanitizeConsultantText(issue.directCauses),
            indirectCauses: sanitizeConsultantText(issue.indirectCauses),
            skincarePlan: sanitizeConsultantText(issue.skincarePlan),
            lifestylePlan: sanitizeConsultantText(issue.lifestylePlan),
            medicalBoundary: sanitizeConsultantText(issue.medicalBoundary),
        })),
        strengths: report.strengths.map(sanitizeConsultantText),
        routineNote: report.routineNote ? sanitizeConsultantText(report.routineNote) : report.routineNote,
        productReasons: report.productReasons?.map((p) => ({
            ...p,
            reason: p.reason ? sanitizeConsultantText(p.reason) : p.reason,
        })),
    };
}

/**
 * 解析顾问叙事报告（v2）：提取 JSON → 归一化 → schema 校验。
 *
 * 归一化步骤容忍模型的常见输出偏差，避免整份报告因小瑕疵降级为 v1：
 * - severity 中英文/大小写归一（"轻度"/"Mild" → mild），缺省 moderate
 * - 缺失/空字符串的推理链字段补默认值（medicalBoundary 补"暂不需要就医"）
 * - 缺 title/observation 的 issue 整条丢弃（没有观察就没有证据，不符合铁律）
 * - relatedDimensions / strengths 缺省为空数组
 */
export function parseConsultantReport(content: string): ConsultantReport {
    const raw = extractJsonFromResponse<Record<string, unknown>>(content);

    const severityMap: Record<string, ConsultantIssue["severity"]> = {
        mild: "mild", moderate: "moderate", severe: "severe",
        "轻度": "mild", "轻微": "mild", "中度": "moderate", "重度": "severe", "严重": "severe",
    };

    const normalizedIssues = (Array.isArray(raw.issues) ? raw.issues : [])
        .filter((i): i is Record<string, unknown> =>
            !!i && typeof i === "object"
            && typeof (i as Record<string, unknown>).title === "string"
            && typeof (i as Record<string, unknown>).observation === "string")
        .map((i) => {
            const issue = { ...i };
            const sev = String(issue.severity ?? "").trim().toLowerCase();
            issue.severity = severityMap[sev] ?? severityMap[String(issue.severity ?? "").trim()] ?? "moderate";
            if (typeof issue.directCauses !== "string" || !issue.directCauses) issue.directCauses = "详见上方观察。";
            if (typeof issue.indirectCauses !== "string" || !issue.indirectCauses) issue.indirectCauses = "目前没有明显的生活习惯诱因。";
            if (typeof issue.skincarePlan !== "string" || !issue.skincarePlan) issue.skincarePlan = "详见每日方案。";
            if (typeof issue.lifestylePlan !== "string" || !issue.lifestylePlan) issue.lifestylePlan = "详见每日方案。";
            if (typeof issue.medicalBoundary !== "string" || !issue.medicalBoundary) issue.medicalBoundary = "暂不需要就医，坚持护理观察即可。";
            if (!Array.isArray(issue.relatedDimensions)) issue.relatedDimensions = [];
            return issue;
        })
        // prompt 约束 0-4 个问题：模型偶尔多写时截断而不是整报告失败
        .slice(0, 4);

    const normalized = {
        ...raw,
        issues: normalizedIssues,
        strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    };

    const parsed = ConsultantReportSchema.safeParse(normalized);
    if (!parsed.success) {
        throw new Error(`AI response schema validation failed: ${parsed.error.message}`);
    }
    return parsed.data;
}

/**
 * 安全提取并校验 AI 返回的 JSON
 * @param content - AI 原始文本
 * @param schema - Zod 校验 schema
 * @returns 校验通过的解析结果
 * @throws 若无法解析或校验失败
 */
export function validateAndExtractJson<T>(content: string, schema: z.ZodType<T>): T {
    const raw = extractJsonFromResponse<unknown>(content);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
        throw new Error(`AI response schema validation failed: ${parsed.error.message}`);
    }
    return parsed.data;
}

// Note: Product recommendation logic has been moved to src/lib/recommendations.ts
// The matchProducts() mock function has been removed in favor of the real
// recommendation engine (recommendProducts / getCandidateProducts).

