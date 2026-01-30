
import prisma from "@/lib/prisma";

export interface AISettings {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
}

/**
 * Get effective AI settings by merging DB settings with Environment variables
 * Priority: DB > Env > Default
 */
export async function getAISettings(): Promise<AISettings> {
    try {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: ['aiProvider', 'aiModel', 'temperature', 'maxTokens']
                }
            }
        });

        const settingsMap: Record<string, any> = {};
        settings.forEach(s => {
            // Prisma JSON value might need parsing or casting
            settingsMap[s.key] = s.value;
        });

        return {
            provider: settingsMap.aiProvider || process.env.AI_VISION_PROVIDER || "openai",
            model: settingsMap.aiModel || process.env.OPENAI_API_MODEL || "gpt-4o",
            temperature: Number(settingsMap.temperature ?? 0.7),
            maxTokens: Number(settingsMap.maxTokens ?? 4096)
        };
    } catch (e) {
        console.warn("Failed to fetch settings from DB, falling back to defaults", e);
        return {
            provider: process.env.AI_VISION_PROVIDER || "openai",
            model: process.env.OPENAI_API_MODEL || "gpt-4o",
            temperature: 0.7,
            maxTokens: 4096
        };
    }
}
