// Prisma 7.x 导入方式
import { PrismaClient } from ".prisma/client";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "file:../dev.db"
        }
    }
});

const DEFAULT_QUESTIONS = [
    {
        id: "q0",
        fieldName: "gender",
        question: "您的性别是？",
        type: "single",
        options: [
            { value: "female", label: "女性" },
            { value: "male", label: "男性" },
        ],
    },
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
        id: "q3b",
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
        dependsOn: { // Only for females
            field: "gender",
            value: "female",
            operator: "equals"
        }
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
        fieldName: "sleepQuality",
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
        question: "生理周期阶段？",
        subtext: "用于精准匹配'生理期护肤'模式",
        type: "single",
        options: [
            { value: "na", label: "不适用" },
            { value: "menstrual", label: "经期中 (第1-7天)" },
            { value: "follicular", label: "滤泡期 (经后一周/状态好)" },
            { value: "luteal", label: "黄体期 (经前一周/易冒痘)" },
        ],
        dependsOn: {
            field: "gender",
            value: "female",
            operator: "equals"
        }
    }
];

const PRODUCTS_CATALOG = [
    {
        id: "p1",
        name: "光蕴焕活精华液",
        nameEn: "Luminous Revival Serum",
        category: "精华",
        image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=300&h=300",
        price: "¥890",
        description: "蕴含珍稀植物精粹与高浓度多肽，深层修护肌底，焕发肌肤自然光泽。",
        keyIngredients: ["多肽", "烟酰胺", "积雪草"],
        suitableSkinTypes: ["all", "dull", "aging"],
        benefits: ["提亮肤色", "抗衰老", "修护屏障"]
    },
    {
        id: "p2",
        name: "深海海藻保湿霜",
        nameEn: "Deep Sea Algae Cream",
        category: "面霜",
        image: "https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&q=80&w=300&h=300",
        price: "¥680",
        description: "轻盈质地，深层补水，锁住水分，令肌肤水润饱满。",
        keyIngredients: ["深海藻类提取物", "透明质酸", "角鲨烷"],
        suitableSkinTypes: ["dry", "combination", "sensitive"],
        benefits: ["深层补水", "舒缓修护", "长效保湿"]
    },
    {
        id: "p3",
        name: "氨基酸温和洁面乳",
        nameEn: "Amino Acid Gentle Cleanser",
        category: "洁面",
        image: "https://images.unsplash.com/photo-1556228720-1957be83d09a?auto=format&fit=crop&q=80&w=300&h=300",
        price: "¥320",
        description: "弱酸性配方，温和清洁不紧绷，呵护皮脂膜。",
        keyIngredients: ["氨基酸表面活性剂", "甘油", "洋甘菊"],
        suitableSkinTypes: ["all", "sensitive"],
        benefits: ["温和清洁", "不伤角质", "洗后不干"]
    },
    {
        id: "p4",
        name: "多重防护隔离乳 SPF50+",
        nameEn: "Multi-Protection Sunscreen",
        category: "防晒",
        image: "https://images.unsplash.com/photo-1571781565036-d3f7595ca3e4?auto=format&fit=crop&q=80&w=300&h=300",
        price: "¥450",
        description: "全波段防晒，轻薄透气，抵御紫外线与环境污染。",
        keyIngredients: ["物理防晒剂", "维生素E", "红景天"],
        suitableSkinTypes: ["all"],
        benefits: ["高倍防晒", "抗氧化", "轻薄透气"]
    },
    {
        id: "p5",
        name: "视黄醇抗皱眼霜",
        nameEn: "Retinol Anti-Wrinkle Eye Cream",
        category: "眼霜",
        image: "https://images.unsplash.com/photo-1608248597279-f99d160bfbc8?auto=format&fit=crop&q=80&w=300&h=300",
        price: "¥720",
        description: "淡化眼周细纹，改善黑眼圈，紧致眼部轮廓。",
        keyIngredients: ["视黄醇", "咖啡因", "胜肽"],
        suitableSkinTypes: ["aging", "dry"],
        benefits: ["淡纹紧致", "消除浮肿", "提亮眼周"]
    },
    {
        id: "p6",
        name: "水杨酸净痘精华",
        nameEn: "Salicylic Acid Acne Serum",
        category: "精华",
        image: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&q=80&w=300&h=300",
        price: "¥480",
        description: "疏通毛孔，改善痘痘粉刺，平衡油脂分泌。",
        keyIngredients: ["2%水杨酸", "茶树精油", "金缕梅"],
        suitableSkinTypes: ["oily", "acne-prone"],
        benefits: ["祛痘控油", "收缩毛孔", "改善黑头"]
    }
];

async function main() {
    console.log("Start seeding questions...");

    for (const q of DEFAULT_QUESTIONS) {
        const existing = await prisma.advisorQuestion.findFirst({
            where: { fieldName: q.fieldName }
        });

        if (!existing) {
            await prisma.advisorQuestion.create({
                data: {
                    fieldName: q.fieldName,
                    question: q.question,
                    type: q.type,
                    // @ts-ignore
                    options: JSON.stringify(q.options),
                    // @ts-ignore
                    order: parseInt(q.id.replace("q", "")) || 10,
                    active: true,
                    required: true,
                    category: "general"
                }
            });
            console.log(`Created question: ${q.fieldName}`);
        } else {
            console.log(`Question already exists: ${q.fieldName}`);
        }
    }

    // Seed AI Settings
    console.log("Seeding AI Settings...");
    const aiSettingKey = "advisor_ai_settings";
    const existingSettings = await prisma.setting.findUnique({
        where: { key: aiSettingKey }
    });

    if (!existingSettings) {
        await prisma.setting.create({
            data: {
                key: aiSettingKey,
                value: {
                    provider: "openai",
                    visionProvider: "openai",
                    model: "gpt-4o",
                    visionModel: "gpt-4o",
                    apiKeys: {
                        openai: process.env.OPENAI_API_KEY || "",
                        anthropic: process.env.ANTHROPIC_API_KEY || "",
                    },
                    maxTokens: 2000,
                    temperature: 0.3
                }
            }
        });
        console.log("Created default AI settings.");
    } else {
        console.log("AI settings already exist.");
    }

    // Seed Products
    console.log("Seeding Products...");

    for (const p of PRODUCTS_CATALOG) {
        await prisma.product.upsert({
            where: { id: p.id },
            update: {
                name: p.name,
                nameEn: p.nameEn,
                category: p.category,
                image: p.image,
                price: p.price,
                description: p.description,
                keyIngredients: p.keyIngredients,
                suitableSkinTypes: p.suitableSkinTypes,
                benefits: p.benefits,
                active: true,
                stock: 100 // Default stock
            },
            create: {
                id: p.id,
                name: p.name,
                nameEn: p.nameEn,
                category: p.category,
                image: p.image,
                price: p.price,
                description: p.description,
                keyIngredients: p.keyIngredients,
                suitableSkinTypes: p.suitableSkinTypes,
                benefits: p.benefits,
                active: true,
                stock: 100 // Default stock
            }
        });
    }
    console.log("Products seeded.");

    console.log("Seeding finished.");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
