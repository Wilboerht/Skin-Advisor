/**
 * 季节/环境感知模块
 *
 * 基于月份 + 用户地理位置，生成影响护肤品推荐的环境上下文因子。
 * 无需外部 API，纯离线计算，零成本。
 *
 * 核心思路：
 * - 月份决定季节（春夏秋冬 + 换季过渡期）
 * - 省份/城市判断气候特征（干燥/潮湿/高原紫外线）
 *   - 省份级：Set 查找，O(1)，覆盖大多数省份
 *   - 城市级：Map 精确覆盖，仅用于省内气候差异大的城市（如云南西双版纳 ≠ 香格里拉）
 *   - 安全第一：城市未匹配时回退省份默认（保守策略，过保护优于欠保护）
 * - 综合生成环境功效标签，注入推荐算法
 */

// ==================== 类型定义 ====================

/** 季节 */
export type Season = "spring" | "early_summer" | "midsummer" | "autumn" | "winter";

/** 气候特征 */
export type ClimateZone = "humid_south" | "dry_north" | "plateau" | "temperate" | "unknown";

/** 环境上下文（注入推荐引擎） */
export interface EnvContext {
    season: Season;
    climateZone: ClimateZone;
    /** 环境带来的护肤功效需求 */
    benefitTags: string[];
    /** 环境带来的风险/需注意的方面 */
    riskTags: string[];
    /** 人类可读的描述（用于推荐理由或 AI prompt） */
    description: string;
}

// ==================== 季节判定 ====================

const SEASON_MAP: { start: number; end: number; season: Season }[] = [
    { start: 3, end: 4, season: "spring" },        // 3-4月 春季
    { start: 5, end: 6, season: "early_summer" },   // 5-6月 初夏
    { start: 7, end: 8, season: "midsummer" },      // 7-8月 盛夏
    { start: 9, end: 10, season: "autumn" },        // 9-10月 秋季
    { start: 11, end: 2, season: "winter" },        // 11-2月 冬季
];

export function getSeason(month?: number): Season {
    const m = month ?? new Date().getMonth() + 1; // 1-12
    for (const entry of SEASON_MAP) {
        if (entry.start <= entry.end) {
            if (m >= entry.start && m <= entry.end) return entry.season;
        } else {
            // 跨年区间（如 11-2）
            if (m >= entry.start || m <= entry.end) return entry.season;
        }
    }
    return "spring"; // fallback (should never reach here, all months 1-12 are covered)
}

// ==================== 气候区域判定 ====================

/**
 * 高湿度省份（年平均湿度 > 75%）
 * 注：部分省份内部差异大（如云南），省份级判定仅作为默认值，
 * 具体城市通过 CITY_ZONE_OVERRIDE 精确覆盖。
 */
const HUMID_REGIONS = new Set([
    "广东", "广西", "海南", "福建", "浙江", "江西", "湖南",
    "台湾", "香港", "澳门", "贵州", "湖北", "安徽",
]);

/** 干燥省份（年平均湿度 < 55%） */
const DRY_REGIONS = new Set([
    "新疆", "宁夏", "青海", "内蒙古",
    "陕西", "山西",
]);

/**
 * 高原/高紫外线区域（省份级默认）
 *
 * 云南、甘肃、四川三省内部气候差异巨大，省份级统一标记为 plateau
 * 是保守策略（过保护）：强紫外线 → 防晒/保湿/抗氧化 在任何场景下都无害。
 * 对于省会及人口大市，通过 CITY_ZONE_OVERRIDE 实现城市级精确覆盖。
 */
const PLATEAU_REGIONS = new Set([
    "西藏", "青海", "四川", "云南", "甘肃",
]);

/**
 * 城市级气候精确覆盖
 *
 * 仅收录与所在省份默认分类不同的城市（其余城市走省份级默认值）。
 * key: Pinyin（匹配 geoip-lite 输出）或中文名（兼容不同数据库版本）
 * value: ClimateZone
 *
 * 覆盖策略：
 * - 云南：热带低海拔城市 → humid_south；温和高原城市 → temperate
 * - 甘肃：河西走廊 → dry_north；黄河谷地 → temperate
 * - 四川：盆地城市 → humid_south
 *
 * 维护指南：
 * - 新增城市只需在此 Map 中追加条目
 * - 每种城市同时添加中英文键名
 * - 未列出城市自动继承省份默认值（安全兜底）
 */
