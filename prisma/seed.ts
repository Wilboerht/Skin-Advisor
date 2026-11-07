import { config } from "dotenv";
import crypto from "crypto";
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
                    model: "qwen-plus",
                    // 视觉默认 vl-plus：比 vl-max 便宜 90%+，与 .env 部署口径一致
                    visionModel: "qwen-vl-plus",
                    // SECURITY: API keys are NEVER stored in the database.
                    // They are always read from environment variables at runtime.
                    // 顾问叙事报告（v2）输出约需 3-6K tokens；低于 6000 会被截断导致整报告降级
                    maxTokens: 6000,
                    temperature: 0.3
                }
            }
        });
        console.log("Created default AI settings.");
    } else {
        console.log("AI settings already exist.");
    }

    // Seed dev test user: 必须显式开发环境 + SEED_DEV_USER=true，防止误在生产库创建弱口令账号
    const shouldSeedDevUser =
        process.env.NODE_ENV === "development" && process.env.SEED_DEV_USER === "true";
    if (shouldSeedDevUser) {
        console.log("Seeding dev test user...");
        const devPhone = "18700000000";
        const devPassword =
            process.env.SEED_DEV_PASSWORD ||
            `dev-${crypto.randomBytes(12).toString("base64url")}`;
        await prisma.user.upsert({
            where: { phoneNumber: devPhone },
            update: {
                password: await hashPassword(devPassword),
                name: "开发测试账号",
                role: "user"
            },
            create: {
                phoneNumber: devPhone,
                password: await hashPassword(devPassword),
                name: "开发测试账号",
                role: "user"
            }
        });
        console.log("Dev test user created/updated:", devPhone);
        if (!process.env.SEED_DEV_PASSWORD) {
            console.log("Generated dev password (shown once):", devPassword);
        }
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
