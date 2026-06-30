/**
 * 根据综合评分计算全国排名百分比
 */
export function getRankPercentile(score: number): number {
    const scoreToPercentile: { min: number; max: number; percentile: number }[] = [
        { min: 90, max: 99, percentile: 95 },
        { min: 80, max: 89, percentile: 90 },
        { min: 75, max: 79, percentile: 85 },
        { min: 70, max: 74, percentile: 80 },
        { min: 65, max: 69, percentile: 74 },
        { min: 60, max: 64, percentile: 68 },
        { min: 55, max: 59, percentile: 62 },
        { min: 45, max: 54, percentile: 55 },
        { min: 35, max: 44, percentile: 45 },
        { min: 25, max: 34, percentile: 35 },
        { min: 15, max: 24, percentile: 25 },
        { min: 0, max: 14, percentile: 15 },
    ];
    const match = scoreToPercentile.find((r) => score >= r.min && score <= r.max);
    return match ? match.percentile : 75;
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
        match: ({ score, skinType }) =>
            score >= 71 && score <= 89 && skinType === "dry",
    },
    {
        key: "oily",
        name: "油条派",
        priority: 4,
        match: ({ score, skinType }) =>
            score >= 71 && score <= 89 && skinType === "oily",
    },
    {
        key: "combination",
        name: "混合派",
        priority: 4,
        match: ({ score, skinType }) =>
            score >= 71 && score <= 89 &&
            ["combination_dry", "combination_oily", "combination", "normal"].includes(skinType),
    },
    {
        key: "guardian",
        name: "守护派",
        priority: 5,
        match: ({ score }) => score <= 70, // 含 <60 兜底
    },
];

/** 对优先级排序 */
const SORTED_IPS = [...IP_DEFINITIONS].sort((a, b) => a.priority - b.priority);

/**
 * 根据综合条件匹配角色 IP
 * 按优先级依次匹配，返回第一个命中的 IP
 */
export function matchCharacterIP(params: IPMatchParams): CharacterIP {
    for (const ip of SORTED_IPS) {
        if (ip.match(params)) {
            return ip;
        }
    }
    // 最终兜底：守护派
    return IP_DEFINITIONS[IP_DEFINITIONS.length - 1];
}

/** 部分 IP 仅有 female 图片，male 缺失时回退 */
const MALE_MISSING_KEYS = ["sensitive", "minimalist", "desert", "oily", "combination", "guardian"];

/**
 * 根据匹配参数和性别获取角色插图路径
 * @returns 角色图片路径，如 "/images/character/ageless/ageless_female.png"
 */
export function getCharacterImage(params: IPMatchParams & { gender: string }): string {
    const ip = matchCharacterIP(params);
    const actualGender = params.gender === "male" && MALE_MISSING_KEYS.includes(ip.key)
        ? "female"
        : params.gender;
    const genderSuffix = actualGender === "male" ? "male" : "female";
    return `/images/character/${ip.key}/${ip.key}_${genderSuffix}.png`;
}

/**
 * 根据匹配参数获取肌肤类型名称（IP 中文名）
 */
export function getSkinTypeName(params: IPMatchParams): string {
    const ip = matchCharacterIP(params);
    return ip.name;
}