const CITY_ZONE_OVERRIDE = new Map<string, ClimateZone>([
    // ===== 云南（默认 plateau）=====
    // —— 热带/亚热带低海拔 → humid_south
    ["Xishuangbanna", "humid_south"], ["西双版纳", "humid_south"],
    ["Jinghong", "humid_south"], ["景洪", "humid_south"],
    ["Pu'er", "humid_south"], ["普洱", "humid_south"],
    ["Simao", "humid_south"], ["思茅", "humid_south"],
    ["Dehong", "humid_south"], ["德宏", "humid_south"],
    ["Mangshi", "humid_south"], ["芒市", "humid_south"],
    ["Lincang", "humid_south"], ["临沧", "humid_south"],
    // —— 温和高原城市 → temperate
    ["Kunming", "temperate"], ["昆明", "temperate"],
    ["Qujing", "temperate"], ["曲靖", "temperate"],
    ["Yuxi", "temperate"], ["玉溪", "temperate"],
    ["Chuxiong", "temperate"], ["楚雄", "temperate"],
    ["Dali", "temperate"], ["大理", "temperate"],
    ["Honghe", "temperate"], ["红河", "temperate"],
    ["Mengzi", "temperate"], ["蒙自", "temperate"],
    ["Baoshan", "temperate"], ["保山", "temperate"],
    // 丽江、香格里拉（Diqing）、昭通、怒江 → 保持 plateau 默认

    // ===== 甘肃（默认 plateau）=====
    // —— 河西走廊干旱区 → dry_north
    ["Jiuquan", "dry_north"], ["酒泉", "dry_north"],
    ["Jiayuguan", "dry_north"], ["嘉峪关", "dry_north"],
    ["Zhangye", "dry_north"], ["张掖", "dry_north"],
    ["Jinchang", "dry_north"], ["金昌", "dry_north"],
    ["Wuwei", "dry_north"], ["武威", "dry_north"],
    // —— 黄河谷地温和区 → temperate
    ["Lanzhou", "temperate"], ["兰州", "temperate"],
    ["Baiyin", "temperate"], ["白银", "temperate"],
    ["Tianshui", "temperate"], ["天水", "temperate"],
    ["Pingliang", "temperate"], ["平凉", "temperate"],
    ["Qingyang", "temperate"], ["庆阳", "temperate"],
    ["Dingxi", "temperate"], ["定西", "temperate"],
    ["Longnan", "temperate"], ["陇南", "temperate"],
    // 甘南、临夏 → 保持 plateau 默认

    // ===== 四川（默认 plateau）=====
    // —— 四川盆地湿润区 → humid_south
    ["Chengdu", "humid_south"], ["成都", "humid_south"],
    ["Mianyang", "humid_south"], ["绵阳", "humid_south"],
    ["Deyang", "humid_south"], ["德阳", "humid_south"],
    ["Yibin", "humid_south"], ["宜宾", "humid_south"],
    ["Luzhou", "humid_south"], ["泸州", "humid_south"],
    ["Zigong", "humid_south"], ["自贡", "humid_south"],
    ["Nanchong", "humid_south"], ["南充", "humid_south"],
    ["Suining", "humid_south"], ["遂宁", "humid_south"],
    ["Neijiang", "humid_south"], ["内江", "humid_south"],
    ["Leshan", "humid_south"], ["乐山", "humid_south"],
    ["Meishan", "humid_south"], ["眉山", "humid_south"],
    ["Guang'an", "humid_south"], ["广安", "humid_south"],
    ["Dazhou", "humid_south"], ["达州", "humid_south"],
    ["Guangyuan", "humid_south"], ["广元", "humid_south"],
    ["Ziyang", "humid_south"], ["资阳", "humid_south"],
    ["Ya'an", "humid_south"], ["雅安", "humid_south"],
    // 甘孜、阿坝、凉山、攀枝花 → 保持 plateau 默认
]);

/**
 * 判定用户所在地的气候区域
 *
 * 判定链：城市精确覆盖 → 省份默认分类 → unknown
 *
 * @param region 省份中文名（如 "广东"、"云南"），由 geoip.ts 的 PROVINCE_MAP 转换
 * @param city   城市名（geoip-lite 返回 Pinyin 格式，如 "Kunming"）
 */
export function getClimateZone(region?: string, city?: string): ClimateZone {
    if (!region) return "unknown";

    // 1. 城市级精确覆盖（最高优先级）：处理省内气候差异
    if (city) {
        const cityZone = CITY_ZONE_OVERRIDE.get(city);
        if (cityZone) return cityZone;
    }

    // 2. 省份级默认分类（安全兜底：不确定时走保守策略）
    // 高原优先判定（紫外线防护在任何场景下无害）
    if (PLATEAU_REGIONS.has(region)) return "plateau";

    if (DRY_REGIONS.has(region)) return "dry_north";
    if (HUMID_REGIONS.has(region)) return "humid_south";

    // 东北地区默认干燥
    if (["黑龙江", "吉林", "辽宁"].includes(region)) return "dry_north";

    // 直辖市/其他默认温带
    if (["北京", "天津", "河北", "河南", "山东", "江苏", "上海", "重庆"].includes(region)) {
        return "temperate";
    }

    return "unknown";
}

