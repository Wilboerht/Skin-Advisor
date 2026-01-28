/**
 * 护肤步骤定义与工具函数
 */

// 护肤步骤枚举
export type SkincareStep =
    | 'cleanser'    // 洁面
    | 'toner'       // 化妆水/爽肤水
    | 'essence'     // 精华液
    | 'serum'       // 精华
    | 'eye_cream'   // 眼霜
    | 'cream'       // 面霜
    | 'sunscreen'   // 防晒
    | 'mask'        // 面膜
    | 'oil'         // 护肤油
    | 'other';      // 其他

// 步骤配置
export interface StepConfig {
    id: SkincareStep;
    label: string;
    labelEn: string;
    icon: string;
    order: number;
    timeOfDay: ('morning' | 'evening' | 'both')[];
    description: string;
}

// 步骤配置详情
export const SKINCARE_STEPS: Record<SkincareStep, StepConfig> = {
    cleanser: {
        id: 'cleanser',
        label: '洁面',
        labelEn: 'Cleanser',
        icon: '🧴',
        order: 1,
        timeOfDay: ['morning', 'evening', 'both'],
        description: '温和清洁，去除污垢'
    },
    toner: {
        id: 'toner',
        label: '化妆水',
        labelEn: 'Toner',
        icon: '💧',
        order: 2,
        timeOfDay: ['morning', 'evening', 'both'],
        description: '二次清洁，调理肌肤'
    },
    essence: {
        id: 'essence',
        label: '精华液',
        labelEn: 'Essence',
        icon: '✨',
        order: 3,
        timeOfDay: ['morning', 'evening', 'both'],
        description: '高浓度活性成分'
    },
    serum: {
        id: 'serum',
        label: '精华',
        labelEn: 'Serum',
        icon: '🧪',
        order: 4,
        timeOfDay: ['morning', 'evening', 'both'],
        description: '针对性功效护理'
    },
    eye_cream: {
        id: 'eye_cream',
        label: '眼霜',
        labelEn: 'Eye Cream',
        icon: '👁️',
        order: 5,
        timeOfDay: ['morning', 'evening', 'both'],
        description: '眼周专属护理'
    },
    cream: {
        id: 'cream',
        label: '面霜',
        labelEn: 'Moisturizer',
        icon: '🫧',
        order: 6,
        timeOfDay: ['morning', 'evening', 'both'],
        description: '锁水保湿屏障'
    },
    sunscreen: {
        id: 'sunscreen',
        label: '防晒',
        labelEn: 'Sunscreen',
        icon: '☀️',
        order: 7,
        timeOfDay: ['morning'],
        description: '紫外线防护'
    },
    mask: {
        id: 'mask',
        label: '面膜',
        labelEn: 'Mask',
        icon: '🎭',
        order: 8,
        timeOfDay: ['evening'],
        description: '深层滋养修护'
    },
    oil: {
        id: 'oil',
        label: '护肤油',
        labelEn: 'Face Oil',
        icon: '🍯',
        order: 9,
        timeOfDay: ['evening'],
        description: '封闭锁水'
    },
    other: {
        id: 'other',
        label: '其他',
        labelEn: 'Other',
        icon: '📦',
        order: 99,
        timeOfDay: ['both'],
        description: '其他护肤产品'
    }
};

// 步骤排序列表
export const STEP_ORDER: SkincareStep[] = [
    'cleanser',
    'toner',
    'essence',
    'serum',
    'eye_cream',
    'cream',
    'sunscreen',
    'mask',
    'oil',
    'other'
];

// 早间/晚间步骤
export const MORNING_STEPS: SkincareStep[] = ['cleanser', 'toner', 'essence', 'serum', 'eye_cream', 'cream', 'sunscreen'];
export const EVENING_STEPS: SkincareStep[] = ['cleanser', 'toner', 'essence', 'serum', 'eye_cream', 'cream', 'mask', 'oil'];

// 根据类别推断步骤
export function inferStepFromCategory(category: string): SkincareStep {
    const categoryMap: Record<string, SkincareStep> = {
        '洁面': 'cleanser',
        '洁面乳': 'cleanser',
        '洗面奶': 'cleanser',
        '卸妆': 'cleanser',
        '化妆水': 'toner',
        '爽肤水': 'toner',
        '柔肤水': 'toner',
        '精华液': 'essence',
        '精华': 'serum',
        '安瓶': 'serum',
        '眼霜': 'eye_cream',
        '眼部精华': 'eye_cream',
        '面霜': 'cream',
        '乳液': 'cream',
        '保湿霜': 'cream',
        '防晒': 'sunscreen',
        '防晒霜': 'sunscreen',
        '隔离': 'sunscreen',
        '面膜': 'mask',
        '护肤油': 'oil',
        '精油': 'oil'
    };

    return categoryMap[category] || 'other';
}

// 获取步骤标签
export function getStepLabel(step: SkincareStep): string {
    return SKINCARE_STEPS[step]?.label || '其他';
}

// 获取步骤图标
export function getStepIcon(step: SkincareStep): string {
    return SKINCARE_STEPS[step]?.icon || '📦';
}

// 按步骤分组产品
export function groupProductsByStep<T extends { step?: string | null; category?: string }>(
    products: T[]
): Map<SkincareStep, T[]> {
    const grouped = new Map<SkincareStep, T[]>();

    // 初始化所有步骤的空数组
    STEP_ORDER.forEach(step => grouped.set(step, []));

    products.forEach(product => {
        // 尝试使用产品的 step 字段，否则根据 category 推断
        const step = (product.step as SkincareStep) ||
            (product.category ? inferStepFromCategory(product.category) : 'other');

        const stepProducts = grouped.get(step) || [];
        stepProducts.push(product);
        grouped.set(step, stepProducts);
    });

    // 移除空的分组
    STEP_ORDER.forEach(step => {
        if (grouped.get(step)?.length === 0) {
            grouped.delete(step);
        }
    });

    return grouped;
}
