/**
 * 问题聚焦板块知识库
 *
 * 从十维分析中筛出问题维度（poor / fair / average），并并入 AI 检测出的
 * 具体症状清单（skinConditions），为每个问题提供：
 * - 基础成因（肤质/先天因素，恒展示）
 * - 生活习惯加重因素（仅当问卷数据佐证时展示，避免无数据指控）
 * - 护肤解决方案（可直接执行的动作）
 * - 生活方式建议（睡眠/饮食/运动/情绪，按数据可得性门控）
 *
 * 卡片分级：
 * - full：poor/fair 维度 + moderate/severe 症状（完整成因+方案）
 * - compact：average 维度 + mild 症状（仅描述+精简建议）
 */

import { DIMENSION_LABELS, DIMENSION_ORDER, type SkinCondition } from "@/lib/advisor-utils";

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

export type ProblemTier = "full" | "compact";

export interface ProblemCardData {
    key: string;
    label: string;
    tier: ProblemTier;
    source: "dimension" | "condition";
    /** 优先使用 AI 生成的维度解读，缺省时回退知识库文案 */
    description: string;
    score?: number;
    grade?: string;
    severity?: string;
    area?: string;
    basicCauses: string[];
    aggravatorGroups: AdviceGroup[];
    skincareActions: string[];
    lifestyleTipGroups: AdviceGroup[];
}

type AggravatorKey = "sleep" | "stress" | "care" | "sun";
type TipKey = "sleep" | "diet" | "exercise" | "mood";

interface ProblemEntry {
    description: string;
    basicCauses: string[];
    aggravators: Partial<Record<AggravatorKey, string[]>>;
    skincareActions: string[];
    lifestyleTips: Partial<Record<TipKey, string[]>>;
}

const GROUP_LABELS: Record<string, string> = {
    sleep: "睡眠",
    stress: "压力情绪",
    care: "护肤习惯",
    sun: "日晒",
    diet: "饮食",
    exercise: "运动",
    mood: "情绪",
};