// ==================== 环境→功效映射 ====================

/**
 * 根据季节 + 气候生成环境护肤需求标签
 */
export function getEnvContext(
    season?: Season,
    climateZone?: ClimateZone,
): EnvContext {
    const s = season ?? getSeason();
    const z = climateZone ?? "unknown";

    const benefitTags: string[] = [];
    const riskTags: string[] = [];

    // --- 季节维度的功效需求 ---
    switch (s) {
        case "spring":
            benefitTags.push("修护", "舒缓", "温和", "防晒");
            riskTags.push("换季敏感", "花粉刺激", "紫外线增强");
            break;
        case "early_summer":
            benefitTags.push("清爽", "控油", "防晒", "抗氧化");
            riskTags.push("紫外线增强", "油脂分泌旺盛", "毛孔堵塞");
            break;
        case "midsummer":
            benefitTags.push("清爽", "控油", "防晒", "净化");
            riskTags.push("强紫外线", "高温出油", "晒后损伤", "脱水");
            break;
        case "autumn":
            benefitTags.push("保湿", "修护", "滋润", "舒缓");
            riskTags.push("秋燥", "换季敏感", "紫外线余威");
            break;
        case "winter":
            benefitTags.push("滋养", "保湿", "修护屏障", "滋润");
            riskTags.push("干燥缺水", "屏障脆弱", "冷风刺激");
            break;
    }

    // --- 气候维度的功效增补 ---
    switch (z) {
        case "humid_south":
            // 潮湿地区：清爽控油需求增加，防晒全年重要
            if (!benefitTags.includes("清爽")) benefitTags.push("清爽");
            if (!benefitTags.includes("控油")) benefitTags.push("控油");
            if (s === "winter") {
                // 南方冬天湿冷，仍需保湿但不宜过厚重
                benefitTags.push("修护");
            }
            break;
        case "dry_north":
            // 干燥地区：保湿滋润是全年主题
            if (!benefitTags.includes("保湿")) benefitTags.push("保湿");
            if (!benefitTags.includes("滋润")) benefitTags.push("滋润");
            if (s === "midsummer") {
                // 北方夏天干热，注意补水 + 防晒
                benefitTags.push("补水", "防晒");
            }
            if (s === "winter") {
                riskTags.push("极度干燥", "室内暖气干燥", "冻伤风险");
                benefitTags.push("深层滋养", "修护皮脂膜", "以油养肤");
            }
            break;
        case "plateau":
            // 高原：紫外线+干燥双重挑战
            if (!benefitTags.includes("防晒")) benefitTags.push("防晒");
            if (!benefitTags.includes("保湿")) benefitTags.push("保湿");
            if (!benefitTags.includes("抗氧化")) benefitTags.push("抗氧化");
            riskTags.push("强紫外线全年", "干燥缺氧");
            break;
        case "temperate":
        default:
            // 温带不做额外调整
            break;
    }

    // 去重
    const uniqueBenefits = [...new Set(benefitTags)];
    const uniqueRisks = [...new Set(riskTags)];

    return {
        season: s,
        climateZone: z,
        benefitTags: uniqueBenefits,
        riskTags: uniqueRisks,
        description: buildEnvDescription(s, z, uniqueBenefits, uniqueRisks),
    };
}

function buildEnvDescription(
    season: Season,
    zone: ClimateZone,
    benefits: string[],
    risks: string[],
): string {
    const seasonLabel: Record<Season, string> = {
        spring: "春季",
        early_summer: "初夏",
        midsummer: "盛夏",
        autumn: "秋季",
        winter: "冬季",
    };

    const zoneLabel: Record<ClimateZone, string> = {
        humid_south: "潮湿",
        dry_north: "干燥",
        plateau: "高原",
        temperate: "温带",
        unknown: "",
    };

    const parts = [seasonLabel[season] || ""];
    if (zoneLabel[zone]) parts.push(zoneLabel[zone]);
    const base = parts.join("·");
    const riskText = risks.length > 0 ? `（注意${risks.slice(0, 2).join("、")}）` : "";
    return `${base}${riskText}`;
}

// ==================== 便捷入口 ====================

/**
 * 从用户地理位置快速获取环境上下文（主入口）
 * @param region 省份名称（如 "广东"、"北京"）
 * @param city   城市名称（备用）
 */
export function getEnvContextFromLocation(region?: string, city?: string): EnvContext {
    const season = getSeason();
    const climateZone = getClimateZone(region, city);
    return getEnvContext(season, climateZone);
}

/**
 * 获取当前季节的中文名称
 */
export function getSeasonLabel(season?: Season): string {
    const s = season ?? getSeason();
    const labels: Record<Season, string> = {
        spring: "春季",
        early_summer: "初夏",
        midsummer: "盛夏",
        autumn: "秋季",
        winter: "冬季",
    };
    return labels[s] || "";
}
