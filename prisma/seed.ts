import { config } from "dotenv";
config({ path: ".env.local" });

// Prisma 7.x 导入方式
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth"; // 仅用于开发测试账号，生产 seed 不会执行

const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
        benefits: ["淡纹紧致", "消除浮肿", "提亮眼周"],
        negativeFor: ["敏感肌", "孕妇"]
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
        benefits: ["祛痘控油", "收缩毛孔", "改善黑头"],
        negativeFor: ["敏感肌", "孕妇", "干皮"]
    }
];

async function main() {


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
                    provider: "qwen",
                    visionProvider: "qwen",
                    model: "deepseek-chat",
                    visionModel: "qwen-vl-max",
                    // SECURITY: API keys are NEVER stored in the database.
                    // They are always read from environment variables at runtime.
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
                negativeFor: p.negativeFor || [],
                active: true,
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
                negativeFor: p.negativeFor || [],
                active: true,
            }
        });
    }
    console.log("Products seeded.");

    // Seed dev test user (development only)
    if (process.env.NODE_ENV !== "production") {
        console.log("Seeding dev test user...");
        const devPhone = "18700000000";
        const devPassword = await hashPassword("123456");
        await prisma.user.upsert({
            where: { phoneNumber: devPhone },
            update: {
                password: devPassword,
                name: "开发测试账号",
                role: "user"
            },
            create: {
                phoneNumber: devPhone,
                password: devPassword,
                name: "开发测试账号",
                role: "user"
            }
        });
        console.log("Dev test user created/updated:", devPhone);
    }

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
