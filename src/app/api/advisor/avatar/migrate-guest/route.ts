import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/advisor/avatar/migrate-guest
 * 
 * Migrate guest avatar from client-side storage to user account
 * Called when a guest user logs in or registers
 * 
 * Request body:
 * {
 *   sessionId: string     - The advisor session ID that contains the guest avatar
 *   avatarUrl: string     - The guest avatar URL from localStorage (optional, for direct migration)
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await req.json();
        const { sessionId, avatarUrl } = body;

        if (!sessionId && !avatarUrl) {
            return NextResponse.json(
                { error: "Missing sessionId or avatarUrl" },
                { status: 400 }
            );
        }

        console.log(`🔄 Migrating guest avatar for user ${session.id}, sessionId: ${sessionId}`);

        // Approach 1: Use provided avatarUrl directly
        if (avatarUrl && typeof avatarUrl === "string") {
            if (!avatarUrl.startsWith("http") && !avatarUrl.startsWith("data:")) {
                return NextResponse.json(
                    { error: "Invalid avatar URL format" },
                    { status: 400 }
                );
            }

            // Update user's avatar with the guest avatar
            // Only update if user doesn't have a custom avatar yet
            const currentUser = await prisma.user.findUnique({
                where: { id: session.id },
                select: { avatarUrl: true }
            });

            if (currentUser && (!currentUser.avatarUrl || currentUser.avatarUrl === "/user-placeholder.svg" || currentUser.avatarUrl.includes("avatar-ai-"))) {
                await prisma.user.update({
                    where: { id: session.id },
                    data: { avatarUrl }
                });
                console.log(`✅ User ${session.id} avatar updated from guest session`);
                return NextResponse.json({ 
                    success: true, 
                    message: "Guest avatar migrated to user account",
                    avatarUrl
                });
            } else {
                console.log(`ℹ️  User ${session.id} already has a custom avatar, skipping migration`);
                return NextResponse.json({ 
                    success: true, 
                    message: "User already has a custom avatar",
                    skipped: true
                });
            }
        }

        // Approach 2: Get avatar from session (in case it was stored server-side for that brief moment)
        if (sessionId) {
            const advisorSession = await prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { analysisResult: true }
            });

            if (advisorSession) {
                const analysisResult = advisorSession.analysisResult as any;
                const generatedAvatar = analysisResult?.generatedAvatar;

                if (generatedAvatar && typeof generatedAvatar === "string") {
                    // Update user's avatar
                    const currentUser = await prisma.user.findUnique({
                        where: { id: session.id },
                        select: { avatarUrl: true }
                    });

                    if (currentUser && (!currentUser.avatarUrl || currentUser.avatarUrl === "/user-placeholder.svg" || currentUser.avatarUrl.includes("avatar-ai-"))) {
                        await prisma.user.update({
                            where: { id: session.id },
                            data: { avatarUrl: generatedAvatar }
                        });
                        console.log(`✅ User ${session.id} avatar migrated from session ${sessionId}`);
                        return NextResponse.json({ 
                            success: true, 
                            message: "Guest avatar migrated to user account",
                            avatarUrl: generatedAvatar
                        });
                    } else {
                        console.log(`ℹ️  User ${session.id} already has a custom avatar`);
                        return NextResponse.json({ 
                            success: true, 
                            message: "User already has a custom avatar",
                            skipped: true
                        });
                    }
                } else {
                    console.log(`ℹ️  No avatar found in session ${sessionId}`);
                    return NextResponse.json({ 
                        success: false,
                        message: "No avatar found in session",
                        skipped: true
                    });
                }
            } else {
                console.log(`ℹ️  Session ${sessionId} not found`);
                return NextResponse.json({ 
                    success: false,
                    message: "Session not found",
                    skipped: true
                });
            }
        }

        return NextResponse.json({ success: false, message: "No avatar to migrate" });

    } catch (error: any) {
        console.error("Avatar migration error:", error);
        return NextResponse.json(
            { error: "Failed to migrate avatar", details: error.message },
            { status: 500 }
        );
    }
}
