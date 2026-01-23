/**
 * 科学通用护肤逻辑库 (Scientific Generic Skincare Logic)
 * 
 * 基于皮肤科学原理设计的通用护肤推荐引擎。
 * 核心原则：
 * 1. 防晒金标准：2.0mg/cm²
 * 2. 保湿动态调整：基于环境相对湿度(RH)和经皮水分流失(TEWL)风险
 * 3. 护肤金字塔：清洁 -> 调理 -> 功效 -> 保湿 -> 防护
 */

export type ClimateType = "W1" | "A2" | "S1" | "A1" | "S2" | "M1";
export type RoutineLevel = "daily" | "professional" | "ultimate";
export type RoutineScenario = "morning" | "evening" | "home" | "travel";

export type SkinType = "oily" | "combination_oily" | "normal" | "combination_dry" | "dry" | "sensitive";

/** 气候类型定义 */
export const CLIMATE_LABELS: Record<ClimateType, string> = {
    W1: "寒冷干燥 (Cold & Dry)",
    A2: "凉爽潮湿 (Cool & Humid)",
    S1: "温和舒适 (Mild & Moderate)",
    A1: "炎热干燥 (Hot & Dry)",
    S2: "炎热潮湿 (Hot & Humid)",
    M1: "高原环境 (High Altitude)",
};

export type RegionClimate = {
    code: ClimateType;
    name: string;
    description: string;
    skincareFocus: string[];
}

export const REGION_CLIMATE_MAP: Record<string, RegionClimate> = {
    "W1": { code: "W1", name: "寒冷干燥", description: "低温低湿，屏障脆弱", skincareFocus: ["高倍保湿", "滋润修护", "温和清洁"] },
    "A2": { code: "A2", name: "凉爽潮湿", description: "温差较小，湿度适中", skincareFocus: ["水油平衡", "基础保湿", "适度清洁"] },
    "S1": { code: "S1", name: "温和舒适", description: "四季分明，气候宜人", skincareFocus: ["基础防护", "抗氧化", "定期护理"] },
    "A1": { code: "A1", name: "炎热干燥", description: "高温干燥，紫外线强", skincareFocus: ["严格防晒", "深层补水", "晒后修护"] },
    "S2": { code: "S2", name: "炎热潮湿", description: "高温高湿，皮脂活跃", skincareFocus: ["控油清爽", "疏通毛孔", "防晒抑菌"] },
    "M1": { code: "M1", name: "高原环境", description: "强紫外线，空气稀薄", skincareFocus: ["极限防晒", "高封闭保湿", "舒缓修护"] },
};

/** 肤质类型映射 */
export const SKIN_TYPE_MAP: Record<string, SkinType> = {
    oily: "oily",
    combination: "combination_oily",
    combination_oily: "combination_oily",
    normal: "normal",
    combination_dry: "combination_dry",
    dry: "dry",
    sensitive: "sensitive",
    // 兼容中文输入
    "油性肌肤": "oily",
    "混合性偏油": "combination_oily",
    "中性肌肤": "normal",
    "混合性偏干": "combination_dry",
    "干性肌肤": "dry",
    "敏感肌": "sensitive",
};

/** 通用产品品类 */
export type ProductCategory =
    | "cleanser_gentle"   // 温和洁面 (晨间/敏感肌)
    | "cleanser_deep"     // 深层洁面 (晚间/油皮)
    | "toner_hydrating"   // 保湿水
    | "toner_exfoliating" // 二次清洁水/酸类水
    | "serum_antiox"      // 抗氧化精华 (VC等)
    | "serum_repair"      // 修护精华 (B5/积雪草等)
    | "serum_active"      // 功效精华 (A醇/酸类)
    | "moisturizer_light" // 乳液/啫喱
    | "moisturizer_rich"  // 面霜
    | "sunscreen"         // 防晒
    | "mask_hydrating"    // 补水面膜
    | "oil_treatment";    // 护理油

/** 产品定义结构 */
interface GenericProduct {
    category: ProductCategory;
    name: string;
    nameEn: string;
    unit: string;
    baseDosage: number; // 基准用量
    description: string;
}

