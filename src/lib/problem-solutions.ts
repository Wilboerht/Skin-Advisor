/**
 * 重点问题关注板块知识库
 *
 * 以用户视角的具体问题（暗沉、黑头、痘痘、黑眼圈、细纹等）为单位：
 * - 存在性判断：对应维度分数 <70，或 AI 症状清单（skinConditions）检测到
 * - 程度量化：分数档位（<40 重度 / 40-54 中度 / 55-69 轻度）或症状严重度
 * - 成因科普：基础成因（恒展示）+ 不良因素影响加量（仅当问卷数据佐证时展示）
 * - 解决方法：护肤、睡眠、饮食、运动、情绪、压力 六类分组
 */

import { DIMENSION_LABELS, type SkinCondition } from "@/lib/advisor-utils";

export interface LifestyleAnswers {
    sleepQuality?: string;      // good | fair | poor
    stressLevel?: string;       // low | medium | high
    skincareFrequency?: string; // daily | regular | occasional | rarely
}

export interface AdviceGroup {
    category: string;
    label: string;
    items: string[];
}

export type ConcernLevel = "severe" | "moderate" | "mild";

export interface FocusProblemData {
    key: string;
    /** 用户视角问题名，如「黑头」「暗沉」 */
    name: string;
    /** 量化程度 */
    level: ConcernLevel;
    /** 对应维度分数（<70 时展示进度条量化） */
    score?: number;
    /** AI 症状描述或知识库描述 */
    description: string;
    /** AI 检测到的部位 */
    area?: string;
    /** 是否由 AI 症状检测出（而非仅分数推断） */
    detected?: boolean;
    basicCauses: string[];
    aggravatorGroups: AdviceGroup[];
    solutionGroups: AdviceGroup[];
}

type AggravatorKey = "sleep" | "stress" | "care" | "sun";
type SolutionKey = "skincare" | "sleep" | "diet" | "exercise" | "mood" | "stress";

interface FocusProblemEntry {
    key: string;
    name: string;
    /** 用于量化分数的十维 key */
    dimensionKey: string;
    description: string;
    basicCauses: string[];
    aggravators: Partial<Record<AggravatorKey, string[]>>;
    solutions: Partial<Record<SolutionKey, string[]>>;
}

const SOLUTION_GROUP_LABELS: Record<SolutionKey, string> = {
    skincare: "护肤",
    sleep: "睡眠",
    diet: "饮食",
    exercise: "运动",
    mood: "情绪",
    stress: "压力",
};

const SOLUTION_GROUP_ORDER: SolutionKey[] = ["skincare", "sleep", "diet", "exercise", "mood", "stress"];

const AGGRAVATOR_LABELS: Record<AggravatorKey, string> = {
    sleep: "睡眠",
    stress: "压力情绪",
    care: "护肤习惯",
    sun: "日晒",
};

