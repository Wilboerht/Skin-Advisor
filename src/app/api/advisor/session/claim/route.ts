
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


        // Atomic claim: only update if userId is null (not yet claimed)
        try {
            const updated = await prisma.advisorSession.updateMany({
                where: { sessionId, userId: null },
                data: { userId: user.id }
            });

            if (updated.count === 0) {
                // 可能已被其他用户认领，检查所有权
                const session = await prisma.advisorSession.findUnique({
                    where: { sessionId },
                    select: { userId: true }
                });
                if (session?.userId && session.userId !== user.id) {
                    console.warn(`Attempted takeover of session ${sessionId}: current owner ${session.userId}, requester ${user.id}`);
                    return NextResponse.json({ error: "Session already claimed" }, { status: 403 });
                }
            } else {
            }
        } catch (e) {
            console.error("Failed to claim session:", e);
            return NextResponse.json({ error: "Failed to claim session" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to claim session:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error("Error details:", { message: errorMessage, stack: errorStack });
        return NextResponse.json({ 
            error: "Internal server error"
        }, { status: 500 });
    }
}
