
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * POST /api/advisor/session/claim
 * Link a guest session to a logged-in user
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await request.json();
        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        // Find the session
        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: { id: true, userId: true }
        });

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // If session already claimed by someone else, prevent takeover
        if (session.userId && session.userId !== user.id) {
            return NextResponse.json({ error: "Session already claimed" }, { status: 403 });
        }

        // Link the session
        if (!session.userId) {
            await prisma.advisorSession.update({
                where: { sessionId },
                data: { userId: user.id }
            });
            console.log(`✅ Session ${sessionId} claimed by user ${user.id}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to claim session:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