export const FOCUS_PROBLEM_ENTRIES: FocusProblemEntry[] = [
    {
        key: "dullness",
        name: "暗沉",
        dimensionKey: "radiance",
        description: "肤色偏暗、缺少光泽与通透感，整体气色欠佳",
        basicCauses: [
            "角质层堆积，表面不平整影响光线反射",
            "肌肤微循环偏慢，代谢废物排出不畅",
        ],
        aggravators: {
            sleep: ["熬夜后角质代谢变慢，暗沉立现"],
            stress: ["疲劳压力下面部循环变差"],
            care: ["去角质不足，老废角质堆积"],
        },
        solutions: {
            skincare: [
                "每周 1-2 次温和酸类焕肤，提亮肤质",
                "使用含维生素 C 的精华抗氧化提亮",
                "加强保湿，充盈角质层提升通透感",
            ],
            sleep: ["保证 7 小时以上睡眠，把握肌肤夜间修复黄金期"],
            diet: ["每天饮水 1500-2000ml，多吃蓝莓、番茄等抗氧化食物"],
            exercise: ["每周 3 次有氧运动，促进面部血液循环"],
            mood: ["保持心情舒畅，长期情绪低落会影响气色"],
            stress: ["压力大时做深呼吸放松，减轻皮质醇对肤色的影响"],
        },
    },
    {
        key: "blackheads",
        name: "黑头",
        dimensionKey: "acne",
        description: "鼻翼、鼻头等部位可见黑色小点，属于开放性粉刺",
        basicCauses: [
            "皮脂分泌旺盛，油脂氧化后变黑",
            "毛囊口角化异常，皮脂排出不畅",
        ],
        aggravators: {
            sleep: ["熬夜使皮脂分泌增加，黑头更明显"],
            stress: ["压力刺激皮脂腺活跃，出油增多"],
            care: ["清洁不彻底，防晒彩妆残留堵塞毛孔"],
        },
        solutions: {
            skincare: [
                "使用含水杨酸的洁面产品早晚清洁",
                "每周 1-2 次泥膜吸附多余油脂",
                "不要手挤，可用温和鼻贴后配合收敛护理",
            ],
            sleep: ["规律作息，熬夜是油脂分泌的催化剂"],
            diet: ["减少高糖高油食物，避免刺激皮脂分泌"],
            exercise: ["运动出汗后及时温和清洁，避免油脂堆积"],
            mood: ["保持情绪平稳，情绪波动会加重出油"],
            stress: ["学会减压，压力是皮脂分泌的催化剂"],
        },
    },
    {
        key: "acne",
        name: "痘痘",
        dimensionKey: "acne",
        description: "面部可见炎性痘痘或闭口，按压有轻微痛感",
        basicCauses: [
            "毛囊堵塞后痤疮丙酸杆菌活跃，引发炎症",
            "皮脂分泌与角质代谢失衡",
        ],
        aggravators: {
            sleep: ["熬夜导致内分泌波动，痘痘反复发作"],
            stress: ["压力升高皮质醇，油脂分泌增加"],
            care: ["带妆入睡或清洁过度破坏屏障"],
        },
        solutions: {
            skincare: [
                "使用含水杨酸的产品疏通毛孔",
                "炎症期点涂过氧化苯甲酰，不要手挤",
                "选择清爽不致痘的保湿产品",
            ],
            sleep: ["尽量 23:30 前入睡，避免熬夜打乱内分泌节律"],
            diet: ["减少高糖、高油食物及脱脂牛奶，有助于改善痤疮"],
            exercise: ["规律运动促进代谢，运动后及时清洁"],
            mood: ["保持情绪平稳，压力大时痘痘更易爆发"],
            stress: ["通过运动、倾诉等方式减压，减少压力性爆痘"],
        },
    },
    {
        key: "darkCircles",
        name: "黑眼圈",
        dimensionKey: "darkCircles",
        description: "眼周色素沉着或循环不畅，黑眼圈明显",
        basicCauses: [
            "眼周皮肤薄，血管易透出形成青色阴影",
            "色素型黑眼圈与色素代谢慢有关",
        ],
        aggravators: {
            sleep: ["熬夜与用眼过度是黑眼圈最直接的诱因"],
            stress: ["疲劳压力使眼周循环变差"],
            care: ["卸妆不彻底，残留彩妆加重眼周色素"],
        },
        solutions: {
            skincare: [
                "使用含咖啡因或维生素 K 的眼霜，配合按摩促循环",
                "睡前热敷眼周，晨起冷敷消浮肿",
                "严格防晒并佩戴墨镜，防止眼周色素加深",
            ],
            sleep: ["保证 7-8 小时睡眠，减少连续熬夜"],
            diet: ["控制盐分摄入减少浮肿，适量补充含铁食物"],
            exercise: ["每周 3 次以上运动促进全身循环"],
            mood: ["放松心情，疲劳是黑眼圈的放大器"],
            stress: ["减少精神内耗，压力影响睡眠进而加重黑眼圈"],
        },
    },
    {
        key: "fineLines",
        name: "细纹",
        dimensionKey: "wrinkles",
        description: "眼周、法令纹等处可见干纹、细纹或表情纹",
        basicCauses: [
            "胶原蛋白与弹力纤维随年龄自然流失",
            "表情肌反复收缩形成动态纹",
        ],
        aggravators: {
            sun: ["紫外线是破坏胶原蛋白的首要外因"],
            sleep: ["熬夜加速胶原流失，细纹更易显现"],
            stress: ["长期紧绷状态加速皮肤老化"],
        },
        solutions: {
            skincare: [
                "使用含视黄醇或胜肽的抗老产品，建立耐受后长期使用",
                "做好基础保湿与防晒，减缓胶原流失",
                "配合面部按摩放松表情肌，减少表情纹加深",
            ],
            sleep: ["保证 7 小时以上睡眠，胶原合成在夜间最活跃"],
            diet: ["减少高糖食物，糖化反应会加速胶原变性"],
            exercise: ["规律有氧运动提升皮肤抗氧化能力"],
            mood: ["保持轻松心态，避免长期皱眉等紧张表情"],
            stress: ["压力会加速衰老，通过冥想、运动等方式放松"],
        },
    },
    {
        key: "spots",
        name: "色斑",
        dimensionKey: "spots",
        description: "面部可见色斑或色素沉着，集中在颧骨、鼻梁等部位",
        basicCauses: [
            "黑色素在表皮层堆积，形成可见色斑",
            "遗传性色素体质，斑点更易显现",
        ],
        aggravators: {
            sun: ["日晒是色斑加深与新增的首要诱因"],
            sleep: ["熬夜影响黑色素代谢，色素更易沉着"],
            stress: ["压力引发的炎症反应可促进色素生成"],
        },
        solutions: {
            skincare: [
                "每天使用 SPF30+ PA+++ 防晒霜并定时补涂",
                "使用含传明酸或曲酸的淡斑精华，坚持 8 周以上",
                "已形成的深色斑建议咨询皮肤科或正规医美机构",
            ],
            sleep: ["充足睡眠有助于色素的夜间代谢"],
            diet: ["适量摄入富含谷胱甘肽的食物，如番茄、芦笋"],
            exercise: ["规律运动促进代谢，帮助色素分解"],
            mood: ["保持好心态，情绪稳定有利于内分泌平衡"],
            stress: ["减少压力引发的炎症反应，避免色素加重"],
        },
    },
    {
        key: "redness",
        name: "泛红敏感",
        dimensionKey: "sensitivity",
        description: "面部易泛红、刺痛或发热，屏障耐受度偏低",
        basicCauses: [
            "皮肤屏障功能薄弱，锁水与防护能力不足",
            "角质层偏薄，神经末梢敏感",
        ],
        aggravators: {
            sleep: ["睡眠不足削弱皮肤自我修护能力"],
            stress: ["压力会加剧炎症反应，敏感加重"],
            care: ["频繁更换护肤品或使用刺激性成分"],
        },
        solutions: {
            skincare: [
                "精简护肤：洁面 + 修护乳 + 防晒三步即可",
                "使用含神经酰胺、泛醇（B5）的修护类产品",
                "暂停酸类、A 醇等功效成分，先修复屏障",
            ],
            sleep: ["规律作息是屏障修护的基础"],
            diet: ["减少辛辣刺激食物，避免饮酒"],
            exercise: ["选择温和运动，避免大汗刺激皮肤"],
            mood: ["情绪平稳有助于降低皮肤炎症水平"],
            stress: ["减压是敏感肌护理的重要一环，压力会加重泛红"],
        },
    },
    {
        key: "dryness",
        name: "干燥",
        dimensionKey: "waterOil",
        description: "皮肤干燥紧绷，易起皮、上妆卡粉",
        basicCauses: [
            "肌肤屏障锁水能力不足，水分流失加快",
            "皮脂分泌偏少，天然保湿膜不完整",
        ],
        aggravators: {
            sleep: ["熬夜影响保湿因子的夜间生成"],
            stress: ["压力扰乱水油平衡，加重干燥"],
            care: ["过度清洁去脂，破坏屏障"],
        },
        solutions: {
            skincare: [
                "使用温和氨基酸洁面，避免过度去脂",
                "使用含玻尿酸、泛醇的保湿精华",
                "叠加面霜锁水，干燥季可用护肤油",
            ],
            sleep: ["睡眠充足时肌肤自我修复能力更强"],
            diet: ["多喝水，多摄入富含 Omega-3 的深海鱼"],
            exercise: ["适度运动促进循环，改善肌肤供血"],
            mood: ["心情舒畅有助于内分泌稳定"],
            stress: ["压力大会加重干燥，注意调节节奏"],
        },
    },
    {
        key: "sagging",
        name: "松弛",
        dimensionKey: "firmness",
        description: "皮肤弹性下降，轮廓有松弛趋势",
        basicCauses: [
            "胶原蛋白与弹力蛋白合成速度下降",
            "真皮层支撑结构随年龄变薄",
        ],
        aggravators: {
            sleep: ["睡眠不足影响胶原合成高峰期的修复"],
            stress: ["长期压力加速胶原降解"],
            care: ["忽视颈部与轮廓线的护理"],
        },
        solutions: {
            skincare: [
                "使用含玻色因或胜肽的紧致产品",
                "早晚配合提拉按摩手法，促进循环",
                "颈部与下颌线同样需要护理",
            ],
            sleep: ["优质睡眠促进生长激素分泌，帮助修复"],
            diet: ["补充优质蛋白：鸡蛋、鱼类、豆制品"],
            exercise: ["每周 2-3 次力量训练，改善肌肤支撑力"],
            mood: ["保持积极心态，精气神也会影响状态"],
            stress: ["长期压力加速衰老，学会为自己放松"],
        },
    },
];

