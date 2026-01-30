import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/user/reminder
export async function GET(req: NextRequest) {
    const user = await getSession();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const settings = await prisma.reminderSettings.findUnique({
            where: { userId: user.id }
        });

        // 默认设置
        const defaultSettings = {
            enabled: false,
            morningTime: "07:30",
            eveningTime: "21:00",
            morningEnabled: true,
            eveningEnabled: true,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        return NextResponse.json({
            settings: settings || defaultSettings
        });
    } catch (e) {
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

// POST /api/user/reminder
export async function POST(req: NextRequest) {
    const user = await getSession();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        const settings = await prisma.reminderSettings.upsert({
            where: { userId: user.id },
            update: {
                enabled: body.enabled,
                morningTime: body.morningTime,
                eveningTime: body.eveningTime,
                morningEnabled: body.morningEnabled,
                eveningEnabled: body.eveningEnabled,
                timezone: body.timezone || "Asia/Shanghai"
            },
            create: {
                userId: user.id,
                enabled: body.enabled,
                morningTime: body.morningTime || "07:30",
                eveningTime: body.eveningTime || "21:00",
                morningEnabled: body.morningEnabled ?? true,
                eveningEnabled: body.eveningEnabled ?? true,
                timezone: body.timezone || "Asia/Shanghai"
            }
        });

        return NextResponse.json({ success: true, settings });
    } catch (e) {
        console.error("Save settings error:", e);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
