import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, phone, address, shareProofUrl, skinScore, percentile } = body;

        // Validation
        if (!name || !phone || !address || !shareProofUrl) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const submission = await prisma.shareReward.create({
            data: {
                name,
                phone,
                address,
                shareProofUrl,
                skinScore: Number(skinScore) || 0,
                percentile: Number(percentile) || 0,
                status: "pending"
            }
        });

        return NextResponse.json({ success: true, data: submission });
    } catch (e: any) {
        console.error("Submission error:", e);
        return NextResponse.json({ error: e.message || "Submission failed" }, { status: 500 });
    }
}
