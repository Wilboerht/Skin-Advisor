/**
 * 根据综合评分计算全国排名百分比（连续幂函数曲线）
 *
 * 使用幂函数模拟真实分布：低分段拉开差距，高分段逐渐饱和。
 * 曲线示例：score=30→45% | 50→68% | 70→86% | 85→95% | 95→99%
 * 幂指数 1.6 控制曲率：指数越大，高分段越密集。
 */
export function getRankPercentile(score: number): number {
    if (score >= 98) return 99;
    if (score <= 5) return 1;
    const percentile = Math.round(100 - Math.pow((100 - score) / 100, 1.6) * 98);
    return Math.max(1, Math.min(99, percentile));
}

/**
 * 根据水油维度分数返回 T 区标签
 */
export function getTZoneLabel(waterOilScore: number): string {
    if (waterOilScore >= 80) return 'T区平衡';
    if (waterOilScore >= 60) return 'T区略油';
    return 'T区偏油';
}

// ============================================================================
// 新版 IP 角色体系 (8 派)
// ============================================================================

/** IP 角色定义 */
export interface CharacterIP {
    key: string;       // 英文标识，用于图片路径
    name: string;      // 中文显示名称
    priority: number;  // 匹配优先级 (越小越高)
    match: (params: IPMatchParams) => boolean;
}

export interface IPMatchParams {
    score: number;            // AI 综合评分 0-100
    skinType: string;         // 肤质类型: dry | oily | combination_dry | combination_oily | combination | sensitive | normal
    budget?: string;          // 预算: budget | mid | premium | luxury
    skincareFrequency?: string; // 护肤频率: daily | regular | occasional | rarely
}

/** 8 派定义（按优先级排序） */
const IP_DEFINITIONS: CharacterIP[] = [
    {
        key: "sensitive",
        name: "敏敏派",
        priority: 0,
        match: ({ skinType }) => skinType === "sensitive",
    },
    {
        key: "minimalist",
        name: "极简派",
        priority: 1,
        match: ({ skinType, budget, skincareFrequency, score }) =>
            skinType !== "sensitive" &&
            score < 95 &&
            budget === "budget" &&
            (skincareFrequency === "occasional" || skincareFrequency === "rarely"),
    },
    {
        key: "luxury",
        name: "奢华派",
        priority: 2,
        match: ({ score }) => score >= 95,
    },
    {
        key: "ageless",
        name: "冻龄派",
        priority: 3,
        match: ({ score }) => score >= 90 && score <= 94,
    },
    {
        key: "desert",
        name: "沙漠派",
        priority: 4,
        match: ({ skinType }) => skinType === "dry",
    },
    {
        key: "oily",
        name: "油条派",
        priority: 4,
        match: ({ skinType }) => skinType === "oily",
    },
    {
        key: "combination",
        name: "混合派",
        priority: 4,
        match: ({ skinType }) =>
            ["combination_dry", "combination_oily", "combination"].includes(skinType),
    },
    {
        key: "guardian",
        name: "守护派",
        priority: 5,
        // 2026-09 派系文案改版：守护派定位为「底子稳定 · 预防维稳」，与稳定均衡的 normal 肤质对应；
        // 低分（≤70）不再统一归守护派，而是按肤质落到各自派系（干→沙漠、油→油条、混→混合、敏感→敏敏）
        match: ({ skinType }) => skinType === "normal",
    },
];

/** 对优先级排序 */
const SORTED_IPS = [...IP_DEFINITIONS].sort((a, b) => a.priority - b.priority);

/**
 * 归一化肤质类型：AI 可能返回大小写变体或中文描述（"Dry"、"干性"、"混油皮"），
 * 统一映射到 dry | oily | combination | combination_dry | combination_oily | sensitive | normal，
 * 无法识别时返回空串，由分数兜底逻辑接管
 */
function normalizeSkinType(raw: string | undefined): string {
    const value = (raw || "").trim().toLowerCase();
    if (!value) return "";
    if (/混合|混干|混油|combination|mixed|combo/.test(value) || (value.includes("油") && value.includes("干")) || /t\s?区|t-zone/.test(value)) {
        if (/干|dry/.test(value)) return "combination_dry";
        if (/油|oil/.test(value)) return "combination_oily";
        return "combination";
    }
    if (/敏感|sensitive/.test(value)) return "sensitive";
    if (/干|dry/.test(value)) return "dry";
    if (/油|oil/.test(value)) return "oily";
    if (/中性|normal/.test(value)) return "normal";
    return value;
}

/**
 * 根据综合条件匹配角色 IP
 * 按优先级依次匹配，返回第一个命中的 IP
 */
export function matchCharacterIP(params: IPMatchParams): CharacterIP {
    const normalized = { ...params, skinType: normalizeSkinType(params.skinType) };
    for (const ip of SORTED_IPS) {
        if (ip.match(normalized)) {
            return ip;
        }
    }
    // 肤质无法识别时兜底到最普遍的中性类型（混合派），不按分数分档：
    // 守护派已改为「底子稳定 · 预防维稳」定位，不再承接低分兜底
    return IP_DEFINITIONS.find((ip) => ip.key === "combination")!;
}

/**
 * 根据匹配参数和性别获取角色插图路径
 * @returns 角色图片路径，如 "/images/character/ageless/ageless_female.webp"
 */
export function getCharacterImage(params: IPMatchParams & { gender: string }): string {
    const ip = matchCharacterIP(params);
    const genderSuffix = params.gender === "male" ? "male" : "female";
    return `/images/character/${ip.key}/${ip.key}_${genderSuffix}.webp`;
}

/**
 * 根据匹配参数获取肌肤类型名称（IP 中文名）
 */
export function getSkinTypeName(params: IPMatchParams): string {
    const ip = matchCharacterIP(params);
    return ip.name;
}
