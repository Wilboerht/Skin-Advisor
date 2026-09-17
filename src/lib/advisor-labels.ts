import type { FaceAnalysisResult } from "@/lib/advisor-utils";

/**
 * 十维数据的纯展示常量（客户端安全）
 *
 * 从 `advisor-utils` 拆出：advisor-utils 引入 zod（服务端 schema），
 * 客户端组件只要值导入就会把整个 zod 打进首屏包；本文件只含类型与常量，可安全被客户端引用。
 */

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

// 十维分析展示顺序：PC 条形图与移动端表单共用，避免两处硬编码漂移
export const DIMENSION_ORDER: SkinDimensionKey[] = [
    'radiance', 'acne', 'firmness', 'darkCircles',
    'sensitivity', 'uvDamage', 'wrinkles', 'spots',
    'skinTone', 'waterOil'
];