// AI 症状名（自由文本）→ 问题维度映射，按顺序匹配，先命中先得
const CONDITION_KEYWORD_MAP: Array<{ keywords: string[]; dimensionKey: string }> = [
    { keywords: ["黑头", "闭口", "粉刺", "毛孔", "痘痘", "痤疮", "丘疹"], dimensionKey: "acne" },
    { keywords: ["色斑", "晒斑", "雀斑", "色沉", "色素", "痘印"], dimensionKey: "spots" },
    { keywords: ["泛红", "红血丝", "敏感", "刺痛", "发红", "红肿", "屏障"], dimensionKey: "sensitivity" },
    { keywords: ["黑眼圈", "眼袋", "浮肿"], dimensionKey: "darkCircles" },
    { keywords: ["细纹", "皱纹", "干纹", "法令纹", "表情纹"], dimensionKey: "wrinkles" },
    { keywords: ["干燥", "脱皮", "紧绷", "缺水", "出油", "油光"], dimensionKey: "waterOil" },
    { keywords: ["松弛", "下垂", "不紧致", "垮"], dimensionKey: "firmness" },
    { keywords: ["暗沉", "粗糙", "无光泽", "蜡黄", "肤色不均"], dimensionKey: "radiance" },
];

function matchConditionDimKey(condition: string): string | null {
    for (const { keywords, dimensionKey } of CONDITION_KEYWORD_MAP) {
        if (keywords.some((kw) => condition.includes(kw))) return dimensionKey;
    }
    return null;
}

