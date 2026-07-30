/**
 * 纯问卷模式专用逻辑（与面部扫描流程完全隔离）
 *
 * 使用场景：用户在首页选择"看看你属于哪一派"后，
 * 通过问卷答案合成评分，利用 IP_DEFINITIONS 匹配全部 8 种派系，
 * 最终路由至 /skin-types/{route} 介绍页。
 *
 * ⚠️ 本文件不修改 advisor-utils.ts 中的 determineSkinType 等核心函数。
 */

import type { Question } from "@/config/questions";
import { matchCharacterIP, type IPMatchParams } from "@/lib/result-utils";
import { skinTypes } from "@/lib/result-content";

// ============================================================================
// 1. 额外问题（仅纯问卷模式展示，fieldName 使用 q_ 前缀避免冲突）
// ============================================================================

export const QUESTIONNAIRE_ONLY_QUESTIONS: Question[] = [
    {
        id: "q_skincareAttitude",
        fieldName: "q_skincareAttitude",
        question: "你的护肤哲学更接近哪种？",
        type: "single",
        options: [
            { value: "minimal", label: "Less is More", description: "精简高效，少即是多" },
            { value: "explorer", label: "成分党", description: "喜欢研究成分，什么都想试" },
            { value: "ritual", label: "仪式感", description: "护肤是一种享受和自我宠爱" },
            { value: "lazy", label: "不麻烦就行", description: "能省一步是一步" },
        ],
    },
    {
        id: "q_selfRating",
        fieldName: "q_selfRating",
        question: "给自己的皮肤状态打分，你会给多少？",
        type: "single",
        options: [
            { value: "great", label: "90+ 非常好", description: "基本没大问题" },
            { value: "good", label: "70-89 还不错", description: "有些小瑕疵" },
            { value: "average", label: "50-69 一般般", description: "有明显困扰" },
            { value: "poor", label: "50 以下", description: "不太满意，急需改善" },
        ],
    },
    {
        id: "q_skincareMotivation",
        fieldName: "q_skincareMotivation",
        question: "驱动你认真护肤的最大动力是什么？",
        type: "single",
        options: [
            { value: "antiAging", label: "延缓衰老", description: "想比同龄人看起来年轻" },
            { value: "confidence", label: "增强自信", description: "素颜也能大方出门" },
            { value: "social", label: "社交形象", description: "工作/社交需要" },
            { value: "selfCare", label: "自我宠爱", description: "纯粹享受照顾自己的过程" },
        ],
    },
];

// ============================================================================
// 2. 评分算法：从问卷答案合成 0-100 分数
// ============================================================================

/** 安全地将值转为字符串，处理单选（string）和多选（string[]）两种类型 */
function asString(val: unknown): string {
    if (typeof val === "string") return val;
    if (Array.isArray(val) && val.length > 0) return String(val[0]);
    return "";
}

function asArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === "string" && val) return [val];
    return [];
}

