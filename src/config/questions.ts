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
}

export const DEFAULT_QUESTIONS: Question[] = [
    {
        id: "q1",
        fieldName: "skinType",
        question: "您感觉您的肤质属于哪一种？",
        type: "single",
        options: [
            { value: "dry", label: "干性 (紧绷、脱皮)", description: "洗脸后感觉紧绷，易脱皮" },
            { value: "oily", label: "油性 (全脸泛油)", description: "T区和脸颊都容易出油" },
            { value: "combination", label: "混合性 (T区油两颊干)", description: "T区油腻，脸颊干燥" },
            { value: "sensitive", label: "敏感 (易泛红)", description: "容易泛红、刺痛、过敏" },
            { value: "normal", label: "中性 (水油平衡)", description: "不油不干，状态稳定" },
        ],
    },
    {
        id: "q2",
        fieldName: "concerns",
        question: "您最想改善的肌肤问题是？",
        subtext: "可多选 (最多3项)",
        type: "multiple",
        options: [
            { value: "aging", label: "细纹/松弛" },
            { value: "acne", label: "痘痘/粉刺" },
            { value: "spots", label: "色斑/暗沉" },
            { value: "pores", label: "毛孔粗大" },
            { value: "dryness", label: "干燥缺水" },
            { value: "sensitivity", label: "敏感/泛红" },
            { value: "dark_circles", label: "黑眼圈/眼袋" },
        ],
    },
    {
        id: "q3",
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
        id: "q4",
        fieldName: "pregnancy",
        question: "您目前处于备孕期、孕期或哺乳期吗？",
        type: "single",
        options: [
            { value: "no", label: "否" },
            { value: "yes", label: "是" },
        ],
    },
    {
        id: "q5",
        fieldName: "medicalBeauty",
        question: "近三个月是否做过光电/酸类医美项目？",
        type: "single",
        options: [
            { value: "none", label: "无" },
            { value: "laser", label: "光子/激光类" },
            { value: "acid", label: "刷酸/焕肤类" },
            { value: "injection", label: "注射/微针类" },
        ],
        dependsOn: {
            field: "pregnancy",
            value: "no",
            operator: "equals"
        }
    },
    {
        id: "q6",
        fieldName: "sleepQuality", // Changed from sleep to sleepQuality to match code
        question: "您最近的睡眠质量如何？",
        type: "single",
        options: [
            { value: "good", label: "很好 (精力充沛)" },
            { value: "fair", label: "一般 (偶尔疲劳)" },
            { value: "poor", label: "较差 (经常熬夜/失眠)" },
        ],
    },
    {
        id: "q7",
        fieldName: "stressLevel",
        question: "您最近的工作/生活压力感受？",
        type: "single",
        options: [
            { value: "low", label: "轻松 (无明显压力)" },
            { value: "medium", label: "适中 (有一定压力)" },
            { value: "high", label: "很大 (焦虑/紧绷)" },
        ],
    },
    {
        id: "q8",
        fieldName: "menstrualCycle",
        question: "生理周期阶段 (女性用户选填)？",
        subtext: "用于精准匹配'生理期护肤'模式",
        type: "single",
        options: [
            { value: "na", label: "不适用 / 男士" },
            { value: "menstrual", label: "经期中 (第1-7天)" },
            { value: "follicular", label: "滤泡期 (经后一周/状态好)" },
            { value: "luteal", label: "黄体期 (经前一周/易冒痘)" },
        ],
    }
];
