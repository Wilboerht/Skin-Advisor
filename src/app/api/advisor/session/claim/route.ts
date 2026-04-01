
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

        console.log(`📝 Claiming session ${sessionId} for user ${user.id}...`);

        // Find the session
        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: { id: true, userId: true }
        });

        if (!session) {
            console.warn(`Session ${sessionId} not found in database`);
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // If session already claimed by someone else, prevent takeover
        if (session.userId && session.userId !== user.id) {
            console.warn(`Attempted takeover of session ${sessionId}: current owner ${session.userId}, requester ${user.id}`);
            return NextResponse.json({ error: "Session already claimed" }, { status: 403 });
        }

        // Link the session
        if (!session.userId) {
            await prisma.advisorSession.update({
                where: { sessionId },
                data: { userId: user.id }
            });
            console.log(`✅ Session ${sessionId} claimed by user ${user.id}`);
        } else {
            console.log(`Session ${sessionId} already claimed by user ${user.id}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to claim session:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error("Error details:", { message: errorMessage, stack: errorStack });
        return NextResponse.json({ 
            error: "Internal server error",
            details: errorMessage 
        }, { status: 500 });
    }
}