export const PROBLEM_ENTRIES: Record<string, ProblemEntry> = {
    waterOil: {
        description: "T 区油脂分泌旺盛而两颊偏干，水油比例失衡",
        basicCauses: [
            "皮脂腺分泌活跃，T 区天生出油较多",
            "肌肤屏障锁水能力不足，水分流失加快",
        ],
        aggravators: {
            sleep: ["熬夜会刺激皮质醇升高，加剧皮脂分泌"],
            stress: ["压力大时皮脂腺更活跃，出油加重"],
            care: ["清洁不规律或过度清洁，破坏水油平衡"],
        },
        skincareActions: [
            "使用温和氨基酸洁面，早晚各一次，避免过度去脂",
            "分区护理：T 区用清爽控油产品，两颊加强保湿",
            "每周 1-2 次补水面膜，维持角质层含水量",
        ],
        lifestyleTips: {
            sleep: ["尽量在 23:30 前入睡，保证 7 小时以上睡眠"],
            diet: ["减少高糖高油食物，多摄入富含 Omega-3 的深海鱼"],
            exercise: ["运动出汗后及时温和清洁，避免油脂堆积"],
        },
    },
    skinTone: {
        description: "肤色整体不够均匀，存在局部暗沉或泛红",
        basicCauses: [
            "黑色素分布不均，局部代谢偏慢",
            "角质层厚薄不匀，影响光线反射",
        ],
        aggravators: {
            sleep: ["睡眠不足影响皮肤夜间代谢，暗沉加重"],
            stress: ["情绪波动易引起局部微循环不畅"],
            sun: ["紫外线刺激黑色素不均匀生成"],
        },
        skincareActions: [
            "坚持每日防晒，阻隔紫外线导致的色素沉着",
            "使用含烟酰胺或维生素 C 的精华改善暗沉",
            "每周 1 次温和去角质，促进角质更新",
        ],
        lifestyleTips: {
            sleep: ["保持规律作息，皮肤夜间代谢高峰在 23 点后"],
            diet: ["多摄入富含维生素 C 的蔬果，如猕猴桃、番茄"],
            exercise: ["规律有氧运动促进面部微循环"],
        },
    },
    spots: {
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
        skincareActions: [
            "每天使用 SPF30+ PA+++ 防晒霜并定时补涂",
            "使用含传明酸或曲酸的淡斑精华，需坚持 8 周以上",
            "已形成的深色斑建议咨询皮肤科或正规医美机构",
        ],
        lifestyleTips: {
            diet: ["适量摄入富含谷胱甘肽的食物，如番茄、芦笋"],
            sleep: ["充足睡眠有助于色素的夜间代谢"],
        },
    },
    wrinkles: {
        description: "眼周、法令纹等区域出现细纹，表情纹明显",
        basicCauses: [
            "胶原蛋白与弹力纤维随年龄自然流失",
            "表情肌反复收缩形成动态纹",
        ],
        aggravators: {
            sun: ["紫外线是破坏胶原蛋白的首要外因"],
            sleep: ["熬夜加速胶原流失，细纹更易显现"],
            stress: ["长期紧绷状态加速皮肤老化"],
        },
        skincareActions: [
            "使用含视黄醇或胜肽的抗老产品，建立耐受后长期使用",
            "做好基础保湿与防晒，减缓胶原流失",
            "配合面部按摩放松表情肌，减少表情纹加深",
        ],
        lifestyleTips: {
            diet: ["减少高糖食物，糖化反应会加速胶原变性"],
            sleep: ["保证 7 小时以上睡眠，胶原合成在夜间最活跃"],
            mood: ["保持轻松心态，避免长期皱眉等紧张表情"],
        },
    },
    uvDamage: {
        description: "皮肤已出现光老化迹象，如粗糙、色沉、细纹",
        basicCauses: [
            "紫外线 UVA/UVB 累积损伤真皮层",
            "光损伤引发自由基累积，破坏细胞结构",
        ],
        aggravators: {
            sun: ["防晒意识不足或补涂不及时"],
            care: ["防晒产品用量不足（每次需一枚硬币大小）"],
        },
        skincareActions: [
            "全年无休使用广谱防晒，室内近窗也要涂抹",
            "使用含维生素 E 或阿魏酸的抗氧化精华",
            "晚间使用含烟酰胺或泛醇的产品加强修护",
        ],
        lifestyleTips: {
            diet: ["多摄入抗氧化食物：蓝莓、绿茶、坚果"],
            exercise: ["规律运动提升皮肤抗氧化能力"],
        },
    },
    sensitivity: {
        description: "屏障偏薄，易受刺激出现泛红、刺痛",
        basicCauses: [
            "皮肤屏障功能薄弱，锁水与防护能力不足",
            "角质层偏薄，神经末梢敏感",
        ],
        aggravators: {
            sleep: ["睡眠不足削弱皮肤自我修护能力"],
            stress: ["压力会加剧炎症反应，敏感加重"],
            care: ["频繁更换护肤品或使用刺激性成分"],
        },
        skincareActions: [
            "精简护肤：洁面 + 修护乳 + 防晒三步即可",
            "使用含神经酰胺、泛醇（B5）的修护类产品",
            "暂停酸类、A 醇等功效成分，先修复屏障",
        ],
        lifestyleTips: {
            diet: ["减少辛辣刺激食物，避免饮酒"],
            mood: ["情绪平稳有助于降低皮肤炎症水平"],
            sleep: ["规律作息是屏障修护的基础"],
        },
    },
    darkCircles: {
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
        skincareActions: [
            "使用含咖啡因或维生素 K 的眼霜，配合按摩促循环",
            "睡前热敷眼周，晨起冷敷消浮肿",
            "严格防晒并佩戴墨镜，防止眼周色素加深",
        ],
        lifestyleTips: {
            sleep: ["保证 7-8 小时睡眠，减少连续熬夜"],
            exercise: ["每周 3 次以上运动促进全身循环"],
            diet: ["控制盐分摄入，减少眼周浮肿"],
        },
    },
    firmness: {
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
        skincareActions: [
            "使用含玻色因或胜肽的紧致产品",
            "早晚配合提拉按摩手法，促进循环",
            "规律运动，尤其力量训练可提升皮肤紧实度",
        ],
        lifestyleTips: {
            exercise: ["每周 2-3 次力量训练，改善肌肤支撑力"],
            diet: ["补充优质蛋白：鸡蛋、鱼类、豆制品"],
            sleep: ["睡眠充足时生长激素分泌更旺盛"],
        },
    },
    acne: {
        description: "T 区、下巴等部位可见粉刺、闭口或炎性痘痘",
        basicCauses: [
            "毛囊口角化异常，皮脂排出不畅",
            "痤疮丙酸杆菌活跃引发炎症",
        ],
        aggravators: {
            sleep: ["熬夜导致内分泌波动，痘痘反复"],
            stress: ["压力升高皮质醇，油脂分泌增加"],
            care: ["清洁不彻底或带妆入睡"],
        },
        skincareActions: [
            "使用含水杨酸（BHA）的产品疏通毛孔",
            "选择清爽不致痘的保湿产品，避免厚重质地",
            "不要手挤痘痘，炎症期可点涂过氧化苯甲酰",
        ],
        lifestyleTips: {
            diet: ["减少高糖、高油食物及脱脂牛奶，有助于改善痤疮"],
            sleep: ["规律作息，避免熬夜打乱内分泌节律"],
            mood: ["保持情绪平稳，压力大时痘痘更易爆发"],
            exercise: ["运动后及时清洁，避免汗液刺激"],
        },
    },
    radiance: {
        description: "皮肤光泽度不足，整体偏暗沉、缺少通透感",
        basicCauses: [
            "角质层堆积，表面不平整影响反光",
            "肌肤微循环偏慢，营养供给不足",
        ],
        aggravators: {
            sleep: ["熬夜后角质代谢变慢，暗沉立现"],
            stress: ["疲劳状态下面部循环变差"],
            care: ["去角质不足，老废角质堆积"],
        },
        skincareActions: [
            "每周 1-2 次温和果酸或乳酸焕肤，提亮肤质",
            "使用含维生素 C 的精华抗氧化提亮",
            "加强保湿，充盈角质层提升通透感",
        ],
        lifestyleTips: {
            exercise: ["规律运动促进循环，气色更红润"],
            diet: ["每天饮水 1500-2000ml，适量摄入新鲜水果"],
            sleep: ["优质睡眠是肌肤焕新最经济的投资"],
        },
    },
};

