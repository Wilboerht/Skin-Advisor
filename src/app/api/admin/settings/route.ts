
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all settings
export async function GET() {
    try {
        const settings = await prisma.setting.findMany();

        // Convert to key-value object
        const settingsMap: Record<string, any> = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        // Merge with environment defaults
        const merged = {
            aiProvider: settingsMap.aiProvider || process.env.AI_PROVIDER || 'openai',
            aiModel: settingsMap.aiModel || process.env.OPENAI_API_MODEL || 'gpt-4o',
            systemPrompt: settingsMap.systemPrompt || 'You are an expert dermatologist and skincare formulations chemist. Analyze the user\'s skin data scientifically and recommend precise active ingredients.',
            strictJsonMode: settingsMap.strictJsonMode ?? true,
            visionAnalysis: settingsMap.visionAnalysis ?? true,
            ...settingsMap
        };

        return NextResponse.json({ success: true, data: merged });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH update settings
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const updates = body.settings;

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json(
                { success: false, error: "Invalid settings data" },
                { status: 400 }
            );
        }

        // Upsert each setting
        for (const [key, value] of Object.entries(updates)) {
            await prisma.setting.upsert({
                where: { key },
                update: { value: value as any },
                create: { key, value: value as any },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