/** 通用产品库数据 */
const GENERIC_PRODUCTS: Record<ProductCategory, GenericProduct> = {
    cleanser_gentle: {
        category: "cleanser_gentle",
        name: "温和氨基酸洁面",
        nameEn: "Gentle Amino Acid Cleanser",
        unit: "cm", // 挤出长度
        baseDosage: 1.5,
        description: "选用弱酸性配方，保护皮脂膜",
    },
    cleanser_deep: {
        category: "cleanser_deep",
        name: "深层净澈洁面",
        nameEn: "Deep Purifying Cleanser",
        unit: "cm",
        baseDosage: 1.5,
        description: "复配皂基或泥类成分，有效带走多余油脂",
    },
    toner_hydrating: {
        category: "toner_hydrating",
        name: "舒缓保湿水",
        nameEn: "Hydrating Toner",
        unit: "ml",
        baseDosage: 2.0, // 需足量浸润角质层
        description: "特别是洁面后30秒内使用，瞬间充盈角质",
    },
    toner_exfoliating: {
        category: "toner_exfoliating",
        name: "平衡调理水",
        nameEn: "Balancing Toner",
        unit: "ml",
        baseDosage: 1.5,
        description: "配合化妆棉擦拭，二次清洁去除老废角质",
    },
    serum_antiox: {
        category: "serum_antiox",
        name: "抗氧化精华",
        nameEn: "Antioxidant Serum",
        unit: "pump", // 泵
        baseDosage: 1.5,
        description: "如维C类成分，抵御日间自由基损伤",
    },
    serum_repair: {
        category: "serum_repair",
        name: "多效修护精华",
        nameEn: "Repairing Serum",
        unit: "pump",
        baseDosage: 2.0,
        description: "含神经酰胺/B5等成分，强韧肌肤屏障",
    },
    serum_active: {
        category: "serum_active",
        name: "强效焕肤精华",
        nameEn: "Active Treatment Serum",
        unit: "drop", // 滴
        baseDosage: 3.0,
        description: "含视黄醇或酸类，建议夜间避光使用",
    },
    moisturizer_light: {
        category: "moisturizer_light",
        name: "清爽保湿乳液",
        nameEn: "Lightweight Moisturizer",
        unit: "ml", // 实际按压量
        baseDosage: 0.5,
        description: "水油平衡配方，清爽锁水不闷痘",
    },
    moisturizer_rich: {
        category: "moisturizer_rich",
        name: "滋润修护面霜",
        nameEn: "Rich Cream",
        unit: "g", // 挖取量
        baseDosage: 0.5,
        description: "高封闭性油脂，形成长效保护膜",
    },
    sunscreen: {
        category: "sunscreen",
        name: "广谱防晒霜",
        nameEn: "Broad Spectrum Sunscreen",
        unit: "g",
        baseDosage: 1.0, // 2mg/cm² * 400cm²面部面积 ≈ 0.8g -> 推荐 1.0g 留余量
        description: "全波段防护，需覆盖每一寸暴露肌肤",
    },
    mask_hydrating: {
        category: "mask_hydrating",
        name: "密集补水面膜",
        nameEn: "Hydrating Sheet Mask",
        unit: "片",
        baseDosage: 1,
        description: "深层补水，并在揭下后及时洁面护肤",
    },
    oil_treatment: {
        category: "oil_treatment",
        name: "角鲨烷护理油",
        nameEn: "Facial Oil",
        unit: "drop",
        baseDosage: 2,
        description: "以油养肤，模拟皮脂膜结构",
    }
};

/**
 * 科学计算产品用量
 * @param category 产品品类
 * @param skinType 肤质
 * @param climate 气候
 */