export function computeQuestionnaireScore(answers: Record<string, unknown>): number {
    // 问卷自评分数天然比 AI 视觉分析偏高（用户倾向乐观估计）。
    // 因此基线值整体下移约 10 分，修正幅度减半，使分布更贴近 AI 评分真实区间。
    let score = 65; // 中位基线

    // --- 肤质基线 ---
    const skinType = asString(answers.skinType || answers["skinType"]).toLowerCase();
    const skinTypeBase: Record<string, number> = {
        normal: 78,
        dry: 72,
        oily: 66,
        combination_dry: 74,
        combination_oily: 70,
        combination: 72,
        sensitive: 62,
    };
    score = skinTypeBase[skinType] ?? 65;

    // --- 护肤频率 ---
    const freq = asString(answers.skincareFrequency).toLowerCase();
    const freqMod: Record<string, number> = { daily: 6, regular: 4, occasional: -3, rarely: -10 };
    score += freqMod[freq] ?? 0;

    // --- 睡眠质量 ---
    const sleep = asString(answers.sleepQuality).toLowerCase();
    const sleepMod: Record<string, number> = { good: 3, fair: 0, poor: -8 };
    score += sleepMod[sleep] ?? 0;

    // --- 压力水平 ---
    const stress = asString(answers.stressLevel).toLowerCase();
    const stressMod: Record<string, number> = { low: 3, medium: 0, high: -8 };
    score += stressMod[stress] ?? 0;

    // --- 年龄 ---
    const age = asString(answers.ageRange).toLowerCase();
    const ageMod: Record<string, number> = { under20: 4, "20-25": 4, "26-30": 2, "31-40": 0, "41-50": -2, above50: -4 };
    score += ageMod[age] ?? 0;

    // --- 困扰数量（问题越多分数越低）---
    const concerns = asArray(answers.primaryConcern);
    score -= concerns.length * 2;

    // --- 自评分（额外问题）---
    const selfRating = asString(answers.q_selfRating).toLowerCase();
    const selfMod: Record<string, number> = { great: 10, good: 5, average: -3, poor: -10 };
    score += selfMod[selfRating] ?? 0;

    // --- 护肤哲学（额外问题）---
    // 反映护肤投入度而非皮肤状态，用小权重避免过度影响
    const attitude = asString(answers.q_skincareAttitude).toLowerCase();
    const attitudeMod: Record<string, number> = {
        ritual: 3,    // 仪式感 → 规律护理，小幅加分
        explorer: 2,  // 成分党 → 主动学习研究
        minimal: -2,  // 精简高效 → 自然状态
        lazy: -4,     // 疏于护理 → 小幅扣分
    };
    score += attitudeMod[attitude] ?? 0;

    // --- 护肤动力（额外问题）---
    const motivation = asString(answers.q_skincareMotivation).toLowerCase();
    const motivationMod: Record<string, number> = {
        antiAging: 2,   // 延缓衰老 → 目标明确，积极护理
        selfCare: 2,    // 自我宠爱 → 持续投入
        confidence: 1,  // 增强自信 → 正面心态
        social: 0,      // 社交形象 → 中性
    };
    score += motivationMod[motivation] ?? 0;

    return Math.max(5, Math.min(98, Math.round(score)));
}

// ============================================================================
// 3. ipKey → route 映射表（从 result-content.json 构建）
// ============================================================================

const IP_KEY_TO_ROUTE: Record<string, string> = {};
for (const t of skinTypes) {
    IP_KEY_TO_ROUTE[t.ipKey] = t.route;
}

// ============================================================================
// 4. 派系匹配入口
// ============================================================================

export interface QuestionnairePersonaResult {
    /** /skin-types/ 下的路由片段，如 "jijianpai" */
    route: string;
    /** IP 中文名，如 "极简派" */
    name: string;
    /** 合成评分 0-100 */
    score: number;
}

/**
 * 根据纯问卷答案匹配派系，返回路由和名称。
 * 复用 result-utils.ts 中的 matchCharacterIP + IP_DEFINITIONS 完整匹配链，
 * 覆盖全部 8 种派系。
 *
 * @param answers  用户完成的全部问卷答案（含额外问题）
 * @returns         匹配结果；未匹配时兜底返回空 route（调用方跳转 /skin-types）
 */
export function matchQuestionnairePersona(
    answers: Record<string, unknown>
): QuestionnairePersonaResult {
    const score = computeQuestionnaireScore(answers);
    const skinType = asString(answers.skinType || answers["skinType"]).toLowerCase();
    const budget = asString(answers.budget).toLowerCase();
    const skincareFrequency = asString(answers.skincareFrequency).toLowerCase();

    const params: IPMatchParams = {
        score,
        skinType: skinType || "normal",
        budget: budget || undefined,
        skincareFrequency: skincareFrequency || undefined,
    };

    const ip = matchCharacterIP(params);
    const route = IP_KEY_TO_ROUTE[ip.key] ?? "";

    return { route, name: ip.name, score };
}
