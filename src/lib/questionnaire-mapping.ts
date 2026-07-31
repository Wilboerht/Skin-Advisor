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
        question: "您的护肤哲学更接近哪种？",
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
        question: "您会给自己的皮肤状态打多少分？",
        type: "single",
        options: [
            { value: "great", label: "90+ 非常好", description: "基本没大问题" },
            { value: "good", label: "70-89 还不错", description: "有些小瑕疵" },
            { value: "average", label: "50-69 一般般", description: "有明显困扰" },
            { value: "poor", label: "50 以下 不理想", description: "不太满意，急需改善" },
        ],
    },
    {
        id: "q_skincareMotivation",
        fieldName: "q_skincareMotivation",
        question: "驱动您认真护肤的最大动力是什么？",
        type: "single",
        options: [
            { value: "antiAging", label: "延缓衰老", description: "想比同龄人看起来年轻" },
            { value: "confidence", label: "增强自信", description: "素颜也能大方出门" },
            { value: "social", label: "社交形象", description: "工作/社交需要" },
            { value: "selfCare", label: "自我宠爱", description: "纯粹享受照顾自己的过程" },
        ],
    },
    {
        id: "q_morningFeel",
        fieldName: "q_morningFeel",
        question: "早上起床时，你的皮肤摸起来是什么感觉？",
        type: "single",
        options: [
            { value: "tight", label: "紧绷、粗糙", description: "感觉皮肤紧紧的，摸起来不光滑" },
            { value: "greasy", label: "油腻、有光泽", description: "T区或全脸摸起来有油感" },
            { value: "tzone_only", label: "T区油，脸颊正常", description: "鼻子额头有油，脸颊触感干爽" },
            { value: "balanced", label: "不干不油，软嫩舒适", description: "整体触感很舒服" },
        ],
    },
    {
        id: "q_afternoonShine",
        fieldName: "q_afternoonShine",
        question: "每日午后，你的脸部出油情况是？",
        type: "single",
        options: [
            { value: "none", label: "几乎不出油", description: "整天都很干爽" },
            { value: "tzone", label: "鼻子/额头泛油光", description: "T区出油，需要吸油纸按压" },
            { value: "full", label: "全脸油光满面", description: "需要用吸油纸多次处理" },
            { value: "seasonal", label: "看季节变化", description: "夏天偏油，冬天偏干" },
        ],
    },
    {
        id: "q_productPreference",
        fieldName: "q_productPreference",
        question: "你更偏好什么质地的护肤品？",
        type: "single",
        options: [
            { value: "rich", label: "滋润厚重型", description: "面霜/油类，喜欢被包裹的安全感" },
            { value: "gel", label: "清爽凝胶型", description: "啫喱/凝露质地，讨厌黏腻感" },
            { value: "layered", label: "分区护理", description: "T区用清爽，两颊用滋润" },
            { value: "adaptive", label: "随季节切换", description: "夏天清爽、冬天滋润" },
        ],
    },
    {
        id: "q_skinReactivity",
        fieldName: "q_skinReactivity",
        question: "换季或使用新产品时，你的皮肤通常会？",
        type: "single",
        options: [
            { value: "sensitive", label: "容易泛红、刺痛、过敏", description: "皮肤反应比较强烈" },
            { value: "breakout", label: "容易闷痘、长闭口", description: "用错产品就容易爆痘" },
            { value: "dryPeel", label: "容易干燥起皮", description: "换季时皮肤干燥脱屑" },
            { value: "stable", label: "基本稳定，没大问题", description: "皮肤适应能力较强" },
        ],
    },
    {
        id: "q_dailyEnv",
        fieldName: "q_dailyEnv",
        question: "你平时大部分时间待在什么环境？",
        type: "single",
        options: [
            { value: "indoor_ac", label: "空调房/办公室", description: "长时间待在空调或暖气环境中" },
            { value: "indoor_normal", label: "普通室内", description: "室内为主，温湿度自然" },
            { value: "outdoor_city", label: "城市户外居多", description: "通勤、逛街、城市活动为主" },
            { value: "outdoor_nature", label: "户外/大自然", description: "徒步、露营、爬山、田间等" },
        ],
    },
    {
        id: "q_uvProtection",
        fieldName: "q_uvProtection",
        question: "你的日常防晒习惯是？",
        type: "single",
        options: [
            { value: "daily_high", label: "每天高倍防晒，从不落下", description: "SPF50+，室内也涂" },
            { value: "daily", label: "出门会涂防晒", description: "通勤、外出时使用" },
            { value: "outdoor_only", label: "只有长时间户外才涂", description: "逛街、郊游等场景才用" },
            { value: "rarely", label: "几乎不用防晒", description: "觉得麻烦或不喜欢肤感" },
        ],
    },
    {
        id: "q_exerciseHabit",
        fieldName: "q_exerciseHabit",
        question: "你的运动/出汗频率是？",
        type: "single",
        options: [
            { value: "daily", label: "每天运动，经常大汗淋漓", description: "高强度训练、跑步、球类等" },
            { value: "regular", label: "每周 2-3 次", description: "规律运动，中等强度" },
            { value: "occasional", label: "偶尔运动", description: "周末或想起来才动一动" },
            { value: "rarely", label: "几乎不运动", description: "久坐为主，运动量很少" },
        ],
    },
    {
        id: "q_waterIntake",
        fieldName: "q_waterIntake",
        question: "你每天大概喝多少水？",
        type: "single",
        options: [
            { value: "abundant", label: "2升以上", description: "水杯不离手，习惯很好" },
            { value: "moderate", label: "1-2升", description: "正常饮水，想起来就喝" },
            { value: "little", label: "不到 1 升", description: "经常忘记喝水" },
            { value: "beverages", label: "喝得少，主要喝饮料/咖啡", description: "饮料代替水" },
        ],
    },
    {
        id: "q_dietHabit",
        fieldName: "q_dietHabit",
        question: "你的饮食习惯偏向？",
        type: "single",
        options: [
            { value: "balanced", label: "均衡清淡", description: "注重营养搭配，少油少糖" },
            { value: "greasy", label: "偏油腻/辛辣", description: "喜欢火锅、烧烤、油炸食物" },
            { value: "sugary", label: "偏爱甜食/奶茶", description: "离不开甜品和含糖饮料" },
            { value: "irregular", label: "不太规律", description: "三餐不定，外卖为主" },
        ],
    },
    {
        id: "q_makeupFrequency",
        fieldName: "q_makeupFrequency",
        question: "你的化妆频率是？",
        type: "single",
        options: [
            { value: "daily_full", label: "每天全妆", description: "底妆+眼妆+唇妆全套" },
            { value: "daily_light", label: "每天淡妆/素颜霜", description: "仅底妆或防晒+散粉" },
            { value: "occasional", label: "偶尔化妆", description: "重要场合才化" },
            { value: "never", label: "从不化妆", description: "素颜为主" },
        ],
    },
    {
        id: "q_routineComplexity",
        fieldName: "q_routineComplexity",
        question: "你目前的护肤流程包含几个步骤？",
        subtext: "洁面、水、精华、乳液/面霜、防晒各算一步",
        type: "single",
        options: [
            { value: "minimal", label: "1-2 步（洁面+面霜）", description: "极简护肤" },
            { value: "basic", label: "3-4 步", description: "基础护理流程" },
            { value: "advanced", label: "5-6 步", description: "早晚全套，精华面霜不落" },
            { value: "elaborate", label: "7 步以上", description: "仪器、面膜、多瓶精华叠加" },
        ],
    },
    {
        id: "q_screenTime",
        fieldName: "q_screenTime",
        question: "你每天面对电子屏幕的时间大约？",
        subtext: "手机、电脑、平板加在一起",
        type: "single",
        options: [
            { value: "light", label: "4 小时以下", description: "屏幕时间较少" },
            { value: "moderate", label: "4-8 小时", description: "普通上班族水平" },
            { value: "heavy", label: "8-12 小时", description: "长时间面对电脑/手机" },
            { value: "extreme", label: "12 小时以上", description: "除了睡觉几乎都对着屏幕" },
        ],
    },
    {
        id: "q_travelFrequency",
        fieldName: "q_travelFrequency",
        question: "你的出差/旅行频率是？",
        type: "single",
        options: [
            { value: "rarely", label: "几乎不出差", description: "工作生活都在本地" },
            { value: "occasional", label: "偶尔出行（每月1-2次）", description: "短途差旅" },
            { value: "frequent", label: "频繁出差（每周都有）", description: "空中飞人，经常换城市" },
            { value: "constant", label: "长期跨地域", description: "南北/国内外来回跑" },
        ],
    },
    {
        id: "q_faceWashing",
        fieldName: "q_faceWashing",
        question: "你的洁面习惯是？",
        subtext: "水温、频率、产品类型综合考虑",
        type: "single",
        options: [
            { value: "gentle", label: "温水+温和洁面，早晚各一次", description: "最理想的洁面方式" },
            { value: "overwash", label: "一天洗三次以上/偏爱强力控油", description: "用皂基或磨砂，追求搓盘子感" },
            { value: "hot_cold", label: "用很热或很冷的水洗脸", description: "冷热水交替刺激皮肤" },
            { value: "casual", label: "不太讲究，有啥用啥", description: "没固定习惯，随手用洗手液/香皂" },
        ],
    },
    {
        id: "q_maskFrequency",
        fieldName: "q_maskFrequency",
        question: "你敷面膜（片状/涂抹式）的频率是？",
        type: "single",
        options: [
            { value: "never", label: "几乎不敷", description: "没有敷面膜的习惯" },
            { value: "weekly", label: "每周 1-2 次", description: "适度补水修护" },
            { value: "every_other_day", label: "隔天敷一次", description: "使用频率偏高" },
            { value: "daily", label: "每天敷/一天多片", description: "过度水合风险，屏障反而变脆弱" },
        ],
    },
];