export function calculateScientificDosage(
    category: ProductCategory,
    skinType: string,
    climate: ClimateType
): { dosage: number, unit: string, desc: string } {

    const product = GENERIC_PRODUCTS[category];
    const sType = SKIN_TYPE_MAP[skinType] || "normal";
    let dosage = product.baseDosage;

    // 1. 防晒霜特殊算法 (Sunscreen Standard)
    if (category === "sunscreen") {
        // 2mg/cm² 是定值，主要受面部面积影响，这里取平均值
        // 但如果在高紫外线区域(高原M1/炎热A1)，建议稍微加量确保覆盖
        if (climate === "M1" || climate === "A1") dosage *= 1.2;
        // 描述
        const desc = "约为一枚一元硬币大小，确保2mg/cm²的覆盖厚度";
        return { dosage: Number(dosage.toFixed(1)), unit: product.unit, desc };
    }

    // 2. 清洁类 (Cleanser)
    if (category.startsWith("cleanser")) {
        if (sType === "oily" || climate === "S2") dosage *= 1.2; // 油皮或潮湿增加清洁力
        return { dosage: Number(dosage.toFixed(1)), unit: product.unit, desc: `约${dosage.toFixed(1)}cm，充分起泡后使用` };
    }

    // 3. 保湿类 (Moisturizer) - 受 TEWL 影响最大
    if (category.startsWith("moisturizer")) {
        // 气候修正
        const isDryClimate = ["W1", "A1", "M1"].includes(climate);
        const isHumidClimate = ["A2", "S2"].includes(climate);

        // 肤质修正
        const isDrySkin = ["dry", "combination_dry"].includes(sType);
        const isOilySkin = ["oily", "combination_oily"].includes(sType);

        let factor = 1.0;

        if (isDryClimate) factor += 0.3; // 干燥环境 +30%
        if (isHumidClimate) factor -= 0.2; // 潮湿环境 -20%

        if (isDrySkin) factor += 0.4; // 干皮 +40%
        if (isOilySkin) factor -= 0.3; // 油皮 -30%

        dosage *= factor;

        // 最小值保护
        dosage = Math.max(0.3, dosage);

        let sizeDesc = "一颗黄豆大小";
        if (dosage > 0.8) sizeDesc = "一颗花生大小";
        if (dosage > 1.2) sizeDesc = "一元硬币大小";

        return { dosage: Number(dosage.toFixed(1)), unit: product.unit, desc: `约${sizeDesc}，掌心预热后按压` };
    }

    // 4. 功效精华 (Active)
    if (category === "serum_active") {
        // 敏感肌减半
        if (sType === "sensitive") dosage *= 0.5;
        return { dosage: Math.round(dosage), unit: product.unit, desc: "局部使用或建立耐受后全脸" };
    }

    return { dosage: Number(dosage.toFixed(1)), unit: product.unit, desc: product.description };
}

/** 护肤步骤接口 */
export interface SkincareStep {
    order: number;
    name: string;
    nameEn: string;
    category: ProductCategory; // 用于索引图标等
    duration: string;
    description: string;
    dosage?: {
        dosage: number;
        unit: string;
        description: string;
        productName: string; // 显示通用名称
    };
    frequency?: string;
}

/** 方案接口 */
export interface SkincareRoutine {
    level: "daily" | "professional" | "ultimate";
    scenario: "morning" | "evening" | "home" | "travel";
    steps: SkincareStep[];
    totalDuration: string;
    tips: string[];
}

// 模拟导出这些常量以兼容现有组件
export const LEVEL_LABELS = {
    daily: { name: "基础护理", nameEn: "Basic", desc: "科学精简，维持肌肤稳态" },
    professional: { name: "进阶护理", nameEn: "Advanced", desc: "针对性改善，强化功效" },
    ultimate: { name: "全效护理", nameEn: "Complete", desc: "全链路管理，极致焕肤" },
};
// 导出 SCENARIO_LABELS 

export const SCENARIO_LABELS: Record<RoutineScenario, { name: string; nameEn: string }> = {
    morning: { name: "日间防护", nameEn: "Day Protection" },
    evening: { name: "夜间修护", nameEn: "Night Repair" },
    home: { name: "周末调理", nameEn: "Weekend Spa" },
    travel: { name: "差旅急救", nameEn: "On-the-Go" },
};

/**
 * 生成通用科学护肤方案
 */
export function generateSkincareRoutines(skinType: string, climate: ClimateType): any {
    // 简化的生成器，实际可以根据上面的逻辑更复杂
    const levels = ["daily", "professional", "ultimate"] as const;
    const scenarios = ["morning", "evening", "home", "travel"] as const;

    const result: any = {};

    levels.forEach(level => {
        result[level] = {};
        scenarios.forEach(scenario => {
            result[level][scenario] = createRoutine(level, scenario, skinType, climate);
        });
    });

    return result;
}

