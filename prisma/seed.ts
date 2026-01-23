// Prisma 7.x 导入方式
import { PrismaClient } from ".prisma/client";
import { DEFAULT_QUESTIONS } from "../src/config/questions";

const prisma = new PrismaClient();

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
                    options: JSON.stringify(q.options),
                    order: parseInt(q.id.replace("q", "")),
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

        console.log("Seeding finished.");
    }
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
