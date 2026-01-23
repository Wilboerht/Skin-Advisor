import { NextResponse } from "next/server";
import { MockDB } from "@/lib/mock-db";

export async function GET() {
    try {
        const campaign = MockDB.getActiveCampaign();

        // Always return success structure
        return NextResponse.json({
            success: true,
            data: campaign || null
        });
    } catch (error) {
        console.error("Failed to fetch active campaign:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