// ============================================================================
// 2. 肤质交叉验证 —— 防止用户误判自己的肤质类型
// ============================================================================

type SkinTypeGroup = "dry" | "oily" | "combination" | "normal" | "sensitive";

function normalizeSkinType(st: string): SkinTypeGroup {
    if (st === "combination_dry" || st === "combination_oily" || st === "combination") return "combination";
    if (st === "sensitive") return "sensitive";
    if (st === "dry") return "dry";
    if (st === "oily") return "oily";
    return "normal";
}

function unnormalizeSkinType(group: SkinTypeGroup, original: string): string {
    if (group === "combination") {
        if (original === "combination_dry" || original === "combination_oily") return original;
        return "combination";
    }
    return group;
}

// 每道交叉验证题的答案 → 支持的肤质分组
const MORNING_FEEL_MAP: Record<string, SkinTypeGroup[]> = {
    tight: ["dry"],
    greasy: ["oily"],
    tzone_only: ["combination"],
    balanced: ["normal"],
};

const AFTERNOON_SHINE_MAP: Record<string, SkinTypeGroup[]> = {
    none: ["dry"],
    tzone: ["combination"],
    full: ["oily"],
    seasonal: ["normal", "combination"],
};

const PRODUCT_PREF_MAP: Record<string, SkinTypeGroup[]> = {
    rich: ["dry"],
    gel: ["oily"],
    layered: ["combination"],
    adaptive: ["normal", "combination"],
};

