/**
 * 生成「给护肤顾问的报告摘要」文本
 *
 * 复制文本只包含用户主动填写的问卷信息（昵称/性别/年龄段/关注问题/医美经历/护肤习惯），
 * 便于用户一键复制粘贴给微信客服（企业微信护肤顾问），AI 可直接解析为档案。
 */
import { DIMENSION_LABELS } from "@/lib/advisor-utils";
import type { ComprehensiveResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

/** 护肤顾问微信客服链接（kfid 对应企业微信客服「护肤顾问」账号） */
export const ADVISOR_WECOM_LINK = "https://work.weixin.qq.com/kfid/kfc7834894b7ee2b86a";

const ISSUE_ORDER = [
    "waterOil",
    "skinTone",
    "spots",
    "wrinkles",
    "uvDamage",
    "sensitivity",
    "darkCircles",
    "firmness",
    "acne",
    "radiance",
];

/**
 * 问卷答案值 → 中文标签映射。
 * 覆盖 DEFAULT_QUESTIONS（src/config/questions.ts）的全部选项值，
 * 并兼容 ai-prompts.ts 旧版/DB 题库的取值（如 basic/moderate/advanced）。
 * 未命中时回退为原始值，保证 DB 自定义题库新增选项时不会丢信息。
 */
const AGE_RANGE_LABELS: Record<string, string> = {
    under20: "20岁以下",
    "20-25": "20-25岁",
    "26-30": "26-30岁",
    "31-40": "31-40岁",
    "41-50": "41-50岁",
    above50: "50岁以上",
};

const CONCERN_LABELS: Record<string, string> = {
    aging: "细纹/松弛",
    acne: "痘痘/粉刺",
    spots: "色斑/暗沉",
    dryness: "干燥缺水",
    sensitivity: "敏感/泛红",
    dark_circles: "黑眼圈/眼袋",
};

const PREGNANCY_LABELS: Record<string, string> = {
    no: "否",
    yes: "是",
    unknown: "不确定",
};

const MEDICAL_BEAUTY_LABELS: Record<string, string> = {
    none: "无",
    laser: "光子/激光类",
    acid: "刷酸/焕肤类",
    injection: "注射/微针类",
};

const SLEEP_LABELS: Record<string, string> = {
    good: "很好（精力充沛）",
    fair: "一般（偶尔疲劳）",
    poor: "较差（经常熬夜/失眠）",
};

const STRESS_LABELS: Record<string, string> = {
    low: "轻松（无明显压力）",
    medium: "适中（有一定压力）",
    high: "很大（焦虑/紧绷）",
};

const MENSTRUAL_LABELS: Record<string, string> = {
    na: "不适用",
    menstrual: "经期中（第1-7天）",
    follicular: "滤泡期（经后一周）",
    luteal: "黄体期（经前一周）",
};

const ALLERGY_LABELS: Record<string, string> = {
    none: "无过敏史",
    fragrance: "香精过敏",
    alcohol: "酒精过敏",
    acids: "酸类不耐受",
    multiple: "多种过敏",
    unknown: "不太清楚",
};

const SKINCARE_FREQ_LABELS: Record<string, string> = {
    daily: "每天精细护肤",
    regular: "经常护肤",
    occasional: "偶尔护肤",
    rarely: "几乎不护肤",
    basic: "简单护理（洁面+保湿）",
    moderate: "中等护理（精华+防晒）",
    advanced: "精细护理（多步骤）",
};

const BUDGET_LABELS: Record<string, string> = {
    budget: "追求性价比（单品500元以内）",
    mid: "中等预算（单品300-1000元）",
    premium: "品质优先（单品800-2000元）",
    luxury: "不设上限",
};

const WATER_LABELS: Record<string, string> = {
    low: "偏少（<4杯/天）",
    medium: "适中（4-8杯/天）",
    high: "充足（>8杯/天）",
};

const EXERCISE_LABELS: Record<string, string> = {
    low: "较少（几乎不运动）",
    medium: "适中（每周1-3次）",
    high: "充足（每周>3次）",
};

const DIET_LABELS: Record<string, string> = {
    balanced: "均衡饮食",
    highSugar: "偏甜/高糖",
    highOil: "偏油/高脂",
    spicy: "偏好辛辣",
};

const SUN_LABELS: Record<string, string> = {
    low: "较少户外活动",
    medium: "日常通勤暴露",
    high: "经常户外暴晒",
};

export interface AdvisorReportTextParams {
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
    gender: string;
    nickname?: string;
    /** 问卷答案（键为题目 fieldName）。摘要只取年龄段/关注问题/医美经历/护肤习惯 */
    answers?: Record<string, unknown> | null;
}

export interface ReportIssue {
    label: string;
    score: number;
}

/** 单个维度的评分项（内部 API 返回完整十维时使用） */
export interface DimensionScoreItem {
    key: string;
    label: string;
    score: number;
}

/**
 * 已标签化的问卷档案（内部 API 与复制文本共用，保证两个通道口径一致）。
 * 所有字段均为中文展示文本；未作答的字段为 undefined。
 */
export interface QuestionnaireProfile {
    /** 年龄段（如 "26-30岁"） */
    ageRange?: string;
    /** 用户主诉（如 ["细纹/松弛", "色斑/暗沉"]） */
    primaryConcerns?: string[];
    /** 过敏史（如 ["香精过敏"]；含 "无过敏史"/"不太清楚"） */
    allergies?: string[];
    /** 备孕/孕期/哺乳期（"是" / "否" / "不确定"） */
    pregnancy?: string;
    /** 近三个月医美经历 */
    medicalBeauty?: string;
    sleepQuality?: string;
    stressLevel?: string;
    menstrualCycle?: string;
    waterIntake?: string;
    exerciseFrequency?: string;
    dietaryHabits?: string;
    sunExposure?: string;
    skincareFrequency?: string;
    budget?: string;
}

function asStringArray(value: unknown): string[] {
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    }
    return [];
}

