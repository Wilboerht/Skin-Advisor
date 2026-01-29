
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import prisma from "@/lib/prisma";

// Lazy init to avoid build-time errors
let vapidConfigured = false;
function ensureVapidConfig() {
    if (vapidConfigured) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
        throw new Error("VAPID keys not configured");
    }
    webpush.setVapidDetails('mailto:admin@example.com', publicKey, privateKey);
    vapidConfigured = true;
}

export async function POST(req: NextRequest) {
    try {
        ensureVapidConfig(); // Initialize VAPID at runtime

        const body = await req.json();
        const { message, title, endpoint } = body; // If endpoint provided, send to one. user? send to all?

        // Fetch subscriptions 
        // For 'test', just fetch last 5 or something, or all.
        // Let's implement active check later. 
        // If 'endpoint' is passed (e.g. "self test"), send only to that.

        let subscriptions = [];
        if (endpoint) {
            const sub = await (prisma as any).pushSubscription.findUnique({ where: { endpoint } });
            if (sub) subscriptions.push(sub);
        } else {
            // Broadcast (limit to 100 for safety in this simple implementation)
            subscriptions = await (prisma as any).pushSubscription.findMany({ take: 100 });
        }

        const notificationPayload = JSON.stringify({
            title: title || "Skin Advisor Notification",
            body: message || "Hello from Skin Advisor!",
            icon: "/icon-192x192.png",
            url: "/advisor/dashboard"
        });

        const results = await Promise.allSettled(
            subscriptions.map((sub: any) =>
                webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: sub.keys as any
                }, notificationPayload)
            )
        );

        // Clean up invalid subscriptions (410 Gone)
        // ... (Simplified for this step)

        return NextResponse.json({
            success: true,
            sentCount: results.filter((r: PromiseSettledResult<any>) => r.status === 'fulfilled').length
        });

    } catch (error) {
        console.error("Push sending error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