const SKIN_REACTIVITY_MAP: Record<string, SkinTypeGroup[]> = {
    sensitive: ["sensitive"],
    breakout: ["oily", "combination"],
    dryPeel: ["dry"],
    stable: ["normal", "combination"],
};

interface CrossValidationResult {
    /** 交叉验证置信度 (0-1)，1 表示完全一致，0 表示完全矛盾 */
    confidence: number;
    /** 评分修正值（负数），矛盾越严重扣分越多 */
    scorePenalty: number;
    /** 由症状反推的共识肤质分组 */
    consensusGroup: SkinTypeGroup;
}

function crossValidateSkinType(answers: Record<string, unknown>): CrossValidationResult {
    const selfReported = asString(answers.skinType).toLowerCase();
    const selfGroup = normalizeSkinType(selfReported);

    const evidence: { supported: SkinTypeGroup[] }[] = [];

    const morningVal = asString(answers.q_morningFeel).toLowerCase();
    if (morningVal && MORNING_FEEL_MAP[morningVal]) {
        evidence.push({ supported: MORNING_FEEL_MAP[morningVal] });
    }

    const afternoonVal = asString(answers.q_afternoonShine).toLowerCase();
    if (afternoonVal && AFTERNOON_SHINE_MAP[afternoonVal]) {
        evidence.push({ supported: AFTERNOON_SHINE_MAP[afternoonVal] });
    }

    const productVal = asString(answers.q_productPreference).toLowerCase();
    if (productVal && PRODUCT_PREF_MAP[productVal]) {
        evidence.push({ supported: PRODUCT_PREF_MAP[productVal] });
    }

    const reactivityVal = asString(answers.q_skinReactivity).toLowerCase();
    if (reactivityVal && SKIN_REACTIVITY_MAP[reactivityVal]) {
        evidence.push({ supported: SKIN_REACTIVITY_MAP[reactivityVal] });
    }

    if (evidence.length === 0) {
        return { confidence: 1, scorePenalty: 0, consensusGroup: selfGroup };
    }

    let matchesSelf = 0;
    let contradicts = 0;
    const groupVotes: Record<string, number> = {};

    for (const { supported } of evidence) {
        if (supported.includes(selfGroup)) {
            matchesSelf++;
        } else if (supported.includes("sensitive")) {
            // 证据指向敏感倾向，但用户自评不是敏感皮 → 中性
            // 敏感倾向可以叠加在任何肤质上，不构成矛盾
        } else if (selfGroup === "sensitive") {
            // 用户是敏感皮，但证据指向其他肤质分组（干/油/混合） → 中性
            // 敏感皮本来就可以与任何肤质并存，证据≠矛盾
        } else {
            contradicts++;
        }
        for (const g of supported) {
            groupVotes[g] = (groupVotes[g] || 0) + 1;
        }
    }

    const total = matchesSelf + contradicts;
    const confidence = total > 0 ? matchesSelf / total : 0.5;

    let maxVotes = 0;
    let consensusGroup: SkinTypeGroup = selfGroup;
    for (const [group, count] of Object.entries(groupVotes)) {
        if (count > maxVotes) {
            maxVotes = count;
            consensusGroup = group as SkinTypeGroup;
        }
    }

    let scorePenalty = 0;
    if (confidence <= 0.25) {
        scorePenalty = -12; // 强烈矛盾：用户自评肤质与症状表现完全不符
    } else if (confidence <= 0.5) {
        scorePenalty = -7; // 中度矛盾：部分症状与自评不一致
    } else if (confidence < 0.75) {
        scorePenalty = -3; // 轻微出入
    }

    return { confidence, scorePenalty, consensusGroup };
}