function mapLabel(value: unknown, labels: Record<string, string>): string | undefined {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const v = value.trim();
    return labels[v] ?? v;
}

/**
 * 从问卷答案中提取并标签化顾问档案。
 * 键名兼容两代题库：pregnancy / pregnancyStatus 均识别为孕期状态。
 */
export function extractQuestionnaireProfile(
    answers: Record<string, unknown> | null | undefined
): QuestionnaireProfile {
    if (!answers || typeof answers !== "object") return {};

    const concerns = asStringArray(answers.primaryConcern).map((v) => CONCERN_LABELS[v] ?? v);
    const allergies = asStringArray(answers.allergies).map((v) => ALLERGY_LABELS[v] ?? v);
    const pregnancyRaw = answers.pregnancy ?? answers.pregnancyStatus;

    const profile: QuestionnaireProfile = {
        ageRange: mapLabel(answers.ageRange, AGE_RANGE_LABELS),
        primaryConcerns: concerns.length > 0 ? concerns : undefined,
        allergies: allergies.length > 0 ? allergies : undefined,
        pregnancy: mapLabel(pregnancyRaw, PREGNANCY_LABELS),
        medicalBeauty: mapLabel(answers.medicalBeauty, MEDICAL_BEAUTY_LABELS),
        sleepQuality: mapLabel(answers.sleepQuality, SLEEP_LABELS),
        stressLevel: mapLabel(answers.stressLevel, STRESS_LABELS),
        menstrualCycle: mapLabel(answers.menstrualCycle, MENSTRUAL_LABELS),
        waterIntake: mapLabel(answers.waterIntake, WATER_LABELS),
        exerciseFrequency: mapLabel(answers.exerciseFrequency, EXERCISE_LABELS),
        dietaryHabits: mapLabel(answers.dietaryHabits, DIET_LABELS),
        sunExposure: mapLabel(answers.sunExposure, SUN_LABELS),
        skincareFrequency: mapLabel(answers.skincareFrequency, SKINCARE_FREQ_LABELS),
        budget: mapLabel(answers.budget, BUDGET_LABELS),
    };

    // 清理空值，避免内部 API 返回一堆 undefined 键
    for (const key of Object.keys(profile) as (keyof QuestionnaireProfile)[]) {
        if (profile[key] === undefined) delete profile[key];
    }
    return profile;
}

/** 提取全部维度评分（按 ISSUE_ORDER 顺序，内部 API 返回完整十维用） */
export function getDimensionScores(
    dimensions: Record<string, { score?: number } | undefined> | undefined
): DimensionScoreItem[] {
    if (!dimensions || Object.keys(dimensions).length === 0) return [];
    return ISSUE_ORDER
        .map((key) => ({ key, score: dimensions[key]?.score }))
        .filter((d): d is { key: string; score: number } => typeof d.score === "number")
        .map((d) => ({ key: d.key, label: DIMENSION_LABELS[d.key] ?? d.key, score: d.score }));
}

/** 从十维分析中提取重点问题（<70 分，按分数升序，最多 3 个） */
export function getIssueList(
    dimensions: Record<string, { score?: number } | undefined> | undefined
): ReportIssue[] {
    if (!dimensions || Object.keys(dimensions).length === 0) return [];
    return ISSUE_ORDER
        .map((key) => ({ key, score: dimensions[key]?.score }))
        .filter((d): d is { key: string; score: number } => typeof d.score === "number")
        .sort((a, b) => a.score - b.score)
        .filter((d) => d.score < 70)
        .slice(0, 3)
        .map((d) => ({ label: DIMENSION_LABELS[d.key] ?? d.key, score: d.score }));
}

/**
 * 生成可复制的顾问报告摘要文本。
 * 每行一个字段，避免长段落，方便 AI 顾问按字段解析。
 * 只包含用户问卷主动填写的信息：昵称/性别/年龄段/关注问题/医美经历/护肤习惯，
 * 不带评分、肤质、过敏史等系统分析结果。
 */
export function buildAdvisorReportText({
    gender,
    nickname,
    answers,
}: AdvisorReportTextParams): string {
    const lines: string[] = ["【肌智派测肤报告】"];
    const profile = extractQuestionnaireProfile(answers);

    if (nickname && nickname.trim() && nickname.trim() !== "您") {
        lines.push(`昵称：${nickname.trim()}`);
    }
    if (gender) {
        lines.push(`性别：${gender === "male" ? "男" : "女"}`);
    }
    if (profile.ageRange) {
        lines.push(`年龄段：${profile.ageRange}`);
    }
    if (profile.primaryConcerns && profile.primaryConcerns.length > 0) {
        lines.push(`关注问题：${profile.primaryConcerns.join("、")}`);
    }
    if (profile.medicalBeauty && profile.medicalBeauty !== "无") {
        lines.push(`医美经历（近3月）：${profile.medicalBeauty}`);
    }
    if (profile.skincareFrequency) {
        lines.push(`护肤习惯：${profile.skincareFrequency}`);
    }

    return lines.join("\n");
}