const LEVEL_ORDER: Record<ConcernLevel, number> = { severe: 0, moderate: 1, mild: 2 };

function levelFromScore(score: number | undefined): ConcernLevel | null {
    if (score === undefined || Number.isNaN(score)) return null;
    if (score < 40) return "severe";
    if (score < 55) return "moderate";
    if (score < 70) return "mild";
    return null;
}

function severityToLevel(severity: string | undefined): ConcernLevel | null {
    if (severity === "severe") return "severe";
    if (severity === "moderate") return "moderate";
    if (severity === "mild") return "mild";
    return null;
}

/** 取两个程度中更严重的一个 */
function worseLevel(a: ConcernLevel | null, b: ConcernLevel | null): ConcernLevel | null {
    if (!a) return b;
    if (!b) return a;
    return LEVEL_ORDER[a] <= LEVEL_ORDER[b] ? a : b;
}

function buildAggravatorGroups(
    entry: FocusProblemEntry,
    answers: LifestyleAnswers
): AdviceGroup[] {
    const groups: AdviceGroup[] = [];
    const push = (key: AggravatorKey, items: string[] | undefined) => {
        if (items && items.length > 0) {
            groups.push({ category: key, label: AGGRAVATOR_LABELS[key], items });
        }
    };
    if (answers.sleepQuality && answers.sleepQuality !== "good") {
        push("sleep", entry.aggravators.sleep);
    }
    if (answers.stressLevel && answers.stressLevel !== "low") {
        push("stress", entry.aggravators.stress);
    }
    if (
        answers.skincareFrequency &&
        ["occasional", "rarely"].includes(answers.skincareFrequency)
    ) {
        push("care", entry.aggravators.care);
    }
    push("sun", entry.aggravators.sun);
    return groups;
}

