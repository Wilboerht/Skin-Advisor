
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const user = await getSession();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const history = await prisma.advisorSession.findMany({
            where: {
                userId: user.id,
                completedAt: { not: null } // Only completed sessions
            },
            orderBy: {
                completedAt: 'desc'
            },
            select: {
                sessionId: true,
                completedAt: true,
                analysisResult: true
            },
            take: 20 // Limit to last 20
        });

        // Also try to find sessions created by this device/browser fingerprint if userId was just linked? 
        // For now, simple user-bound history.

        return NextResponse.json({ history });
    } catch (e) {
        console.error("History fetch error:", e);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}
