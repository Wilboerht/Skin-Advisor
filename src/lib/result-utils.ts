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

/** 10种肌肤类型的分数区间映射 */
const SCORE_RANGES = [
    { range: "96-100", min: 96, max: 100, typeName: "御龄主宰" },
    { range: "92-95", min: 92, max: 95, typeName: "天赋狂魔" },
    { range: "88-91", min: 88, max: 91, typeName: "冻龄玩家" },
    { range: "84-87", min: 84, max: 87, typeName: "奢润达人" },
    { range: "80-83", min: 80, max: 83, typeName: "生图狂魔" },
    { range: "76-79", min: 76, max: 79, typeName: "稳肤玩家" },
    { range: "72-75", min: 72, max: 75, typeName: "柔光达人" },
    { range: "68-71", min: 68, max: 71, typeName: "躺平玩家" },
    { range: "64-67", min: 64, max: 67, typeName: "抗垮达人" },
    { range: "60-63", min: 0,  max: 63, typeName: "进阶狂魔" },
];

/**
 * 根据综合评分和性别获取角色插图路径
 * @param score 用户综合评分 0-100
 * @param gender 性别 "female" | "male"
 * @returns 角色图片路径，如 "/images/character/80-83/80-83_male.png"
 */
export function getCharacterImage(score: number, gender: string): string {
    const match = SCORE_RANGES.find(r => score >= r.min && score <= r.max);
    const range = match?.range || "60-63";
    const genderSuffix = gender === "male" ? "male" : "female";
    return `/images/character/${range}/${range}_${genderSuffix}.png`;
}

/**
 * 根据综合评分获取肌肤类型名称
 */
export function getSkinTypeName(score: number): string {
    const match = SCORE_RANGES.find(r => score >= r.min && score <= r.max);
    return match?.typeName || "进阶狂魔";
}
