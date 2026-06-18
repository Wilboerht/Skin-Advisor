/**
 * 护肤成分知识库
 * 用于产品管理中的成分自动补全和功效关联
 */

export interface Ingredient {
    id: string;
    name: string;
    nameEn: string;
    category: 'active' | 'moisturizer' | 'antioxidant' | 'exfoliant' | 'soothing' | 'sunscreen' | 'other';
    effects: string[];
    description: string;
    concentration?: string; // 推荐浓度范围
    caution?: string; // 使用注意事项
    incompatibleWith?: string[]; // 不能同时使用的成分
    skinTypes?: string[]; // 适用肤质
}

export const INGREDIENT_CATEGORIES = {
    active: { label: '活性成分', color: '#C19F70' },
    moisturizer: { label: '保湿成分', color: '#5B8FB9' },
    antioxidant: { label: '抗氧化', color: '#8B5A2B' },
    exfoliant: { label: '去角质', color: '#D97706' },
    soothing: { label: '舒缓修护', color: '#3D4430' },
    sunscreen: { label: '防晒', color: '#F59E0B' },
    other: { label: '其他', color: '#6B7280' },
};

export const STAR_INGREDIENTS: Ingredient[] = [
    // === 活性成分 ===
    {
        id: 'retinol',
        name: '视黄醇',
        nameEn: 'Retinol',
        category: 'active',
        effects: ['抗皱', '促进细胞更新', '改善肤色不均', '收缩毛孔'],
        description: '维生素A衍生物，被公认为最有效的抗衰老成分之一。',
        concentration: '0.025% - 1%',
        caution: '建议夜间使用，需配合防晒；孕妇慎用',
        incompatibleWith: ['vitamin_c', 'aha', 'bha'],
        skinTypes: ['oily', 'combination', 'normal'],
    },
    {
        id: 'niacinamide',
        name: '烟酰胺',
        nameEn: 'Niacinamide',
        category: 'active',
        effects: ['美白提亮', '控油', '收缩毛孔', '修护屏障'],
        description: '维生素B3，多功能明星成分，温和高效。',
        concentration: '2% - 10%',
        skinTypes: ['all'],
    },
    {
        id: 'vitamin_c',
        name: '维生素C',
        nameEn: 'Vitamin C (L-Ascorbic Acid)',
        category: 'antioxidant',
        effects: ['抗氧化', '美白', '促进胶原蛋白合成', '提亮肤色'],
        description: '强效抗氧化剂，需注意产品稳定性。',
        concentration: '10% - 20%',
        caution: '易氧化，建议避光保存；pH要求较低',
        incompatibleWith: ['retinol', 'aha', 'bha'],
        skinTypes: ['all'],
    },
    {
        id: 'hyaluronic_acid',
        name: '透明质酸',
        nameEn: 'Hyaluronic Acid',
        category: 'moisturizer',
        effects: ['深层补水', '锁水保湿', '抚平细纹'],
        description: '天然保湿因子，可吸收自身重量1000倍的水分。',
        concentration: '0.1% - 2%',
        skinTypes: ['all'],
    },
    {
        id: 'ceramide',
        name: '神经酰胺',
        nameEn: 'Ceramide',
        category: 'moisturizer',
        effects: ['修护屏障', '保湿锁水', '舒缓敏感'],
        description: '皮肤屏障的核心成分，对敏感肌极为友好。',
        skinTypes: ['sensitive', 'dry', 'all'],
    },
    {
        id: 'salicylic_acid',
        name: '水杨酸',
        nameEn: 'Salicylic Acid (BHA)',
        category: 'exfoliant',
        effects: ['疏通毛孔', '去角质', '控油', '抗炎'],
        description: '脂溶性酸，可深入毛孔清洁，适合油痘皮。',
        concentration: '0.5% - 2%',
        caution: '敏感肌慎用；孕妇不建议使用',
        incompatibleWith: ['retinol', 'vitamin_c'],
        skinTypes: ['oily', 'combination'],
    },
    {
        id: 'glycolic_acid',
        name: '果酸/甘醇酸',
        nameEn: 'Glycolic Acid (AHA)',
        category: 'exfoliant',
        effects: ['去角质', '提亮', '促进细胞更新', '改善暗沉'],
        description: '水溶性酸，分子小渗透力强，需建立耐受。',
        concentration: '5% - 30%',
        caution: '使用后必须防晒；敏感肌慎用',
        incompatibleWith: ['retinol', 'vitamin_c'],
        skinTypes: ['normal', 'oily'],
    },
    {
        id: 'peptide',
        name: '胜肽',
        nameEn: 'Peptides',
        category: 'active',
        effects: ['抗皱', '紧致', '促进胶原蛋白'],
        description: '氨基酸链，可向皮肤发送信号促进修复。',
        skinTypes: ['all'],
    },
    {
        id: 'centella',
        name: '积雪草',
        nameEn: 'Centella Asiatica (CICA)',
        category: 'soothing',
        effects: ['舒缓', '修护', '抗炎', '促进愈合'],
        description: '传统草本成分，对敏感泛红有很好的舒缓作用。',
        skinTypes: ['sensitive', 'all'],
    },
    {
        id: 'squalane',
        name: '角鲨烷',
        nameEn: 'Squalane',
        category: 'moisturizer',
        effects: ['保湿', '柔润', '抗氧化'],
        description: '与皮脂膜相似的油脂，亲肤性极佳。',
        skinTypes: ['dry', 'sensitive', 'all'],
    },
    {
        id: 'azelaic_acid',
        name: '壬二酸',
        nameEn: 'Azelaic Acid',
        category: 'active',
        effects: ['淡化痘印', '控油', '抗菌', '提亮'],
        description: '多功能成分，对玫瑰痤疮和痘痘都有效。',
        concentration: '10% - 20%',
        skinTypes: ['oily', 'combination', 'sensitive'],
    },
    {
        id: 'zinc_oxide',
        name: '氧化锌',
        nameEn: 'Zinc Oxide',
        category: 'sunscreen',
        effects: ['物理防晒', 'UVA/UVB', '舒缓'],
        description: '广谱物理防晒剂，温和适合敏感肌。',
        skinTypes: ['all'],
    },
    {
        id: 'tranexamic_acid',
        name: '传明酸',
        nameEn: 'Tranexamic Acid',
        category: 'active',
        effects: ['淡斑', '均匀肤色', '抑制黑色素'],
        description: '美白成分，对黄褐斑等顽固色斑有效。',
        concentration: '2% - 5%',
        skinTypes: ['all'],
    },
    {
        id: 'bakuchiol',
        name: '补骨脂酚',
        nameEn: 'Bakuchiol',
        category: 'active',
        effects: ['抗皱', '抗氧化', '促进胶原蛋白'],
        description: '植物来源的"天然视黄醇替代品"，温和适合孕妇。',
        skinTypes: ['sensitive', 'all'],
    },
];

// 按分类分组
export const INGREDIENTS_BY_CATEGORY = STAR_INGREDIENTS.reduce((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = [];
    acc[ing.category].push(ing);
    return acc;
}, {} as Record<string, Ingredient[]>);

// 快速查找
export const getIngredientById = (id: string): Ingredient | undefined =>
    STAR_INGREDIENTS.find(i => i.id === id);

export const getIngredientsByEffect = (effect: string): Ingredient[] =>
    STAR_INGREDIENTS.filter(i => i.effects.some(e => e.includes(effect)));