function createRoutine(level: string, scenario: string, skinType: string, climate: ClimateType): SkincareRoutine {
    const steps: SkincareStep[] = [];
    const sType = SKIN_TYPE_MAP[skinType] || "normal";
    const isOily = sType.includes("oily");

    // 1. 清洁 (Cleansing)
    // 晨间一般温和，晚间深层；油皮晨间也可以稍强
    let cleanserType: ProductCategory = (scenario === "morning" && !isOily) ? "cleanser_gentle" : "cleanser_deep";
    // 差旅简化为一种
    if (scenario === "travel") cleanserType = "cleanser_gentle";

    steps.push(createStep(1, cleanserType, skinType, climate));

    // 2. 补水/调理 (Toning) - Professional以上
    if (level !== "daily") {
        steps.push(createStep(2, "toner_hydrating", skinType, climate));
    }

    // 3. 功效精华 (Treatment) - 视场景
    if (scenario === "morning") {
        // 晨间抗氧
        if (level !== "daily") steps.push(createStep(3, "serum_antiox", skinType, climate));
    } else if (scenario === "evening") {
        // 晚间修护或抗老
        if (level === "professional" || level === "ultimate") {
            steps.push(createStep(3, "serum_active", skinType, climate));
        }
    }

    // 4. 保湿 (Moisturizer)
    // 油皮用乳液，干皮用面霜
    let moistType: ProductCategory = isOily ? "moisturizer_light" : "moisturizer_rich";
    // 炎热潮湿环境，干皮也可能换乳液
    if ((climate === "S2" || climate === "A2") && !sType.includes("dry")) {
        moistType = "moisturizer_light";
    }

    steps.push(createStep(4, moistType, skinType, climate));

    // 5. 防护 (Protection) - 仅晨和差旅(默认看作白天)
    if (scenario === "morning" || scenario === "travel") {
        steps.push(createStep(5, "sunscreen", skinType, climate));
    }

    // 6. 特殊护理 (Special) - 周末或极致
    if (scenario === "home" || level === "ultimate") {
        // 插入面膜步骤在精华后
        const seruIdx = steps.findIndex(s => s.category.startsWith("serum"));
        const maskStep = createStep(3, "mask_hydrating", skinType, climate);
        maskStep.frequency = "每周2-3次";
        if (seruIdx !== -1) steps.splice(seruIdx + 1, 0, maskStep);
        else steps.splice(1, 0, maskStep);
    }

    // 重排序号
    steps.forEach((s, i) => s.order = i + 1);

    return {
        level: level as any,
        scenario: scenario as any,
        steps,
        totalDuration: `${steps.length * 2 + (scenario === "home" ? 15 : 0)}分钟`,
        tips: generateTips(climate, scenario, sType)
    };
}

function createStep(order: number, category: ProductCategory, skinType: string, climate: ClimateType): SkincareStep {
    const product = GENERIC_PRODUCTS[category];
    const dosageInfo = calculateScientificDosage(category, skinType, climate);

    return {
        order,
        name: product.name,
        nameEn: product.nameEn,
        category,
        duration: category.includes("mask") ? "15分钟" : "1分钟",
        description: product.description,
        dosage: {
            productName: product.name,
            dosage: dosageInfo.dosage,
            unit: dosageInfo.unit,
            description: dosageInfo.desc
        }
    };
}

function generateTips(climate: ClimateType, scenario: string, skinType: string): string[] {
    const tips = [];
    if (climate.includes("1")) tips.push("当前环境较干燥，请注意肌肤水合状态，多喝水。");
    if (skinType === "sensitive") tips.push("敏感肌建议精简护肤，避免叠加过多功效成分。");
    if (scenario === "morning") tips.push("日间护肤的关键是【抗氧化 + 严密防晒】。");
    if (scenario === "evening") tips.push("夜间是细胞修护黄金期，可适当使用功能性产品。");
    return tips;
}

// 导出辅助函数
export function getClimateByRegion(province?: string, city?: string): ClimateType {
    if (!province && !city) return "S1";
    const location = (province || "") + (city || "");
    if (/西藏|青海|新疆北部|内蒙古北部/.test(location)) return "M1";
    if (/黑龙江|吉林|辽宁|内蒙古|北京|天津|河北|山西|陕西北部/.test(location)) return "W1";
    if (/广东|广西|海南|福建|台湾/.test(location)) return "S2";
    if (/新疆|甘肃|宁夏/.test(location)) return "A1";
    if (/上海|江苏|浙江|山东/.test(location)) return "A2";
    return "S1";
}

export function adjustClimateForSeason(baseClimate: ClimateType): ClimateType {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 8) {
        if (baseClimate === "W1") return "S1";
        if (baseClimate === "A2") return "S2";
        if (baseClimate === "S1") return "S2";
    }
    if (month === 12 || month <= 2) {
        if (baseClimate === "S2") return "S1";
        if (baseClimate === "A2") return "W1";
        if (baseClimate === "S1") return "W1";
    }
    return baseClimate;
}
