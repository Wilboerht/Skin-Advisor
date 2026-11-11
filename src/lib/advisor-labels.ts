import type { FaceAnalysisResult } from "@/lib/advisor-utils";

/**
 * 十维数据的纯展示常量（客户端安全）
 *
 * 从 `advisor-utils` 拆出：advisor-utils 引入 zod（服务端 schema），
 * 客户端组件只要值导入就会把整个 zod 打进首屏包；本文件只含类型与常量，可安全被客户端引用。
 */

// 10 维度评分接口（DimensionRadarChart 与报告证据 chips 共用）
export type SkinDimensions = FaceAnalysisResult['dimensions'];
export type SkinDimensionKey = keyof SkinDimensions;

// 中文映射
// 维度名采用“状态越好分越高”的方向中性命名，避免“敏感度 90”被读成“很敏感”。
export const DIMENSION_LABELS: Record<string, string> = {
    waterOil: "水油平衡",
    skinTone: "肤色均衡度",
    spots: "色斑控制度",
    wrinkles: "细纹改善度",
    uvDamage: "光老化防护度",
    sensitivity: "屏障耐受度",
    darkCircles: "眼周状态",
    firmness: "皮肤弹性",
    acne: "粉刺/痤疮控制度",
    radiance: "光泽度"
};

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
    waterOil: "皮肤水分与油脂分泌的平衡状态，分数越高越平衡",
    skinTone: "肤色整体均匀度，分数越高越均匀",
    spots: "表面可见色斑、晒斑及色素沉着的控制程度，分数越高越少",
    wrinkles: "干纹、细纹及深层皱纹的改善程度，分数越高越平滑",
    uvDamage: "紫外线造成的光老化防护程度，分数越高防护越好",
    sensitivity: "皮肤屏障功能及耐受度，分数越高越稳定",
    darkCircles: "眼周色素沉着及循环状态，分数越高状态越好",
    firmness: "胶原蛋白支撑力及皮肤紧致度，分数越高越紧致",
    acne: "粉刺、闭口及痤疮的控制程度，分数越高问题越少",
    radiance: "皮肤表面光泽感与通透度，分数越高越透亮"
};

/** 报告页统一的方向提示 */
export const SCORE_DIRECTION_HINT = "0–100 分，分数越高代表该维度状态越好";

// 十维展示顺序：雷达图等展示组件共用，避免多处硬编码漂移
export const DIMENSION_ORDER: SkinDimensionKey[] = [
    'radiance', 'acne', 'firmness', 'darkCircles',
    'sensitivity', 'uvDamage', 'wrinkles', 'spots',
    'skinTone', 'waterOil'
];

/**
 * 关注点 key → 中文标签（客户端安全）。
 * skinProfile.concerns 落库存的是 identifyConcerns 的原始 key（acne/spots/...），
 * 展示层（结果页证书卡等）需经此映射；未知 key 原样透出（老数据可能是中文文本）。
 */
export const CONCERN_LABELS: Record<string, string> = {
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

export function getConcernLabel(concern: string): string {
    return CONCERN_LABELS[concern] || concern;
}
