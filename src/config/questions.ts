/**
 * 问卷问题默认配置
 */

export interface QuestionOption {
    value: string;
    label: string;
    description?: string;
    icon?: string;
    emoji?: string;
}

export interface Question {
    id: string;
    fieldName: string;
    question: string;
    type: "single" | "multiple";
    options: QuestionOption[];
    subtext?: string;
    /** 前置条件：只有满足条件时才显示此问题 */
    dependsOn?: {
        field: string;
        value: string | string[];
        operator?: 'equals' | 'notEquals' | 'contains';
    };
    /** 是否允许跳过（记录空值并继续） */
    skippable?: boolean;
}

export const DEFAULT_QUESTIONS: Question[] = [

    {
        id: "skinType",
        fieldName: "skinType",
        question: "您的肤质属于哪一种？",
        type: "single",
        options: [
            { value: "dry", label: "干性 (紧绷、脱皮)", description: "洗脸后感觉紧绷，易脱皮" },
            { value: "oily", label: "油性 (全脸泛油)", description: "T区和脸颊都容易出油" },
            { value: "combination_dry", label: "混干性 (T区油两颊干)", description: "T区油腻，脸颊干燥" },
            { value: "combination_oily", label: "混油性 (T区油两颊不干)", description: "T区出油，脸颊不干/偏油" },
            { value: "sensitive", label: "敏感 (易泛红)", description: "容易泛红、刺痛、过敏" },
            { value: "normal", label: "中性 (水油平衡)", description: "不油不干，状态稳定" },
        ],
    },
    {
        id: "primaryConcern",
        fieldName: "primaryConcern",
        question: "您最想改善的肌肤问题是？",
        subtext: "可多选（最多 3 项），完成后点击下一步",
        type: "multiple",
        options: [
            { value: "aging", label: "细纹/松弛", description: "眼周、法令纹、嘴角纹路" },
            { value: "acne", label: "痘痘/粉刺", description: "闭口、黑头、炎症痘、粉刺" },
            { value: "spots", label: "色斑/暗沉", description: "雀斑、晒斑、肤色不均" },
            { value: "dryness", label: "干燥缺水", description: "紧绷、起皮、卡粉" },
            { value: "sensitivity", label: "敏感/泛红", description: "易过敏、发红、刺痛" },
            { value: "dark_circles", label: "黑眼圈/眼袋", description: "眼周暗沉、浮肿" },
        ],
    },

    {
        id: "ageRange",
        fieldName: "ageRange",
        question: "您的年龄段是？",
        type: "single",
        options: [
            { value: "under20", label: "20岁以下" },
            { value: "20-25", label: "20-25岁" },
            { value: "26-30", label: "26-30岁" },
            { value: "31-40", label: "31-40岁" },
            { value: "41-50", label: "41-50岁" },
            { value: "above50", label: "50岁以上" },
        ],
    },
    {
        id: "pregnancy",
        fieldName: "pregnancy",
        question: "您目前处于备孕期、孕期或哺乳期吗？",
        type: "single",
        options: [
            { value: "no", label: "否" },
            { value: "yes", label: "是" },
        ],
    },
    {
        id: "medicalBeauty",
        fieldName: "medicalBeauty",
        question: "近三个月是否做过光电/酸类医美项目？",
        type: "single",
        options: [
            { value: "none", label: "无", description: "近期未做过任何医美项目" },
            { value: "laser", label: "光子/激光类", description: "光子嫩肤、热玛吉、点阵等" },
            { value: "acid", label: "刷酸/焕肤类", description: "果酸、水杨酸、壬二酸等" },
            { value: "injection", label: "注射/微针类", description: "水光针、微针、肉毒等" },
        ],
    },
    {
        id: "sleepQuality",
        fieldName: "sleepQuality",
        question: "您最近的睡眠质量如何？",
        type: "single",
        options: [
            { value: "good", label: "很好 (精力充沛)", description: "每晚睡眠质量高，晨起精神充沛" },
            { value: "fair", label: "一般 (偶尔疲劳)", description: "睡眠质量起伏不定" },
            { value: "poor", label: "较差 (经常熬夜/失眠)", description: "睡眠不足（如仅6小时），或难以入睡" },
        ],
    },
    {
        id: "stressLevel",
        fieldName: "stressLevel",
        question: "您最近的工作/生活压力感受？",
        type: "single",
        options: [
            { value: "low", label: "轻松 (无明显压力)", description: "心情平静，生活规律" },
            { value: "medium", label: "适中 (有一定压力)", description: "正常工作学习压力" },
            { value: "high", label: "很大 (焦虑/紧绷)", description: "经常感到焦虑或情绪波动" },
        ],
    },
    {
        id: "menstrualCycle",
        fieldName: "menstrualCycle",
        question: "您当前的生理周期阶段是？",
        subtext: "用于精准匹配生理期护肤模式",
        type: "single",
        options: [
            { value: "na", label: "不适用", description: "男性或绝经期等" },
            { value: "menstrual", label: "经期中 (第1-7天)", description: "肌肤敏感期，需温和护理" },
            { value: "follicular", label: "滤泡期 (经后一周/状态好)", description: "肌肤状态最佳，适合精细护理" },
            { value: "luteal", label: "黄体期 (经前一周/易冒痘)", description: "油脂分泌增加，注意清洁" },
        ],
    },
    {
        id: "allergies",
        fieldName: "allergies",
        question: "您有以下过敏情况吗？",
        subtext: "可多选，无过敏可跳过或选「没有过敏史」，完成后点击下一步",
        type: "multiple",
        skippable: true,
        options: [
            { value: "none", label: "没有过敏史", description: "从未对护肤品或成分过敏" },
            { value: "fragrance", label: "香精过敏", description: "对护肤品中的\"香精\"成分敏感" },
            { value: "alcohol", label: "酒精过敏", description: "对\"乙醇\"、\"变性乙醇\"等成分敏感" },
            { value: "acids", label: "酸类不耐受", description: "使用水杨酸、果酸等产品易刺痛泛红" },
            { value: "multiple", label: "多种过敏", description: "对多种成分或产品类型有过过敏反应" },
            { value: "unknown", label: "不太清楚", description: "不确定自己对哪些成分过敏" },
        ],
    },
    {
        id: "skincareFrequency",
        fieldName: "skincareFrequency",
        question: "您的日常护肤习惯是？",
        type: "single",
        options: [
            { value: "daily", label: "每天精细护肤", description: "早晚全套流程，精华面霜防晒不落" },
            { value: "regular", label: "经常护肤", description: "大部分时间坚持，偶尔偷懒" },
            { value: "occasional", label: "偶尔护肤", description: "想起来才护理，步骤简单" },
            { value: "rarely", label: "几乎不护肤", description: "洗脸即护肤，很少用护肤品" },
        ],
    },
    {
        id: "budget",
        fieldName: "budget",
        question: "您的护肤预算是？",
        type: "single",
        options: [
            { value: "budget", label: "追求性价比", description: "注重性价比，单品 500元以内" },
            { value: "mid", label: "中等预算", description: "兼顾成分与价格，单品 300-1000元" },
            { value: "premium", label: "品质优先", description: "追求卓越功效，单品 800-2000元" },
            { value: "luxury", label: "不设上限", description: "顶级奢华体验，不设预算上限" },
        ],
    },
];
