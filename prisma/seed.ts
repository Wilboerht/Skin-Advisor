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
