import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { subscription, userAgent } = body;

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
        }

        // Check if exists
        const existing = await (prisma as any).pushSubscription.findUnique({
            where: { endpoint: subscription.endpoint }
        });

        if (existing) {
            // Update timestamp
            await (prisma as any).pushSubscription.update({
                where: { id: existing.id },
                data: { updatedAt: new Date(), userAgent: userAgent || existing.userAgent }
            });
            return NextResponse.json({ success: true, status: "updated" });
        }

        // Create new
        await (prisma as any).pushSubscription.create({
            data: {
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                userAgent: userAgent
            }
        });

        return NextResponse.json({ success: true, status: "created" });

    } catch (error) {
        console.error("Subscription error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