function buildSolutionGroups(entry: FocusProblemEntry): AdviceGroup[] {
    return SOLUTION_GROUP_ORDER.flatMap((key) => {
        const items = entry.solutions[key];
        if (!items || items.length === 0) return [];
        return [{ category: key, label: SOLUTION_GROUP_LABELS[key], items }];
    });
}

/**
 * 构建重点问题关注卡片：
 * - 问题存在性：对应维度分数 <70，或 AI 症状清单检测到该问题
 * - 程度量化：分数档位（<40 重度 / 40-54 中度 / 55-69 轻度）与症状严重度取更严重者
 * - 不良因素加重仅在有问卷数据佐证时展示（日晒为环境因素恒展示）
 * - 解决方案按 护肤/睡眠/饮食/运动/情绪/压力 分组全量展示
 * - 排序：重度 → 中度 → 轻度，同级按分数升序
 */
export function buildFocusProblems(
    dimensions:
        | Record<string, { score?: number; grade?: string; details?: string } | undefined>
        | undefined,
    answers: LifestyleAnswers = {},
    skinConditions?: SkinCondition[] | null
): FocusProblemData[] {
    const dimensionOf = (dimKey: string) => dimensions?.[dimKey];

    const problems: FocusProblemData[] = [];

    for (const entry of FOCUS_PROBLEM_ENTRIES) {
        const dim = dimensionOf(entry.dimensionKey);
        const dimScore = typeof dim?.score === "number" && !Number.isNaN(dim.score)
            ? dim.score
            : undefined;

        const matchedConditions = (skinConditions ?? []).filter(
            (c) => c?.condition && matchConditionDimKey(c.condition) === entry.dimensionKey
        );
        const firstCondition = matchedConditions[0];

        // 存在性：分数 <70 或 AI 检测到该问题（两者皆无则跳过）
        const scoreLevel = levelFromScore(dimScore);
        const conditionLevel = severityToLevel(firstCondition?.severity);
        if (!scoreLevel && !conditionLevel) continue;
        const level = worseLevel(scoreLevel, conditionLevel) ?? "mild";

        // 分数 ≥70 时靠 AI 检测出卡：不显示分数条，标记 detected
        const detected = dimScore === undefined || dimScore >= 70;

        problems.push({
            key: entry.key,
            name: entry.name,
            level,
            score: dimScore,
            description: firstCondition?.description || entry.description,
            area: firstCondition?.area || undefined,
            detected: detected || undefined,
            basicCauses: entry.basicCauses,
            aggravatorGroups: buildAggravatorGroups(entry, answers),
            solutionGroups: buildSolutionGroups(entry),
        });
    }

    problems.sort((a, b) => {
        const rankDiff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
        if (rankDiff !== 0) return rankDiff;
        return (a.score ?? 999) - (b.score ?? 999);
    });
    return problems;
}

/** 供其他模块复用：问题名 → 维度中文名 */
export { DIMENSION_LABELS };