// ============================================================================
// 3. 评分算法：从问卷答案合成 0-100 分数
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
    const attitude = asString(answers.q_skincareAttitude).toLowerCase();
    const attitudeMod: Record<string, number> = {
        ritual: 3,
        explorer: 2,
        minimal: -2,
        lazy: -4,
    };
    score += attitudeMod[attitude] ?? 0;

    // --- 护肤动力（额外问题）---
    const motivation = asString(answers.q_skincareMotivation).toLowerCase();
    const motivationMod: Record<string, number> = {
        antiAging: 2,
        selfCare: 2,
        confidence: 1,
        social: 0,
    };
    score += motivationMod[motivation] ?? 0;

    // --- 日常环境 ---
    const dailyEnv = asString(answers.q_dailyEnv).toLowerCase();
    const envMod: Record<string, number> = {
        indoor_ac: -2,        // 空调/暖气 → 干燥环境加速水分流失
        indoor_normal: 1,     // 温湿度自然 → 对皮肤友好
        outdoor_city: -3,     // 城市户外 → 污染 + 紫外线
        outdoor_nature: 0,    // 大自然 → 空气好但紫外线强，正负抵消
    };
    score += envMod[dailyEnv] ?? 0;

    // --- 防晒习惯 —— 与户外活动交叉影响 ---
    const uvProtection = asString(answers.q_uvProtection).toLowerCase();
    const isHighUVEnv = dailyEnv === "outdoor_city" || dailyEnv === "outdoor_nature";

    if (isHighUVEnv && uvProtection === "rarely") {
        score -= 8;  // 户外 + 不防晒 → 累积光老化风险
    } else if (isHighUVEnv && uvProtection === "outdoor_only") {
        score -= 4;  // 户外 + 偶尔防晒 → 防护不充分
    } else if (isHighUVEnv && uvProtection === "daily") {
        score -= 1;  // 户外 + 日常防晒 → 基本到位
    } else if (dailyEnv === "indoor_ac" && uvProtection === "daily_high") {
        score += 2;  // 室内也防晒 → 护肤意识极强
    } else if (uvProtection === "rarely") {
        score -= 3;  // 即使室内为主，完全不防晒仍有累积伤害
    }

    // --- 运动频率 ---
    const exercise = asString(answers.q_exerciseHabit).toLowerCase();
    const exerciseMod: Record<string, number> = {
        daily: 2,          // 每天运动 → 血液循环好，有利皮肤代谢
        regular: 3,        // 规律运动 → 对皮肤状态正面影响
        occasional: 0,
        rarely: -4,        // 几乎不运动 → 代谢和循环偏弱
    };
    score += exerciseMod[exercise] ?? 0;

    // --- 运动 x 肤质交互 ---
    const isOilyOrCombo = skinType === "oily" || skinType === "combination_oily";
    const sweatsALot = exercise === "daily" || exercise === "regular";
    if (isOilyOrCombo && sweatsALot && uvProtection === "rarely") {
        score -= 2;  // 油皮 + 多汗 + 不防晒 → 毛孔堵塞/晒后出油加剧
    }

    // --- 饮水量 ---
    const water = asString(answers.q_waterIntake).toLowerCase();
    const waterMod: Record<string, number> = {
        abundant: 3,       // 2L+ → 体内水分充足，有利代谢
        moderate: 1,       // 1-2L → 正常水平
        little: -3,        // <1L → 身体可能处于轻度脱水
        beverages: -5,     // 饮料代替水 → 糖分+脱水双重影响
    };
    score += waterMod[water] ?? 0;

    // --- 饮水 x 肤质交互 ---
    const isDryOrDehydrated = skinType === "dry" || skinType === "combination_dry";
    if (isDryOrDehydrated && (water === "little" || water === "beverages")) {
        score -= 3;  // 干皮 + 饮水不足 → 干燥加剧
    }

    // --- 饮食习惯 ---
    const diet = asString(answers.q_dietHabit).toLowerCase();
    const dietMod: Record<string, number> = {
        balanced: 3,      // 均衡饮食 → 抗炎，有利皮肤
        greasy: -4,       // 油腻辛辣 → 促炎，加重痤疮
        sugary: -5,       // 高糖 → 糖化反应加速衰老
        irregular: -3,    // 不规律 → 营养素摄入不稳定
    };
    score += dietMod[diet] ?? 0;

    // --- 饮食 x 肤质交互 ---
    if (isOilyOrCombo && (diet === "greasy" || diet === "sugary")) {
        score -= 3;  // 油皮 + 高油高糖 → 痘痘风险显著增加
    }
    if (skinType === "sensitive" && diet === "greasy") {
        score -= 2;  // 敏感皮 + 辛辣刺激 → 泛红加重
    }

    // --- 化妆频率 ---
    const makeup = asString(answers.q_makeupFrequency).toLowerCase();
    const makeupMod: Record<string, number> = {
        daily_full: -2,    // 每天全妆 → 彩妆负担，需强力清洁
        daily_light: 0,    // 淡妆 → 负担较小
        occasional: 1,     // 偶尔 → 皮肤有呼吸空间
        never: 2,          // 不化妆 → 无彩妆负担
    };
    score += makeupMod[makeup] ?? 0;

    // --- 化妆 x 肤质交互 ---
    if ((skinType === "oily" || skinType === "combination_oily") && makeup === "daily_full") {
        score -= 3;  // 油皮 + 每天全妆 → 闷痘风险高
    }

    // --- 护肤流程复杂度 ---
    const routine = asString(answers.q_routineComplexity).toLowerCase();
    const routineMod: Record<string, number> = {
        minimal: -2,       // 过简 → 可能保湿/防护不足
        basic: 1,          // 3-4 步 → 适中有效
        advanced: 2,       // 5-6 步 → 精细护理
        elaborate: 0,      // 7 步+ → 可能过度护理，屏障负担
    };
    score += routineMod[routine] ?? 0;

    // --- 流程 x 预算 x 肤质交互 ---
    const budget = asString(answers.budget).toLowerCase();
    if (routine === "elaborate" && skinType === "sensitive") {
        score -= 3;  // 敏感皮 + 过度护理 → 屏障受损风险
    }
    if (routine === "minimal" && freq === "rarely" && budget === "budget") {
        score -= 2;  // 极简 + 几乎不护肤 + 预算低 → 三重怠慢信号
    }

    // --- 屏幕时间 ---
    const screenTime = asString(answers.q_screenTime).toLowerCase();
    const screenMod: Record<string, number> = {
        light: 2,        // 4h 以下 → 屏幕负担轻
        moderate: 0,     // 4-8h → 正常水平
        heavy: -3,       // 8-12h → 蓝光累积，低头姿势增加颈纹风险
        extreme: -5,     // 12h+ → 严重光老化风险 + 作息紊乱
    };
    score += screenMod[screenTime] ?? 0;

    // --- 屏幕 x 睡眠 x 肤质交互 ---
    if (screenTime === "extreme" && (sleep === "poor" || sleep === "fair")) {
        score -= 2;  // 超长屏幕 + 睡眠差 → 蓝光扰乱昼夜节律，修复受阻
    }
    const hasAgingConcern = concerns.some((c: string) => c === "aging");
    if (screenTime === "extreme" && hasAgingConcern) {
        score -= 2;  // 高蓝光环境 + 抗老诉求 → 光老化正在发生
    }

    // --- 差旅频率 ---
    const travel = asString(answers.q_travelFrequency).toLowerCase();
    const travelMod: Record<string, number> = {
        rarely: 1,        // 不出差 → 环境稳定，护肤节奏可控
        occasional: -1,   // 偶尔出行 → 轻微节奏扰动
        frequent: -4,     // 每周出差 → 飞机干燥+时差+水质变化
        constant: -6,     // 长期跨地域 → 持续温湿度冲击，屏障压力大
    };
    score += travelMod[travel] ?? 0;

    // --- 差旅 x 肤质交互 ---
    const frequentTraveler = travel === "frequent" || travel === "constant";
    if (frequentTraveler && skinType === "sensitive") {
        score -= 3;  // 敏感皮 + 频繁换环境 → 屏障反复受挑战
    }
    if (frequentTraveler && skinType === "dry") {
        score -= 2;  // 干皮 + 机舱干燥 → 缺水加剧
    }

    // --- 洁面习惯 ---
    const faceWashing = asString(answers.q_faceWashing).toLowerCase();
    const washingMod: Record<string, number> = {
        gentle: 3,         // 温和洁面 → 屏障友好的最佳实践
        overwash: -6,      // 过度清洁 → 直接损伤皮脂膜和屏障
        hot_cold: -5,      // 极端水温 → 刺激毛细血管，加重泛红
        casual: -2,        // 不讲究 → 可能用了不适合的产品
    };
    score += washingMod[faceWashing] ?? 0;

    // --- 洁面 x 肤质交互 ---
    if ((faceWashing === "overwash" || faceWashing === "hot_cold") && skinType === "sensitive") {
        score -= 4;  // 敏感皮 + 暴力洁面 → 屏障崩塌
    }
    if (faceWashing === "overwash" && (skinType === "oily" || skinType === "combination_oily")) {
        score -= 2;  // 油皮 + 过度清洁 → 报复性出油，越洗越油
    }

    // --- 面膜频率 ---
    const maskFrequency = asString(answers.q_maskFrequency).toLowerCase();
    const maskMod: Record<string, number> = {
        never: 0,                // 不敷 → 中性
        weekly: 2,               // 每周1-2次 → 适度补水
        every_other_day: -2,     // 隔天 → 频率偏高，水合过度风险
        daily: -6,               // 每天 → 水合性皮炎，角质层变脆弱
    };
    score += maskMod[maskFrequency] ?? 0;

    // --- 面膜 x 肤质交互 ---
    if (maskFrequency === "daily" && skinType === "sensitive") {
        score -= 3;  // 敏感皮 + 过度水合 → 屏障更加脆弱
    }

    // --- 肤质交叉验证修正 ---
    const cv = crossValidateSkinType(answers);
    score += cv.scorePenalty;

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
    const selfReportedSkinType = asString(answers.skinType || answers["skinType"]).toLowerCase();
    const budget = asString(answers.budget).toLowerCase();
    const skincareFrequency = asString(answers.skincareFrequency).toLowerCase();

    const cv = crossValidateSkinType(answers);

    // 交叉验证置信度低于 50% 时，使用症状反推的共识肤质替代用户自评
    const effectiveSkinType =
        cv.confidence < 0.5
            ? unnormalizeSkinType(cv.consensusGroup, selfReportedSkinType)
            : (selfReportedSkinType || "normal");

    const params: IPMatchParams = {
        score,
        skinType: effectiveSkinType,
        budget: budget || undefined,
        skincareFrequency: skincareFrequency || undefined,
    };

    const ip = matchCharacterIP(params);
    const route = IP_KEY_TO_ROUTE[ip.key] ?? "";

    return { route, name: ip.name, score };
}