const FOCUS_GRADES = new Set(["poor", "fair", "average"]);
const GRADE_ORDER: Record<string, number> = { poor: 0, fair: 1, average: 2 };
const SEVERITY_ORDER: Record<string, number> = { severe: 0, moderate: 1, mild: 2 };

// AI 症状名（自由文本）→ 知识库维度映射，按顺序匹配，先命中先得
const CONDITION_KEYWORD_MAP: Array<{ keywords: string[]; dimKey: string }> = [
    { keywords: ["黑头", "闭口", "粉刺", "毛孔", "痘痘", "痤疮", "丘疹"], dimKey: "acne" },
    { keywords: ["色斑", "晒斑", "雀斑", "色沉", "色素", "痘印"], dimKey: "spots" },
    { keywords: ["泛红", "红血丝", "敏感", "刺痛", "发红", "红肿", "屏障"], dimKey: "sensitivity" },
    { keywords: ["黑眼圈", "眼袋", "浮肿"], dimKey: "darkCircles" },
    { keywords: ["细纹", "皱纹", "干纹", "法令纹", "表情纹"], dimKey: "wrinkles" },
    { keywords: ["干燥", "脱皮", "紧绷", "缺水", "出油", "油光"], dimKey: "waterOil" },
    { keywords: ["松弛", "下垂", "不紧致", "垮"], dimKey: "firmness" },
    { keywords: ["暗沉", "粗糙", "无光泽", "蜡黄"], dimKey: "radiance" },
    { keywords: ["肤色不均"], dimKey: "skinTone" },
];

function matchConditionDimKey(condition: string): string | null {
    for (const { keywords, dimKey } of CONDITION_KEYWORD_MAP) {
        if (keywords.some((kw) => condition.includes(kw))) return dimKey;
    }
    return null;
}

function pushGroup(
    groups: AdviceGroup[],
    category: string,
    items: string[] | undefined
): void {
    if (items && items.length > 0) {
        groups.push({ category, label: GROUP_LABELS[category] ?? category, items });
    }
}

