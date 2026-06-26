import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_QUESTIONS } from "@/config/questions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
    const ip = getClientIP(request);
    const ipLimit = await rateLimit(`questions-ip-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }
    return NextResponse.json(DEFAULT_QUESTIONS);
}

