
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// GET all settings
export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const settings = await prisma.setting.findMany();

        // Convert to key-value object
        const settingsMap: Record<string, any> = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        // Merge with environment defaults
        const merged = {
            // AI Model
            aiProvider: settingsMap.aiProvider || process.env.AI_PROVIDER || 'openai',
            aiModel: settingsMap.aiModel || process.env.OPENAI_API_MODEL || 'gpt-4o',
            systemPrompt: settingsMap.systemPrompt || 'You are an expert dermatologist and skincare formulations chemist. Analyze the user\'s skin data scientifically and recommend precise active ingredients.',
            strictJsonMode: settingsMap.strictJsonMode ?? true,
            visionAnalysis: settingsMap.visionAnalysis ?? true,

            // AI Parameters
            temperature: settingsMap.temperature ?? 0.7,
            maxTokens: settingsMap.maxTokens ?? 4096,
            topP: settingsMap.topP ?? 0.95,

            // Analysis Sensitivity
            skinIssueThreshold: settingsMap.skinIssueThreshold ?? 50,
            acneSensitivity: settingsMap.acneSensitivity ?? 50,
            wrinkleSensitivity: settingsMap.wrinkleSensitivity ?? 50,
            pigmentSensitivity: settingsMap.pigmentSensitivity ?? 50,

            // Feature Flags
            enableDetailedAnalysis: settingsMap.enableDetailedAnalysis ?? true,
            enableProductRecommendations: settingsMap.enableProductRecommendations ?? true,
            enableRoutineSuggestions: settingsMap.enableRoutineSuggestions ?? true,

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
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const updates = body.settings;
        const clientInfo = getClientInfo(request);

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json(
                { success: false, error: "Invalid settings data" },
                { status: 400 }
            );
        }

        // Get old values for audit
        const oldSettings = await prisma.setting.findMany({
            where: { key: { in: Object.keys(updates) } }
        });
        const oldValuesMap: Record<string, any> = {};
        oldSettings.forEach(s => { oldValuesMap[s.key] = s.value; });

        // Upsert each setting
        for (const [key, value] of Object.entries(updates)) {
            await prisma.setting.upsert({
                where: { key },
                update: { value: value as any },
                create: { key, value: value as any },
            });
        }

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "update",
            resource: "Settings",
            details: {
                changedKeys: Object.keys(updates),
                changes: Object.entries(updates).map(([key, newValue]) => ({
                    key,
                    oldValue: oldValuesMap[key],
                    newValue
                }))
            },
            ...clientInfo
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