/** 根据问卷答案构建加重因素与生活方式建议分组 */
function buildAdviceGroups(entry: ProblemEntry, answers: LifestyleAnswers) {
    const aggravatorGroups: AdviceGroup[] = [];
    if (answers.sleepQuality && answers.sleepQuality !== "good") {
        pushGroup(aggravatorGroups, "sleep", entry.aggravators.sleep);
    }
    if (answers.stressLevel && answers.stressLevel !== "low") {
        pushGroup(aggravatorGroups, "stress", entry.aggravators.stress);
    }
    if (
        answers.skincareFrequency &&
        ["occasional", "rarely"].includes(answers.skincareFrequency)
    ) {
        pushGroup(aggravatorGroups, "care", entry.aggravators.care);
    }
    pushGroup(aggravatorGroups, "sun", entry.aggravators.sun);

    const lifestyleTipGroups: AdviceGroup[] = [];
    if (answers.sleepQuality && answers.sleepQuality !== "good") {
        pushGroup(lifestyleTipGroups, "sleep", entry.lifestyleTips.sleep);
    }
    pushGroup(lifestyleTipGroups, "diet", entry.lifestyleTips.diet);
    pushGroup(lifestyleTipGroups, "exercise", entry.lifestyleTips.exercise);
    if (answers.stressLevel && answers.stressLevel !== "low") {
        pushGroup(lifestyleTipGroups, "mood", entry.lifestyleTips.mood);
    }
    return { aggravatorGroups, lifestyleTipGroups };
}

/** 卡片排序权重：严重问题在前，轻度关注在后；同档按分数升序 */
function cardSortWeight(card: ProblemCardData): [number, number] {
    if (card.grade) {
        const rank = GRADE_ORDER[card.grade] ?? 3;
        return [rank, card.score ?? 999];
    }
    const rank = SEVERITY_ORDER[card.severity ?? "mild"] ?? 3;
    return [rank, 999];
}

/**
 * 构建问题聚焦卡片：
 * - 维度：poor/fair → full 卡；average → compact 卡；good/excellent 忽略
 * - skinConditions：moderate/severe → full 卡；mild → compact 卡；
 *   关键词映射到知识库，映射维度已有卡时跳过，避免重复；无法映射时忽略
 * - 加重因素仅在有问卷数据佐证时展示（日晒为环境因素恒展示）
 * - 排序：poor/severe → fair/moderate → average/mild，同级按分数升序
 */
export function buildProblemCards(
    dimensions:
        | Record<string, { score?: number; grade?: string; details?: string } | undefined>
        | undefined,
    answers: LifestyleAnswers = {},
    skinConditions?: SkinCondition[] | null
): ProblemCardData[] {
    const cards: ProblemCardData[] = [];
    const dimensionKeysWithCard = new Set<string>();

    if (dimensions) {
        for (const key of DIMENSION_ORDER) {
            const dim = dimensions[key];
            const entry = PROBLEM_ENTRIES[key];
            if (!dim || !entry || !dim.grade || !FOCUS_GRADES.has(dim.grade)) continue;

            const { aggravatorGroups, lifestyleTipGroups } = buildAdviceGroups(entry, answers);
            dimensionKeysWithCard.add(key);
            cards.push({
                key,
                label: DIMENSION_LABELS[key] ?? key,
                tier: dim.grade === "average" ? "compact" : "full",
                source: "dimension",
                description: dim.details || entry.description,
                score: dim.score ?? 0,
                grade: dim.grade,
                basicCauses: entry.basicCauses,
                aggravatorGroups,
                skincareActions: entry.skincareActions,
                lifestyleTipGroups,
            });
        }
    }

    const usedConditionDimKeys = new Set<string>();
    if (skinConditions && skinConditions.length > 0) {
        skinConditions.forEach((condition, index) => {
            if (!condition?.condition) return;
            const dimKey = matchConditionDimKey(condition.condition);
            if (!dimKey || dimensionKeysWithCard.has(dimKey) || usedConditionDimKeys.has(dimKey)) {
                return;
            }
            const entry = PROBLEM_ENTRIES[dimKey];
            if (!entry) return;
            usedConditionDimKeys.add(dimKey);

            const severity = condition.severity || "mild";
            const { aggravatorGroups, lifestyleTipGroups } = buildAdviceGroups(entry, answers);
            cards.push({
                key: `condition-${index}`,
                label: condition.condition,
                tier: severity === "mild" ? "compact" : "full",
                source: "condition",
                description: condition.description || entry.description,
                severity,
                area: condition.area || undefined,
                basicCauses: entry.basicCauses,
                aggravatorGroups,
                skincareActions: entry.skincareActions,
                lifestyleTipGroups,
            });
        });
    }

    cards.sort((a, b) => {
        const [ar, as] = cardSortWeight(a);
        const [br, bs] = cardSortWeight(b);
        return ar - br || as - bs;
    });
    return cards;
}
