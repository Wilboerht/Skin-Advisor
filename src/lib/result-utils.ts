/**
 * 根据综合评分计算全国排名百分比（连续幂函数曲线）
 *
 * 使用幂函数模拟真实分布：低分段拉开差距，高分段逐渐饱和。
 * 曲线示例：score=30→49% | 50→69% | 70→85% | 85→93% | 95→99%
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

/**
 * 根据匹配参数和性别获取角色插图路径
 * @returns 角色图片路径，如 "/images/character/ageless/ageless_female.png"
 */
export function getCharacterImage(params: IPMatchParams & { gender: string }): string {
    const ip = matchCharacterIP(params);
    const genderSuffix = params.gender === "male" ? "male" : "female";
    return `/images/character/${ip.key}/${ip.key}_${genderSuffix}.png`;
}

/**
 * 根据匹配参数获取肌肤类型名称（IP 中文名）
 */
export function getSkinTypeName(params: IPMatchParams): string {
    const ip = matchCharacterIP(params);
    return ip.name;
}
